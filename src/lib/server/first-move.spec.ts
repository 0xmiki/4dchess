import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api, internal } from '../../convex/_generated/api';
import { FIRST_MOVE_MS } from '../online/first-move';
import { START_DELAY_MS } from '../online/time-controls';
import { legalMoves } from '../chess';

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'first-move-test-only');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
const sessionId = '11111111-1111-4111-8111-111111111111';
async function matched() {
	const t = setup(),
		a = await guest(t),
		b = await guest(t);
	await a.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	const search = await b.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	const gameId = search.gameId!;
	const view = await a.query(api.games.get, { gameId });
	const white = view.seat === 'white' ? a : b,
		black = view.seat === 'black' ? a : b;
	await white.mutation(api.presence.heartbeat, { gameId, sessionId, sequence: 1, version: 1 });
	await black.mutation(api.presence.heartbeat, { gameId, sessionId, sequence: 1, version: 1 });
	const get = async () => (await white.query(api.games.get, { gameId })).game;
	return { t, white, black, gameId, game: view.game, get };
}
it('schedules White after the start countdown and aborts without any client request', async () => {
	const { t, game, get, white, gameId } = await matched();
	expect(game.firstMoveDeadline).toBe(game.startedAt! + START_DELAY_MS + FIRST_MOVE_MS);
	const job = await t.run((ctx) => ctx.db.system.get(game.timeoutJob!));
	expect(job?.scheduledTime).toBe(game.firstMoveDeadline);
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	const ended = await get();
	expect(ended.result).toEqual({ reason: 'aborted', winner: null, detail: 'firstMoveNoShow' });
	expect(ended.termination?.responsibleParticipantId).toBe(game.whiteParticipantId);
	expect(ended.ply).toBe(0);
	expect(ended.firstMoveDeadline).toBeUndefined();
	expect(await white.query(api.games.roomScore, { roomId: gameId })).toMatchObject({
		you: 0,
		opponent: 0,
		games: 0
	});
});
it.each([-1, 0, 1])(
	'handles a move %i ms relative to the deadline and preserves its receipt',
	async (offset) => {
		const { white, gameId, game, get } = await matched();
		vi.setSystemTime(game.firstMoveDeadline! + offset);
		const request = {
			sessionId,
			gameId,
			expectedRevision: 0,
			requestId: randomUUID(),
			move: { from: 0, to: 32 }
		};
		const receipt = await white.mutation(api.moves.submit, request);
		expect(receipt.ply).toBe(offset < 0 ? 1 : 0);
		expect(receipt.result?.reason ?? null).toBe(offset < 0 ? null : 'aborted');
		vi.setSystemTime(Date.now() + 1000);
		expect(await white.mutation(api.moves.submit, request)).toEqual(receipt);
		expect(await white.query(api.moves.receipt, { gameId, requestId: request.requestId })).toEqual(
			receipt
		);
		expect((await get()).revision).toBe(1);
	}
);
it('gives Black a full window, ignores invalid moves, and stops only after both legal moves', async () => {
	const { t, white, black, gameId, game, get } = await matched();
	vi.setSystemTime(game.firstMoveDeadline! - 1);
	await white.mutation(api.moves.submit, {
		sessionId,
		gameId,
		expectedRevision: 0,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	});
	const afterWhite = await get();
	expect(afterWhite.firstMoveDeadline).toBe(Date.now() + FIRST_MOVE_MS);
	await expect(
		black.mutation(api.moves.submit, {
			sessionId,
			gameId,
			expectedRevision: 1,
			requestId: randomUUID(),
			move: { from: 0, to: 0 }
		})
	).rejects.toThrow();
	expect((await get()).firstMoveDeadline).toBe(afterWhite.firstMoveDeadline);
	await t.mutation(internal.clocks.expire, { gameId, revision: 0 });
	expect((await get()).status).toBe('active');
	vi.setSystemTime(afterWhite.firstMoveDeadline! - 1);
	const move = legalMoves(afterWhite.board, afterWhite.turn)[0];
	await black.mutation(api.moves.submit, {
		sessionId,
		gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move
	});
	const afterBlack = await get();
	expect(afterBlack.firstMoveDeadline).toBeUndefined();
	vi.setSystemTime(afterWhite.firstMoveDeadline! + 1);
	await t.mutation(internal.clocks.expire, { gameId, revision: 1 });
	expect((await get()).status).toBe('active');
});
it('aborts a Black no-show while retaining White’s accepted move', async () => {
	const { t, white, gameId, game, get } = await matched();
	vi.setSystemTime(game.clock!.turnStartedAt!);
	await white.mutation(api.moves.submit, {
		sessionId,
		gameId,
		expectedRevision: 0,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	});
	const next = await get();
	vi.setSystemTime(next.firstMoveDeadline!);
	await t.mutation(internal.clocks.expire, { gameId, revision: 1 });
	const ended = await get();
	expect(ended).toMatchObject({ ply: 1, result: { reason: 'aborted' } });
	expect(ended.termination?.responsibleParticipantId).toBe(game.blackParticipantId);
	expect(await t.run((ctx) => ctx.db.query('moves').collect())).toHaveLength(1);
});
it.each([-1, 0, 1])(
	'resolves chess-clock expiry %i ms relative to opening expiry deterministically',
	async (offset) => {
		const { t, game, gameId, get } = await matched();
		await t.run((ctx) =>
			ctx.db.patch(gameId, { clock: { ...game.clock!, whiteMs: FIRST_MOVE_MS + offset } })
		);
		vi.setSystemTime(game.firstMoveDeadline! + 5000);
		await t.mutation(internal.clocks.expire, { gameId, revision: 0 });
		expect((await get()).result?.reason).toBe(offset < 0 ? 'timeout' : 'aborted');
	}
);
it('serializes expiry, resignation, and a move into one immutable result', async () => {
	const { t, white, gameId, game, get } = await matched();
	vi.setSystemTime(game.firstMoveDeadline!);
	await Promise.allSettled([
		t.mutation(internal.clocks.expire, { gameId, revision: 0 }),
		white.mutation(api.games.resign, { gameId, expectedRevision: 0, requestId: randomUUID() }),
		white.mutation(api.moves.submit, {
			sessionId,
			gameId,
			expectedRevision: 0,
			requestId: randomUUID(),
			move: { from: 0, to: 32 }
		})
	]);
	expect(await get()).toMatchObject({ revision: 1, ply: 0, result: { reason: 'aborted' } });
	expect(await t.run((ctx) => ctx.db.query('moves').collect())).toHaveLength(0);
});
it('does not retrofit legacy games; new matchmaking rematches get a fresh deadline', async () => {
	const { t, white, black, gameId, game, get } = await matched();
	await t.run((ctx) => ctx.db.patch(gameId, { firstMoveDeadline: undefined }));
	vi.setSystemTime(game.firstMoveDeadline! + 1);
	await t.mutation(internal.clocks.expire, { gameId, revision: 0 });
	expect((await get()).status).toBe('active');
	await black.mutation(api.games.resign, { gameId, expectedRevision: 0, requestId: randomUUID() });
	await white.mutation(api.games.rematch, {
		presenceVersion: 1,
		roomId: gameId,
		expectedGameId: gameId
	});
	const nextId = await black.mutation(api.games.rematch, {
		presenceVersion: 1,
		roomId: gameId,
		expectedGameId: gameId
	});
	const next = await t.run((ctx) => ctx.db.get(nextId));
	expect(next?.firstMoveDeadline).toBe(Date.now() + START_DELAY_MS + FIRST_MOVE_MS);
	expect(next?.whiteParticipantId).toBe(game.blackParticipantId);
});
