import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { setup, guest } from './test-helpers';
import { legalMoves } from '../chess';
import { presenceFor } from '../../convex/lib/presence';
import { reconnectGrace, presentAt, extendCoverage } from '../online/disconnect';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
	vi.stubEnv('INVITE_SECRET', 'disconnect-test-only-invitation-secret');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
async function game() {
	const t = setup(),
		a = await guest(t),
		b = await guest(t);
	await a.mutation(api.matchmaking.join, {
		requestId: randomUUID(),
		timeControl: '3+2',
		presenceVersion: 1
	});
	const found = await b.mutation(api.matchmaking.join, {
		requestId: randomUUID(),
		timeControl: '3+2',
		presenceVersion: 1
	});
	const gameId = found.gameId!;
	const view = await a.query(api.games.get, { gameId });
	const white = view.seat === 'white' ? a : b,
		black = view.seat === 'white' ? b : a;
	const ids = { white: randomUUID(), black: randomUUID() };
	const seq = new Map<string, number>();
	const get = async () => (await white.query(api.games.get, { gameId })).game;
	const state = () => t.run((ctx) => presenceFor(ctx, gameId));
	const beat = async (side: 'white' | 'black', at = Date.now(), sessionId = ids[side]) => {
		vi.setSystemTime(at);
		const sequence = (seq.get(sessionId) ?? 0) + 1;
		seq.set(sessionId, sequence);
		return await (side === 'white' ? white : black).mutation(api.presence.heartbeat, {
			gameId,
			sessionId,
			sequence,
			version: 1
		});
	};
	await beat('white');
	await beat('black');
	const move = async (side: 'white' | 'black', at = Date.now()) => {
		vi.setSystemTime(at);
		const g = await get();
		const request = {
			gameId,
			expectedRevision: g.revision,
			requestId: randomUUID(),
			sessionId: ids[side],
			move: legalMoves(g.board, g.turn)[0]
		};
		const receipt = await (side === 'white' ? white : black).mutation(api.moves.submit, request);
		return { request, receipt };
	};
	const first = await move('white', view.game.clock!.turnStartedAt! + 1);
	await move('black', Date.now() + 1000);
	const baseline = Date.now();
	const resolve = async (at: number) => {
		vi.setSystemTime(at);
		const g = await get();
		await t.mutation(internal.clocks.expire, { gameId, revision: g.revision });
	};
	return { t, a, b, white, black, ids, gameId, get, state, beat, move, resolve, baseline, first };
}
it('uses 30/42/80 second grace and half-open coverage without filling gaps', () => {
	expect(['3+2', '5+3', '10+5'].map((c) => reconnectGrace(c as '3+2'))).toEqual([
		30000, 42000, 80000
	]);
	const coverage = extendCoverage([{ start: 0, end: 30 }], 40);
	expect(presentAt(coverage, 30)).toBe(false);
	expect(presentAt(coverage, 35)).toBe(false);
	expect(presentAt(coverage, 40)).toBe(true);
});
it('uses historical opponent coverage when a disconnect job runs late', async () => {
	const f = await game();
	const deadline = (await f.state())!.white.at(-1)!.end + 30000;
	await f.beat('black', deadline - 15000);
	await f.resolve(deadline + 25000);
	const ended = await f.get();
	expect(ended.result).toEqual({ reason: 'abandonment', detail: 'disconnect', winner: 'black' });
	expect(ended.termination?.responsibleParticipantId).toBe(ended.whiteParticipantId);
	expect(ended.clock!.whiteMs).toBeGreaterThan(0);
	expect(await f.state()).toBeNull();
});
it.each([-1, 0, 1])(
	'handles reconnect %i ms from expiry before renewing presence',
	async (offset) => {
		const f = await game();
		const deadline = (await f.state())!.white.at(-1)!.end + 30000;
		await f.beat('black', deadline - 10000);
		await f.beat('white', deadline + offset);
		expect((await f.get()).status).toBe(offset < 0 ? 'active' : 'finished');
		if (offset < 0) expect((await f.state())?.candidate).toBeUndefined();
		else expect((await f.get()).result?.reason).toBe('abandonment');
	}
);
it('discards both-absent candidates and restarts only on an opponent presence transition', async () => {
	const f = await game();
	const deadline = (await f.state())!.white.at(-1)!.end + 30000;
	await f.resolve(deadline);
	expect((await f.state())?.candidate?.state).toBe('waitingOpponent');
	expect((await f.get()).status).toBe('active');
	await f.beat('black', deadline + 1000);
	const restarted = (await f.state())!.candidate!;
	expect(restarted.deadline).toBe(deadline + 31000);
	await f.beat('black', deadline + 5000);
	await f.beat('black', deadline + 6000, randomUUID());
	expect((await f.state())!.candidate!.deadline).toBe(restarted.deadline);
	await f.resolve(restarted.deadline);
	expect((await f.get()).result?.reason).toBe('abandonment');
});
it('does not suppress ordinary clock losses when both players disappear', async () => {
	const f = await game();
	const g = await f.get();
	await f.resolve(g.clock!.turnStartedAt! + g.clock!.whiteMs);
	expect((await f.get()).result).toEqual({ reason: 'timeout', winner: 'black' });
});
it('starts a full grace on the absent player’s turn, not during the opponent’s turn', async () => {
	const f = await game();
	await f.beat('white', f.baseline + 25000);
	await f.move('white', f.baseline + 35000);
	expect((await f.state())!.candidate).toMatchObject({
		side: 'black',
		deadline: f.baseline + 65000,
		state: 'armed'
	});
});
it('keeps any valid tab present, bounds sessions, and ignores stale heartbeat sequences', async () => {
	const f = await game();
	await f.beat('white', f.baseline + 10000, randomUUID());
	const revision = (await f.get()).revision;
	await f.resolve(f.baseline + 30000);
	expect((await f.state())!.whiteOnline).toBe(true);
	expect((await f.get()).revision).toBe(revision);
	const before = (await f.state())!.white;
	await f.white.mutation(api.presence.heartbeat, {
		gameId: f.gameId,
		sessionId: f.ids.white,
		sequence: 1,
		version: 1
	});
	expect((await f.state())!.white).toEqual(before);
	for (let i = 0; i < 7; i++) await f.beat('black', Date.now(), randomUUID());
	await f.beat('black', Date.now(), randomUUID());
	await expect(f.beat('black', Date.now(), randomUUID())).rejects.toThrow('TOO_MANY_PLAYING_TABS');
});
it('duplicate move receipts do not renew presence; accepted moves do', async () => {
	const f = await game();
	const before = (await f.state())!.white;
	vi.setSystemTime(f.baseline + 5000);
	expect(await f.white.mutation(api.moves.submit, f.first.request)).toEqual(f.first.receipt);
	expect((await f.state())!.white).toEqual(before);
	await f.move('white');
	expect((await f.state())!.white.at(-1)!.end).toBe(Date.now() + 30000);
});
it('resolves clock/disconnect ties as clock expiry and draws against a bare king', async () => {
	const f = await game();
	const deadline = (await f.state())!.white.at(-1)!.end + 30000;
	await f.beat('black', deadline - 10000);
	const g = await f.get();
	await f.t.run((ctx) =>
		ctx.db.patch(g._id, { clock: { ...g.clock!, whiteMs: deadline - g.clock!.turnStartedAt! } })
	);
	await f.resolve(deadline);
	expect((await f.get()).result?.reason).toBe('timeout');
	const other = await game();
	const d = (await other.state())!.white.at(-1)!.end + 30000;
	await other.beat('black', d - 10000);
	const h = await other.get();
	await other.t.run((ctx) =>
		ctx.db.patch(h._id, { board: h.board.map((p) => (p?.c === 'b' && p.t !== 'k' ? null : p)) })
	);
	await other.resolve(d);
	expect((await other.get()).result).toEqual({
		reason: 'draw',
		winner: null,
		detail: 'disconnectNoMaterial'
	});
});
it('schedules unattended forfeits and maintains a valid wake-up across heartbeats', async () => {
	const f = await game();
	const p = (await f.state())!;
	await f.beat('black', f.baseline + 25000);
	expect((await f.state())!.wakeId).toBe(p.wakeId);
	await f.beat('black', f.baseline + 45000);
	await f.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect((await f.get()).result?.reason).toBe('abandonment');
});
it('incident epochs exempt untouched active games permanently and pause new pairing', async () => {
	const f = await game();
	await f.t.mutation(internal.presence.setEnabled, { enabled: false });
	const newcomer = await guest(f.t);
	await expect(
		newcomer.mutation(api.matchmaking.join, {
			requestId: randomUUID(),
			timeControl: '3+2',
			presenceVersion: 1
		})
	).rejects.toThrow('MATCHMAKING_PAUSED');
	await f.t.mutation(internal.presence.setEnabled, { enabled: true });
	const deadline = (await f.state())!.white.at(-1)!.end + 30000;
	await f.resolve(deadline + 1);
	expect((await f.get()).status).toBe('active');
	expect((await f.white.query(api.presence.status, { gameId: f.gameId })).enforced).toBe(false);
});
it('rejects old clients and spectators; old game sessions do not carry into a rematch', async () => {
	const f = await game();
	const outsider = await guest(f.t);
	await expect(
		outsider.mutation(api.matchmaking.join, { requestId: randomUUID(), timeControl: '3+2' })
	).rejects.toThrow('CLIENT_UPDATE_REQUIRED');
	await expect(
		outsider.mutation(api.presence.heartbeat, {
			gameId: f.gameId,
			sessionId: randomUUID(),
			sequence: 1,
			version: 1
		})
	).rejects.toThrow();
	const old = (await f.state())!;
	await f.black.mutation(api.games.resign, {
		gameId: f.gameId,
		expectedRevision: (await f.get()).revision,
		requestId: randomUUID()
	});
	await f.white.mutation(api.games.rematch, {
		roomId: f.gameId,
		expectedGameId: f.gameId,
		presenceVersion: 1
	});
	const next = await f.black.mutation(api.games.rematch, {
		roomId: f.gameId,
		expectedGameId: f.gameId,
		presenceVersion: 1
	});
	expect(await f.beat('white')).toEqual({ active: false });
	await f.t.mutation(internal.presence.wake, { gameId: f.gameId, generation: old.generation });
	expect((await f.t.run((ctx) => ctx.db.get(next)))?.status).toBe('active');
	expect(await f.t.run((ctx) => presenceFor(ctx, next))).toBeNull();
});

it('does not award a disconnect win when the opponent lease expires exactly at the deadline', async () => {
	const f = await game();
	const deadline = (await f.state())!.white.at(-1)!.end + 30000;
	await f.beat('black', deadline - 30000);
	await f.resolve(deadline);
	expect((await f.get()).status).toBe('active');
	expect((await f.state())!.candidate!.state).toBe('waitingOpponent');
});
