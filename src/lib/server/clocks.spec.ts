import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api, internal } from '../../convex/_generated/api';
import { START_DELAY_MS } from '../online/time-controls';

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'test-only-clock-invitation-secret');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
async function players() {
	const t = setup(),
		white = await guest(t),
		black = await guest(t);
	const room = await white.mutation(api.games.create, {
		seat: 'white',
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	return { t, white, black, room };
}
it('starts only after joining and the countdown, charges once, and adds increment once', async () => {
	const { t, white, black, room } = await players();
	const waiting = (await white.query(api.games.get, { gameId: room.gameId })).game;
	expect(waiting.clock).toEqual({ whiteMs: 180000, blackMs: 180000, turnStartedAt: null });
	vi.setSystemTime(Date.now() + 60000);
	await black.mutation(api.games.join, { token: room.token });
	const move = {
		gameId: room.gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	};
	await expect(white.mutation(api.moves.submit, move)).rejects.toThrow('GAME_NOT_STARTED');
	vi.setSystemTime(Date.now() + START_DELAY_MS + 1000);
	const receipt = await white.mutation(api.moves.submit, move);
	const after = (await white.query(api.games.get, { gameId: room.gameId })).game;
	expect(after.clock?.whiteMs).toBe(181000);
	expect(after.clock?.blackMs).toBe(180000);
	vi.setSystemTime(Date.now() + 5000);
	expect(await white.mutation(api.moves.submit, move)).toEqual(receipt);
	expect((await white.query(api.games.get, { gameId: room.gameId })).game.clock).toEqual(
		after.clock
	);
	await t.mutation(internal.clocks.expire, { gameId: room.gameId, revision: 1 });
	expect((await white.query(api.games.get, { gameId: room.gameId })).game.status).toBe('active');
});
it('persists a timeout when a move arrives at the deadline, without applying the move', async () => {
	const { white, black, room } = await players();
	await black.mutation(api.games.join, { token: room.token });
	const before = (await white.query(api.games.get, { gameId: room.gameId })).game;
	vi.setSystemTime(before.clock!.turnStartedAt! + 180000);
	const request = {
		gameId: room.gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	};
	const result = await white.mutation(api.moves.submit, request);
	expect(result.result).toEqual({ reason: 'timeout', winner: 'black' });
	expect(await white.mutation(api.moves.submit, request)).toEqual(result);
	expect(
		await white.query(api.moves.receipt, { gameId: room.gameId, requestId: request.requestId })
	).toEqual(result);
	await expect(
		white.mutation(api.moves.submit, { ...request, move: { from: 0, to: 16 } })
	).rejects.toThrow('REQUEST_ID_REUSED');
	const after = (await white.query(api.games.get, { gameId: room.gameId })).game;
	expect(after.board).toEqual(before.board);
	expect(after.ply).toBe(0);
	expect(after.status).toBe('finished');
	expect(after.clock?.whiteMs).toBe(0);
});
it('finishes through the scheduler and draws if the opponent has only a king', async () => {
	const { t, white, black, room } = await players();
	await black.mutation(api.games.join, { token: room.token });
	const game = (await white.query(api.games.get, { gameId: room.gameId })).game;
	await t.run((ctx) =>
		ctx.db.patch(room.gameId, {
			board: game.board.map((piece) => (piece?.c === 'b' && piece.t !== 'k' ? null : piece))
		})
	);
	vi.setSystemTime(game.clock!.turnStartedAt! + 180000);
	await t.mutation(internal.clocks.expire, { gameId: room.gameId, revision: game.revision });
	expect((await white.query(api.games.get, { gameId: room.gameId })).game.result).toEqual({
		reason: 'draw',
		winner: null,
		detail: 'timeoutNoMaterial'
	});
});
it('resets clocks on accepted rematches and rejects changes to retried invitation settings', async () => {
	const { white, black, room } = await players();
	await black.mutation(api.games.join, { token: room.token });
	vi.setSystemTime(Date.now() + START_DELAY_MS + 2000);
	await black.mutation(api.games.resign, {
		gameId: room.gameId,
		expectedRevision: 1,
		requestId: randomUUID()
	});
	const offer = { roomId: room.gameId, expectedGameId: room.gameId };
	await white.mutation(api.games.rematch, offer);
	await black.mutation(api.games.rematch, offer);
	const next = await white.query(api.games.get, { gameId: room.gameId });
	expect(next.seat).toBe('black');
	expect(next.game.timeControl).toBe('3+2');
	expect(next.game.clock).toEqual({
		whiteMs: 180000,
		blackMs: 180000,
		turnStartedAt: Date.now() + START_DELAY_MS
	});
	const requestId = randomUUID();
	await white.mutation(api.games.create, { seat: 'white', requestId, timeControl: '5+3' });
	await expect(
		white.mutation(api.games.create, { seat: 'white', requestId, timeControl: '3+2' })
	).rejects.toThrow('REQUEST_ID_REUSED');
});

it('serializes a move against the timeout job at the exact deadline', async () => {
	const { t, white, black, room } = await players();
	await black.mutation(api.games.join, { token: room.token });
	const game = (await white.query(api.games.get, { gameId: room.gameId })).game;
	vi.setSystemTime(game.clock!.turnStartedAt! + 180000);
	await Promise.allSettled([
		white.mutation(api.moves.submit, {
			gameId: room.gameId,
			expectedRevision: 1,
			requestId: randomUUID(),
			move: { from: 0, to: 32 }
		}),
		t.mutation(internal.clocks.expire, { gameId: room.gameId, revision: 1 })
	]);
	const after = (await white.query(api.games.get, { gameId: room.gameId })).game;
	expect(after).toMatchObject({
		ply: 0,
		revision: 2,
		status: 'finished',
		result: { reason: 'timeout', winner: 'black' }
	});
	expect(await t.run((ctx) => ctx.db.query('moves').collect())).toHaveLength(0);
});

it('ends an unattended game through its scheduled job without any client request', async () => {
	const { t, white, black, room } = await players();
	await black.mutation(api.games.join, { token: room.token });
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	const game = (await white.query(api.games.get, { gameId: room.gameId })).game;
	expect(game.result).toEqual({ reason: 'timeout', winner: 'black' });
	expect(game.clock).toMatchObject({ whiteMs: 0, blackMs: 180000, turnStartedAt: null });
});
