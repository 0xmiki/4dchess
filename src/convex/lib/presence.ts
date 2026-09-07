import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { cancelClockJob } from './clock_jobs';
import { consume } from './limits';
import {
	currentCandidate,
	extendCoverage,
	presentAt,
	pruneCoverage,
	reconnectGrace,
	MAX_PLAYING_SESSIONS,
	PRESENCE_LEASE_MS,
	type PresenceSide
} from '../../lib/online/disconnect';

export async function policy(ctx: QueryCtx | MutationCtx) {
	return (
		(await ctx.db
			.query('onlinePolicy')
			.withIndex('by_key', (q) => q.eq('key', 'disconnect'))
			.unique()) ?? { enabled: true, epoch: 1 }
	);
}
export async function matchmakingPolicy(ctx: MutationCtx, version?: number) {
	if (version !== 1) throw new ConvexError('CLIENT_UPDATE_REQUIRED');
	const config = await policy(ctx);
	if (!config.enabled) throw new ConvexError('MATCHMAKING_PAUSED');
	return config.epoch;
}
export async function presenceFor(ctx: QueryCtx | MutationCtx, gameId: Id<'games'>) {
	return await ctx.db
		.query('gamePresence')
		.withIndex('by_game', (q) => q.eq('gameId', gameId))
		.unique();
}
export async function enforced(ctx: QueryCtx | MutationCtx, game: Doc<'games'>) {
	if (game.kind !== 'matchmaking' || game.disconnectEpoch === undefined || game.status !== 'active')
		return false;
	const config = await policy(ctx);
	return config.enabled && config.epoch === game.disconnectEpoch;
}
export async function clearPresence(ctx: MutationCtx, gameId: Id<'games'>) {
	const presence = await presenceFor(ctx, gameId);
	if (presence) {
		await cancelClockJob(ctx, presence.wakeId);
		await ctx.db.delete(presence._id);
	}
	const sessions = await ctx.db
		.query('gameSessions')
		.withIndex('by_game', (q) => q.eq('gameId', gameId))
		.take(32);
	for (const session of sessions) await ctx.db.delete(session._id);
}
async function schedule(ctx: MutationCtx, presence: Doc<'gamePresence'>, now: number) {
	const deadlines = [
		presence.white.at(-1)?.end,
		presence.black.at(-1)?.end,
		presence.candidate?.state === 'armed' ? presence.candidate.deadline : undefined
	].filter((value): value is number => value !== undefined && value > now);
	const next = deadlines.length ? Math.min(...deadlines) : undefined;
	const current = presence.wakeId ? await ctx.db.system.get(presence.wakeId) : null;
	if (next !== undefined && current?.state.kind === 'pending' && presence.wakeAt! <= next) return;
	await cancelClockJob(ctx, presence.wakeId);
	const generation = presence.generation + 1;
	const wakeId =
		next === undefined
			? undefined
			: await ctx.scheduler.runAt(next, internal.presence.wake, {
					gameId: presence.gameId,
					generation
				});
	await ctx.db.patch(presence._id, { wakeId, wakeAt: next, generation });
}

/** Resolves presence evidence before any fresh heartbeat or move can overwrite it. */
export async function disconnectDeadline(
	ctx: MutationCtx,
	game: Doc<'games'>,
	now: number
): Promise<number | undefined> {
	if (!(await enforced(ctx, game))) {
		if (game.disconnectEpoch !== undefined) await clearPresence(ctx, game._id);
		return undefined;
	}
	const p = await presenceFor(ctx, game._id);
	if (!p) return undefined;
	const side = game.turn === 'w' ? 'white' : 'black',
		other = side === 'white' ? 'black' : 'white';
	let candidate =
		game.ply >= 2 &&
		game.clock?.turnStartedAt != null &&
		game.timeControl &&
		game.timeControl !== 'untimed'
			? currentCandidate(
					p.candidate,
					p[side],
					side,
					game.clock.turnStartedAt,
					now,
					reconnectGrace(game.timeControl)
				)
			: undefined;
	if (candidate?.state === 'armed' && candidate.deadline <= now) {
		if (presentAt(p[other], candidate.deadline)) return candidate.deadline;
		candidate = { ...candidate, state: 'waitingOpponent' };
	}
	const patch = {
		candidate,
		whiteOnline: presentAt(p.white, now),
		blackOnline: presentAt(p.black, now),
		white: pruneCoverage(p.white, now, candidate),
		black: pruneCoverage(p.black, now, candidate)
	};
	await ctx.db.patch(p._id, patch);
	await schedule(ctx, { ...p, ...patch }, now);
	return undefined;
}

export async function requirePlayingSession(
	ctx: MutationCtx,
	game: Doc<'games'>,
	participantId: Id<'participants'>,
	sessionId?: string
) {
	if (!(await enforced(ctx, game))) return;
	if (!sessionId) throw new ConvexError('PRESENCE_REQUIRED');
	const session = await ctx.db
		.query('gameSessions')
		.withIndex('by_session', (q) =>
			q.eq('gameId', game._id).eq('participantId', participantId).eq('sessionId', sessionId)
		)
		.unique();
	if (!session) throw new ConvexError('PRESENCE_REQUIRED');
}

export async function renewPresence(
	ctx: MutationCtx,
	game: Doc<'games'>,
	participantId: Id<'participants'>,
	sessionId: string,
	now: number,
	sequence?: number
) {
	if (!(await enforced(ctx, game))) return;
	const side: PresenceSide = game.whiteParticipantId === participantId ? 'white' : 'black';
	const session = await ctx.db
		.query('gameSessions')
		.withIndex('by_session', (q) =>
			q.eq('gameId', game._id).eq('participantId', participantId).eq('sessionId', sessionId)
		)
		.unique();
	if (session && sequence !== undefined && sequence <= session.sequence) return;
	if (!session || session.expiresAt <= now) {
		if (!session && sequence === undefined) throw new ConvexError('PRESENCE_REQUIRED');
		const old = await ctx.db
			.query('gameSessions')
			.withIndex('by_player_expiry', (q) =>
				q.eq('gameId', game._id).eq('participantId', participantId).lte('expiresAt', now)
			)
			.take(32);
		for (const row of old) if (row._id !== session?._id) await ctx.db.delete(row._id);
		const active = await ctx.db
			.query('gameSessions')
			.withIndex('by_player_expiry', (q) =>
				q.eq('gameId', game._id).eq('participantId', participantId).gt('expiresAt', now)
			)
			.take(MAX_PLAYING_SESSIONS);
		if (active.length >= MAX_PLAYING_SESSIONS) throw new ConvexError('TOO_MANY_PLAYING_TABS');
		if (!(await consume(ctx, `presence-session:${participantId}`, 16, 60000)).ok)
			throw new ConvexError('PRESENCE_RATE_LIMITED');
	}
	if (!session) {
		await ctx.db.insert('gameSessions', {
			gameId: game._id,
			participantId,
			sessionId,
			sequence: sequence!,
			expiresAt: now + PRESENCE_LEASE_MS
		});
	} else
		await ctx.db.patch(session._id, {
			sequence: sequence ?? session.sequence,
			expiresAt: now + PRESENCE_LEASE_MS
		});
	let p = await presenceFor(ctx, game._id);
	if (!p) {
		const id = await ctx.db.insert('gamePresence', {
			gameId: game._id,
			white: [],
			black: [],
			whiteOnline: false,
			blackOnline: false,
			generation: 0
		});
		p = (await ctx.db.get(id))!;
	}
	let candidate = p.candidate;
	const wasOnline = presentAt(p[side], now);
	if (candidate?.side === side) candidate = undefined;
	else if (
		candidate?.state === 'waitingOpponent' &&
		!wasOnline &&
		game.timeControl &&
		game.timeControl !== 'untimed'
	) {
		candidate = {
			...candidate,
			state: 'armed',
			deadline: Math.max(now, game.clock?.turnStartedAt ?? now) + reconnectGrace(game.timeControl)
		};
	}
	await ctx.db.patch(p._id, {
		[side]: extendCoverage(p[side], now),
		[side === 'white' ? 'whiteOnline' : 'blackOnline']: true,
		candidate
	});
}
