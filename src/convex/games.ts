import { ConvexError, v } from 'convex/values';
import { createInitialState } from '../lib/chess';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { currentParticipant, ensureParticipant } from './lib/participants';
import { invitationToken, tokenHash, validateRequestId } from './lib/invitations';
import { color, gameDocument, seatReceipt } from './lib/validators';

const WAITING_LIFETIME_MS = 24 * 60 * 60 * 1000;

function seatOf(game: Doc<'games'>, participantId: Id<'participants'>) {
	if (game.whiteParticipantId === participantId) return 'white' as const;
	if (game.blackParticipantId === participantId) return 'black' as const;
	return null;
}

export const create = mutation({
	args: { requestId: v.string(), seat: color },
	returns: v.object({
		gameId: v.id('games'),
		token: v.string(),
		seat: color,
		expiresAt: v.number()
	}),
	handler: async (ctx, { requestId, seat }) => {
		validateRequestId(requestId);
		const participantId = await ensureParticipant(ctx);
		const existing = await ctx.db
			.query('games')
			.withIndex('by_creator_request', (q) =>
				q.eq('creatorParticipantId', participantId).eq('createRequestId', requestId)
			)
			.unique();
		if (existing && seatOf(existing, participantId) !== seat)
			throw new ConvexError('REQUEST_ID_REUSED');
		const token = await invitationToken(participantId, requestId);
		if (existing) return { gameId: existing._id, token, seat, expiresAt: existing.expiresAt };
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
			whiteParticipantId: seat === 'white' ? participantId : null,
			blackParticipantId: seat === 'black' ? participantId : null,
			status: 'waiting',
			revision: 0,
			expiresAt,
			startedAt: null,
			finishedAt: null
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
		if (existingSeat) return { gameId: game._id, seat: existingSeat, revision: game.revision };
		if (game.whiteParticipantId && game.blackParticipantId) throw new ConvexError('MATCH_FULL');
		if (game.status !== 'waiting' || invite.status !== 'open')
			throw new ConvexError('INVITE_CLOSED');
		if (Date.now() >= invite.expiresAt) throw new ConvexError('INVITE_EXPIRED');
		const seat: 'white' | 'black' = game.whiteParticipantId ? 'black' : 'white';
		await ctx.db.patch(game._id, {
			[seat === 'white' ? 'whiteParticipantId' : 'blackParticipantId']: participantId,
			status: 'active',
			startedAt: Date.now(),
			revision: game.revision + 1
		});
		await ctx.db.patch(invite._id, { status: 'consumed' });
		return { gameId: game._id, seat, revision: game.revision + 1 };
	}
});

export const get = query({
	args: { gameId: v.id('games') },
	returns: v.object({ game: gameDocument, seat: color }),
	handler: async (ctx, { gameId }) => {
		const { participant } = await currentParticipant(ctx);
		const game = await ctx.db.get(gameId);
		const seat = game && participant ? seatOf(game, participant._id) : null;
		if (!game || !seat) throw new ConvexError('MATCH_NOT_FOUND');
		return { game, seat };
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
