import { ConvexError, v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { currentParticipant, ensureParticipant } from './lib/participants';
import { validateRequestId } from './lib/invitations';
import { timedControl } from './lib/validators';
import { consume } from './lib/limits';
import { activeOnlineGame } from './lib/online_availability';
import { initialClock, START_DELAY_MS } from '../lib/online/time-controls';
import { createInitialState } from '../lib/chess';
import { armClock } from './lib/clocks';
import { internal } from './_generated/api';

import { CURRENT_LIFECYCLE_POLICY } from '../lib/online/outcomes';
import { FIRST_MOVE_MS } from '../lib/online/first-move';

const LEASE_MS = 30000;
const stateValidator = v.object({
	id: v.id('matchSearches'),
	status: v.union(v.literal('waiting'), v.literal('matched'), v.literal('cancelled')),
	gameId: v.union(v.id('games'), v.null()),
	timeControl: timedControl,
	expiresAt: v.number(),
	closeReason: v.optional(v.union(v.literal('userCancelled'), v.literal('leaseExpired'))),
	closedAt: v.optional(v.number())
});
function state(row: Doc<'matchSearches'>) {
	return {
		id: row._id,
		status:
			row.status === 'waiting' && row.expiresAt <= Date.now() ? ('cancelled' as const) : row.status,
		gameId: row.gameId ?? null,
		timeControl: row.timeControl,
		expiresAt: row.expiresAt,
		closeReason:
			row.status === 'waiting' && row.expiresAt <= Date.now()
				? ('leaseExpired' as const)
				: row.closeReason,
		closedAt: row.closedAt
	};
}
async function match(
	ctx: MutationCtx,
	search: Doc<'matchSearches'>
): Promise<Doc<'matchSearches'>> {
	const now = Date.now();
	const currentGame = await activeOnlineGame(ctx, search.participantId);
	if (currentGame) {
		await ctx.db.patch(search._id, { status: 'matched', gameId: currentGame });
		return (await ctx.db.get(search._id))!;
	}
	const candidates = await ctx.db
		.query('matchSearches')
		.withIndex('by_pool_expiry', (q) =>
			q.eq('timeControl', search.timeControl).eq('status', 'waiting').gt('expiresAt', now)
		)
		.take(16);
	for (const candidate of candidates) {
		if (candidate.participantId === search.participantId) continue;
		const activeGame = await activeOnlineGame(ctx, candidate.participantId);
		if (activeGame) {
			await ctx.db.patch(candidate._id, { status: 'matched', gameId: activeGame });
			continue;
		}
		const white = Math.random() < 0.5 ? candidate.participantId : search.participantId;
		const black =
			white === candidate.participantId ? search.participantId : candidate.participantId;
		const clock = initialClock(search.timeControl, now + START_DELAY_MS);
		const firstMoveDeadline = now + START_DELAY_MS + FIRST_MOVE_MS;
		const initial = createInitialState();
		const gameId = await ctx.db.insert('games', {
			...initial,
			lifecyclePolicy: CURRENT_LIFECYCLE_POLICY,
			board: [...initial.board],
			positionKeys: [...initial.positionKeys],
			kind: 'matchmaking',
			timeControl: search.timeControl,
			clock,
			firstMoveDeadline,
			creatorParticipantId: candidate.participantId,
			createRequestId: `queue:${candidate._id}:${search._id}`,
			whiteParticipantId: white,
			blackParticipantId: black,
			status: 'active',
			revision: 0,
			expiresAt: now,
			startedAt: now,
			finishedAt: null,
			purgeAt: null
		});
		await ctx.db.patch(gameId, {
			timeoutJob: await armClock(ctx, gameId, clock, 'w', 0, undefined, firstMoveDeadline)
		});
		await ctx.db.patch(candidate._id, { status: 'matched', gameId });
		await ctx.db.patch(search._id, { status: 'matched', gameId });
		return (await ctx.db.get(search._id))!;
	}
	return search;
}
async function ownSearch(ctx: MutationCtx, id: Id<'matchSearches'>) {
	const { participant } = await currentParticipant(ctx);
	const row = await ctx.db.get(id);
	if (!participant || row?.participantId !== participant._id)
		throw new ConvexError('SEARCH_NOT_FOUND');
	return row;
}
export const join = mutation({
	args: { requestId: v.string(), timeControl: timedControl },
	returns: stateValidator,
	handler: async (ctx, { requestId, timeControl }) => {
		validateRequestId(requestId);
		const participantId = await ensureParticipant(ctx);
		const prior = await ctx.db
			.query('matchSearches')
			.withIndex('by_participant_request', (q) =>
				q.eq('participantId', participantId).eq('requestId', requestId)
			)
			.unique();
		if (prior) {
			if (prior.timeControl !== timeControl) throw new ConvexError('REQUEST_ID_REUSED');
			return state(prior);
		}
		const existingGame = await activeOnlineGame(ctx, participantId);
		if (existingGame) {
			if (!(await consume(ctx, `queue:${participantId}`, 12, 60000)).ok)
				throw new ConvexError('RATE_LIMITED');
			const resumed = await ctx.db.insert('matchSearches', {
				participantId,
				requestId,
				timeControl,
				status: 'matched',
				gameId: existingGame,
				expiresAt: Date.now()
			});
			return state((await ctx.db.get(resumed))!);
		}
		const waiting = await ctx.db
			.query('matchSearches')
			.withIndex('by_participant_status', (q) =>
				q.eq('participantId', participantId).eq('status', 'waiting')
			)
			.first();
		if (waiting && waiting.expiresAt > Date.now()) return state(waiting);
		if (waiting)
			await ctx.db.patch(waiting._id, {
				status: 'cancelled',
				closeReason: 'leaseExpired',
				closedAt: Date.now()
			});
		if (!(await consume(ctx, `queue:${participantId}`, 12, 60000)).ok)
			throw new ConvexError('RATE_LIMITED');
		const id = await ctx.db.insert('matchSearches', {
			participantId,
			requestId,
			timeControl,
			status: 'waiting',
			expiresAt: Date.now() + LEASE_MS
		});
		return state(await match(ctx, (await ctx.db.get(id))!));
	}
});
export const current = query({
	args: {},
	returns: v.union(stateValidator, v.null()),
	handler: async (ctx) => {
		const { participant } = await currentParticipant(ctx);
		if (!participant) return null;
		const row = await ctx.db
			.query('matchSearches')
			.withIndex('by_participant', (q) => q.eq('participantId', participant._id))
			.order('desc')
			.first();
		return row ? state(row) : null;
	}
});
export const heartbeat = mutation({
	args: { id: v.id('matchSearches') },
	returns: stateValidator,
	handler: async (ctx, { id }) => {
		const row = await ownSearch(ctx, id);
		if (row.status !== 'waiting') return state(row);
		if (row.expiresAt <= Date.now()) {
			await ctx.db.patch(id, {
				status: 'cancelled',
				closeReason: 'leaseExpired',
				closedAt: Date.now()
			});
			return state((await ctx.db.get(id))!);
		}
		if (!(await consume(ctx, `queue-heartbeat:${row.participantId}`, 20, 60000)).ok)
			return state(row);
		await ctx.db.patch(id, { expiresAt: Date.now() + LEASE_MS });
		return state(await match(ctx, (await ctx.db.get(id))!));
	}
});
export const cancel = mutation({
	args: {
		id: v.optional(v.id('matchSearches')),
		requestId: v.optional(v.string()),
		timeControl: v.optional(timedControl)
	},
	returns: stateValidator,
	handler: async (ctx, { id, requestId, timeControl }) => {
		let row: Doc<'matchSearches'>;
		if (id) row = await ownSearch(ctx, id);
		else {
			if (!requestId || !timeControl) throw new ConvexError('INVALID_REQUEST_ID');
			validateRequestId(requestId);
			const participantId = await ensureParticipant(ctx);
			const existing = await ctx.db
				.query('matchSearches')
				.withIndex('by_participant_request', (q) =>
					q.eq('participantId', participantId).eq('requestId', requestId)
				)
				.unique();
			if (existing) row = existing;
			else {
				if (!(await consume(ctx, `queue:${participantId}`, 12, 60000)).ok)
					throw new ConvexError('RATE_LIMITED');
				const cancelled = await ctx.db.insert('matchSearches', {
					participantId,
					requestId,
					timeControl,
					status: 'cancelled',
					closeReason: 'userCancelled',
					closedAt: Date.now(),
					expiresAt: Date.now()
				});
				return state((await ctx.db.get(cancelled))!);
			}
		}
		if (row.status === 'waiting') {
			await ctx.db.patch(row._id, {
				status: 'cancelled',
				closeReason: row.expiresAt <= Date.now() ? 'leaseExpired' : 'userCancelled',
				closedAt: Date.now()
			});
			return state((await ctx.db.get(row._id))!);
		}
		return state(row);
	}
});
export const cleanup = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx): Promise<null> => {
		// Retain receipts for a day so stale requests cannot immediately recreate cancelled searches.
		const rows = await ctx.db
			.query('matchSearches')
			.withIndex('by_expiry', (q) => q.lt('expiresAt', Date.now() - 86400000))
			.take(100);
		for (const row of rows) await ctx.db.delete(row._id);
		if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.matchmaking.cleanup, {});
		return null;
	}
});
