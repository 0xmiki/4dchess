import { ConvexError, v } from 'convex/values';
import { createInitialState } from '../lib/chess';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { currentParticipant, ensureParticipant, participantName } from './lib/participants';
import { invitationToken, tokenHash, validateRequestId } from './lib/invitations';
import { color, gameDocument, seatReceipt, timeControl } from './lib/validators';
import { requireMatch, validateRevision } from './lib/access';
import { limitCreation } from './lib/limits';

import { initialClock, stoppedClock, START_DELAY_MS } from '../lib/online/time-controls';
import { armClock, cancelClockJob, endIfTimedOut } from './lib/clocks';
import { requireOnlineAvailable, settleWaitingSearches } from './lib/online_availability';

const WAITING_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const resign = mutation({
	args: { gameId: v.id('games'), expectedRevision: v.number(), requestId: v.string() },
	returns: v.number(),
	handler: async (ctx, { gameId, expectedRevision, requestId }) => {
		validateRequestId(requestId);
		validateRevision(expectedRevision);
		const { game, participant, seat } = await requireMatch(ctx, gameId);
		const prior = await ctx.db
			.query('commands')
			.withIndex('by_request', (q) =>
				q.eq('gameId', gameId).eq('participantId', participant._id).eq('requestId', requestId)
			)
			.unique();
		if (prior) {
			if (prior.kind !== 'resign' || prior.expectedRevision !== expectedRevision)
				throw new ConvexError('REQUEST_ID_REUSED');
			return prior.revision;
		}
		if (
			await ctx.db
				.query('moves')
				.withIndex('by_request', (q) =>
					q.eq('gameId', gameId).eq('participantId', participant._id).eq('requestId', requestId)
				)
				.unique()
		)
			throw new ConvexError('REQUEST_ID_REUSED');
		if (game.status !== 'active') throw new ConvexError('MATCH_NOT_ACTIVE');
		if (game.revision !== expectedRevision) throw new ConvexError('STALE_REVISION');
		const now = Date.now();
		if (await endIfTimedOut(ctx, game, now)) {
			await ctx.db.insert('commands', {
				gameId,
				participantId: participant._id,
				requestId,
				expectedRevision,
				revision: game.revision + 1,
				kind: 'resign'
			});
			return game.revision + 1;
		}
		await cancelClockJob(ctx, game.timeoutJob);
		const revision = game.revision + 1;
		await ctx.db.patch(gameId, {
			status: 'finished',
			result: { reason: 'resignation', winner: seat === 'white' ? 'black' : 'white' },
			...(game.clock
				? { clock: stoppedClock(game.clock, game.turn, now), timeoutJob: undefined }
				: {}),
			finishedAt: Date.now(),
			revision
		});
		await ctx.db.insert('commands', {
			gameId,
			participantId: participant._id,
			requestId,
			expectedRevision,
			revision,
			kind: 'resign'
		});
		return revision;
	}
});

function seatOf(game: Doc<'games'>, participantId: Id<'participants'>) {
	if (game.whiteParticipantId === participantId) return 'white' as const;
	if (game.blackParticipantId === participantId) return 'black' as const;
	return null;
}

export const create = mutation({
	args: { requestId: v.string(), seat: color, timeControl: v.optional(timeControl) },
	returns: v.object({
		gameId: v.id('games'),
		token: v.string(),
		seat: color,
		expiresAt: v.number()
	}),
	handler: async (ctx, { requestId, seat, timeControl = 'untimed' }) => {
		validateRequestId(requestId);
		const participantId = await ensureParticipant(ctx);
		const existing = await ctx.db
			.query('games')
			.withIndex('by_creator_request', (q) =>
				q.eq('creatorParticipantId', participantId).eq('createRequestId', requestId)
			)
			.unique();
		if (
			existing &&
			(seatOf(existing, participantId) !== seat ||
				(existing.timeControl ?? 'untimed') !== timeControl)
		)
			throw new ConvexError('REQUEST_ID_REUSED');
		const token = await invitationToken(participantId, requestId);
		if (existing) return { gameId: existing._id, token, seat, expiresAt: existing.expiresAt };
		await limitCreation(ctx, participantId);
		const waiting = await ctx.db
			.query('games')
			.withIndex('by_creator_status', (q) =>
				q
					.eq('creatorParticipantId', participantId)
					.eq('status', 'waiting')
					.gt('expiresAt', Date.now())
			)
			.take(5);
		if (waiting.length >= 5) throw new ConvexError('TOO_MANY_INVITES');
		const hash = await tokenHash(token);
		if (
			await ctx.db
				.query('invites')
				.withIndex('by_token_hash', (q) => q.eq('tokenHash', hash))
				.unique()
		)
			throw new Error('Invitation collision.');
		const expiresAt = Date.now() + WAITING_LIFETIME_MS;
		const initial = createInitialState();
		const gameId = await ctx.db.insert('games', {
			...initial,
			board: [...initial.board],
			positionKeys: [...initial.positionKeys],
			creatorParticipantId: participantId,
			createRequestId: requestId,
			timeControl,
			...(timeControl === 'untimed' ? {} : { clock: initialClock(timeControl, null) }),
			whiteParticipantId: seat === 'white' ? participantId : null,
			blackParticipantId: seat === 'black' ? participantId : null,
			status: 'waiting',
			revision: 0,
			expiresAt,
			startedAt: null,
			finishedAt: null,
			purgeAt: expiresAt + 7 * 86400000
		});
		await ctx.db.insert('invites', { gameId, tokenHash: hash, expiresAt, status: 'open' });
		await ctx.scheduler.runAt(expiresAt, internal.games.expireWaiting, { gameId });
		return { gameId, token, seat, expiresAt };
	}
});

export const previewInvite = query({
	args: { token: v.string() },
	returns: v.object({
		gameId: v.id('games'),
		status: v.union(v.literal('waiting'), v.literal('active'), v.literal('finished')),
		availableSeat: v.union(color, v.null()),
		challengerName: v.string(),
		timeControl: v.optional(timeControl),
		expiresAt: v.number()
	}),
	handler: async (ctx, { token }) => {
		const hash = await tokenHash(token);
		const invite = await ctx.db
			.query('invites')
			.withIndex('by_token_hash', (q) => q.eq('tokenHash', hash))
			.unique();
		if (!invite) throw new ConvexError('INVALID_INVITE');
		const game = await ctx.db.get(invite.gameId);
		if (!game) throw new ConvexError('INVALID_INVITE');
		// The client also receives the deadline; queries do not rerun just because time passes.
		const available =
			game.status === 'waiting' && invite.status === 'open' && Date.now() < invite.expiresAt;
		return {
			gameId: game._id,
			challengerName: await participantName(ctx, game.creatorParticipantId),
			timeControl: game.timeControl,
			status: game.status,
			availableSeat: available
				? game.whiteParticipantId
					? ('black' as const)
					: ('white' as const)
				: null,
			expiresAt: invite.expiresAt
		};
	}
});

export const join = mutation({
	args: { token: v.string() },
	returns: seatReceipt,
	handler: async (ctx, { token }) => {
		const participantId = await ensureParticipant(ctx);
		const hash = await tokenHash(token);
		const invite = await ctx.db
			.query('invites')
			.withIndex('by_token_hash', (q) => q.eq('tokenHash', hash))
			.unique();
		if (!invite) throw new ConvexError('INVALID_INVITE');
		const game = await ctx.db.get(invite.gameId);
		if (!game) throw new ConvexError('INVALID_INVITE');
		const existingSeat = seatOf(game, participantId);
		if (existingSeat) {
			const current = game.currentGameId ? await ctx.db.get(game.currentGameId) : game;
			return {
				gameId: game._id,
				seat: current ? seatOf(current, participantId)! : existingSeat,
				revision: current?.revision ?? game.revision
			};
		}
		if (game.whiteParticipantId && game.blackParticipantId) throw new ConvexError('MATCH_FULL');
		if (game.status !== 'waiting' || invite.status !== 'open')
			throw new ConvexError('INVITE_CLOSED');
		if (Date.now() >= invite.expiresAt) throw new ConvexError('INVITE_EXPIRED');
		const seat: 'white' | 'black' = game.whiteParticipantId ? 'black' : 'white';
		await requireOnlineAvailable(ctx, [game.creatorParticipantId, participantId]);
		await settleWaitingSearches(ctx, game.creatorParticipantId, game._id);
		await settleWaitingSearches(ctx, participantId, game._id);
		const clock =
			game.timeControl && game.timeControl !== 'untimed'
				? initialClock(game.timeControl, Date.now() + START_DELAY_MS)
				: undefined;
		const timeoutJob = clock
			? await armClock(ctx, game._id, clock, 'w', game.revision + 1)
			: undefined;
		await ctx.db.patch(game._id, {
			[seat === 'white' ? 'whiteParticipantId' : 'blackParticipantId']: participantId,
			clock,
			timeoutJob,
			status: 'active',
			startedAt: Date.now(),
			purgeAt: null,
			revision: game.revision + 1
		});
		await ctx.db.patch(invite._id, { status: 'consumed' });
		return { gameId: game._id, seat, revision: game.revision + 1 };
	}
});

export const get = query({
	args: { gameId: v.id('games') },
	returns: v.object({
		game: gameDocument,
		seat: color,
		players: v.object({
			white: v.union(v.string(), v.null()),
			black: v.union(v.string(), v.null())
		})
	}),
	handler: async (ctx, { gameId }) => {
		const { participant } = await currentParticipant(ctx);
		const requested = await ctx.db.get(gameId);
		const root = requested?.roomRootId ? await ctx.db.get(requested.roomRootId) : requested;
		const game = root?.currentGameId ? await ctx.db.get(root.currentGameId) : root;
		const seat = game && participant ? seatOf(game, participant._id) : null;
		if (!game || !seat) throw new ConvexError('MATCH_NOT_FOUND');
		return {
			game,
			seat,
			players: {
				white: game.whiteParticipantId ? await participantName(ctx, game.whiteParticipantId) : null,
				black: game.blackParticipantId ? await participantName(ctx, game.blackParticipantId) : null
			}
		};
	}
});

export const getInvitation = query({
	args: { gameId: v.id('games') },
	returns: v.union(v.null(), v.string()),
	handler: async (ctx, { gameId }) => {
		const { participant } = await currentParticipant(ctx);
		const game = await ctx.db.get(gameId);
		if (!game || game.creatorParticipantId !== participant?._id)
			throw new ConvexError('MATCH_NOT_FOUND');
		if (game.status !== 'waiting' || Date.now() >= game.expiresAt) return null;
		return await invitationToken(participant._id, game.createRequestId);
	}
});

export const cancel = mutation({
	args: { gameId: v.id('games'), expectedRevision: v.number() },
	returns: v.null(),
	handler: async (ctx, { gameId, expectedRevision }) => {
		const { participant } = await currentParticipant(ctx);
		const game = await ctx.db.get(gameId);
		if (!game || participant?._id !== game.creatorParticipantId)
			throw new ConvexError('MATCH_NOT_FOUND');
		if (game.result?.reason === 'cancellation' && game.result.detail === 'creatorCancelled')
			return null;
		if (game.revision !== expectedRevision) throw new ConvexError('STALE_REVISION');
		if (game.status !== 'waiting') throw new ConvexError('MATCH_NOT_WAITING');
		await ctx.db.patch(gameId, {
			status: 'finished',
			result: { reason: 'cancellation', winner: null, detail: 'creatorCancelled' },
			purgeAt: Date.now() + 7 * 86400000,
			finishedAt: Date.now(),
			revision: game.revision + 1
		});
		const invite = await ctx.db
			.query('invites')
			.withIndex('by_game', (q) => q.eq('gameId', gameId))
			.unique();
		if (invite) await ctx.db.patch(invite._id, { status: 'revoked' });
		return null;
	}
});

export const expireWaiting = internalMutation({
	args: { gameId: v.id('games') },
	returns: v.null(),
	handler: async (ctx, { gameId }) => {
		const game = await ctx.db.get(gameId);
		if (!game || game.status !== 'waiting' || Date.now() < game.expiresAt) return null;
		await ctx.db.patch(gameId, {
			status: 'finished',
			result: { reason: 'cancellation', winner: null, detail: 'inviteExpired' },
			purgeAt: game.expiresAt + 7 * 86400000,
			finishedAt: Date.now(),
			revision: game.revision + 1
		});
		const invite = await ctx.db
			.query('invites')
			.withIndex('by_game', (q) => q.eq('gameId', gameId))
			.unique();
		if (invite) await ctx.db.patch(invite._id, { status: 'expired' });
		return null;
	}
});

/** Compare-and-swap on the finished game makes simultaneous rematch requests idempotent. */
export const rematch = mutation({
	args: { roomId: v.id('games'), expectedGameId: v.id('games') },
	returns: v.id('games'),
	handler: async (ctx, { roomId, expectedGameId }) => {
		const { game: requested, participant } = await requireMatch(ctx, roomId);
		const root = requested.roomRootId ? await ctx.db.get(requested.roomRootId) : requested;
		if (!root) throw new ConvexError('MATCH_NOT_FOUND');
		const current = root.currentGameId ? await ctx.db.get(root.currentGameId) : root;
		if (!current) throw new ConvexError('MATCH_NOT_FOUND');
		if (current._id !== expectedGameId) return current._id;
		if (current.status !== 'finished') throw new ConvexError('MATCH_NOT_FINISHED');
		if (
			current.result?.reason === 'cancellation' ||
			!current.whiteParticipantId ||
			!current.blackParticipantId
		)
			throw new ConvexError('ROOM_CLOSED');
		const seat = seatOf(current, participant._id)!;
		if (!current.rematchRequestedBy) {
			await ctx.db.patch(current._id, { rematchRequestedBy: seat });
			return current._id;
		}
		if (current.rematchRequestedBy === seat) return current._id;
		await requireOnlineAvailable(ctx, [current.whiteParticipantId, current.blackParticipantId]);
		await limitCreation(ctx, participant._id);
		const initial = createInitialState(),
			round = (current.round ?? 1) + 1;
		const clock =
			current.timeControl && current.timeControl !== 'untimed'
				? initialClock(current.timeControl, Date.now() + START_DELAY_MS)
				: undefined;
		const gameId = await ctx.db.insert('games', {
			...initial,
			timeControl: current.timeControl,
			kind: current.kind,
			clock,
			board: [...initial.board],
			positionKeys: [...initial.positionKeys],
			roomRootId: root._id,
			round,
			creatorParticipantId: root.creatorParticipantId,
			createRequestId: `room:${root._id}:${round}`,
			whiteParticipantId: current.blackParticipantId,
			blackParticipantId: current.whiteParticipantId,
			status: 'active',
			revision: 0,
			expiresAt: root.expiresAt,
			startedAt: Date.now(),
			finishedAt: null,
			purgeAt: null
		});
		await settleWaitingSearches(ctx, current.whiteParticipantId, gameId);
		await settleWaitingSearches(ctx, current.blackParticipantId, gameId);
		if (clock)
			await ctx.db.patch(gameId, { timeoutJob: await armClock(ctx, gameId, clock, 'w', 0) });
		await ctx.db.patch(root._id, {
			currentGameId: gameId,
			roomRootId: root._id,
			round: root.round ?? 1
		});
		return gameId;
	}
});

export const dismissRematch = mutation({
	args: { gameId: v.id('games') },
	returns: v.null(),
	handler: async (ctx, { gameId }) => {
		const { game } = await requireMatch(ctx, gameId);
		if (game.status === 'finished' && game.rematchRequestedBy) {
			await ctx.db.patch(gameId, { rematchRequestedBy: undefined });
		}
		return null;
	}
});

export const roomScore = query({
	args: { roomId: v.id('games') },
	returns: v.object({ you: v.number(), opponent: v.number(), games: v.number() }),
	handler: async (ctx, { roomId }) => {
		const { game, participant } = await requireMatch(ctx, roomId);
		const root = game.roomRootId ? await ctx.db.get(game.roomRootId) : game;
		if (!root) throw new ConvexError('MATCH_NOT_FOUND');
		const rounds = await ctx.db
			.query('games')
			.withIndex('by_room_round', (q) => q.eq('roomRootId', root._id))
			.collect();
		if (!rounds.some((round) => round._id === root._id)) rounds.push(root);
		const score = { you: 0, opponent: 0, games: 0 };
		for (const round of rounds) {
			if (round.status !== 'finished' || !round.result || round.result.reason === 'cancellation')
				continue;
			score.games++;
			if (round.result.winner) {
				const winner =
					round.result.winner === 'white' ? round.whiteParticipantId : round.blackParticipantId;
				score[winner === participant._id ? 'you' : 'opponent']++;
			} else {
				score.you += 0.5;
				score.opponent += 0.5;
			}
		}
		return score;
	}
});
