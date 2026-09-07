import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api, internal } from '../../convex/_generated/api';
import { finishGame } from '../../convex/lib/lifecycle';
import { exportGame } from '../chess/export';
import { START_DELAY_MS } from '../online/time-controls';

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'test-only-lifecycle-secret');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
async function matched() {
	const t = setup(),
		a = await guest(t),
		b = await guest(t);
	await a.mutation(api.matchmaking.join, { requestId: randomUUID(), timeControl: '3+2' });
	const paired = await b.mutation(api.matchmaking.join, {
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	const gameId = paired.gameId!;
	const view = await a.query(api.games.get, { gameId });
	vi.setSystemTime(Date.now() + START_DELAY_MS + 1);
	return { t, gameId, white: view.seat === 'white' ? a : b, black: view.seat === 'black' ? a : b };
}
it('records resignation once and cannot replace a completed result', async () => {
	const { t, gameId, white, black } = await matched();
	const before = (await white.query(api.games.get, { gameId })).game;
	const request = { gameId, requestId: randomUUID(), expectedRevision: before.revision };
	await black.mutation(api.games.resign, request);
	const finished = (await white.query(api.games.get, { gameId })).game;
	expect(finished.termination).toEqual({
		cause: 'resignation',
		policyVersion: 'online-v1',
		responsibleParticipantId: before.blackParticipantId,
		recordedAt: Date.now(),
		revision: 1
	});
	vi.setSystemTime(Date.now() + 4000);
	expect(await black.mutation(api.games.resign, request)).toBe(1);
	expect(
		await t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 1,
				result: { reason: 'abandonment', winner: 'black', detail: 'disconnect' },
				now: Date.now()
			})
		)
	).toBe(false);
	expect((await white.query(api.games.get, { gameId })).game).toEqual(finished);
});
it.each([0, 1])(
	'keeps a no-show abort at ply %i unscored and retains its position',
	async (ply) => {
		const { t, gameId, white, black } = await matched();
		const moves = ply ? [{ from: 0, to: 32 }] : [];
		if (ply)
			await white.mutation(api.moves.submit, {
				gameId,
				expectedRevision: 0,
				requestId: randomUUID(),
				move: moves[0]
			});
		const before = (await white.query(api.games.get, { gameId })).game;
		expect(
			await t.run((ctx) =>
				finishGame(ctx, {
					gameId,
					expectedRevision: before.revision,
					result: { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' },
					now: Date.now()
				})
			)
		).toBe(true);
		const ended = (await white.query(api.games.get, { gameId })).game;
		expect(ended.board).toEqual(before.board);
		expect(ended.ply).toBe(ply);
		expect(ended.clock?.turnStartedAt).toBeNull();
		expect(ended.termination?.responsibleParticipantId).toBe(
			ply ? before.blackParticipantId : before.whiteParticipantId
		);
		for (const player of [white, black])
			expect(await player.query(api.games.roomScore, { roomId: gameId })).toEqual({
				you: 0,
				opponent: 0,
				games: 0
			});
		expect(exportGame(moves, { result: ended.result })).toContain('[Result "*"]');
		expect(exportGame(moves, { result: ended.result })).not.toContain('1/2-1/2');
		await expect(
			white.mutation(api.games.rematch, { roomId: gameId, expectedGameId: gameId })
		).rejects.toThrow('ROOM_CLOSED');
		await t.mutation(internal.clocks.expire, { gameId, revision: before.revision });
		expect((await white.query(api.games.get, { gameId })).game).toEqual(ended);
	}
);
it('a move and a stale abort request cannot both apply', async () => {
	const { t, gameId, white } = await matched();
	await Promise.allSettled([
		white.mutation(api.moves.submit, {
			gameId,
			expectedRevision: 0,
			requestId: randomUUID(),
			move: { from: 0, to: 32 }
		}),
		t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 0,
				result: { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' },
				now: Date.now()
			})
		)
	]);
	const game = (await white.query(api.games.get, { gameId })).game;
	expect(game.revision).toBe(1);
	if (game.status === 'finished') {
		expect(game.ply).toBe(0);
		expect(game.termination?.cause).toBe('firstMoveNoShow');
	} else {
		expect(game.ply).toBe(1);
		expect(game.termination).toBeUndefined();
	}
});
it('abort, resignation and timeout races produce a single terminal record', async () => {
	const { t, gameId, white, black } = await matched();
	const before = (await white.query(api.games.get, { gameId })).game;
	vi.setSystemTime(before.clock!.turnStartedAt! + before.clock!.whiteMs);
	await Promise.allSettled([
		black.mutation(api.games.resign, { gameId, expectedRevision: 0, requestId: randomUUID() }),
		t.mutation(internal.clocks.expire, { gameId, revision: 0 }),
		t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 0,
				result: { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' },
				now: Date.now()
			})
		)
	]);
	const ended = (await white.query(api.games.get, { gameId })).game;
	expect(ended.status).toBe('finished');
	expect(ended.revision).toBe(1);
	expect(['clockTimeout', 'firstMoveNoShow']).toContain(ended.termination?.cause);
	expect(ended.termination?.responsibleParticipantId).toBe(before.whiteParticipantId);
	await t.mutation(internal.clocks.expire, { gameId, revision: 0 });
	expect((await white.query(api.games.get, { gameId })).game).toEqual(ended);
});
it('preserves legacy games and does not backfill already completed outcomes', async () => {
	const { t, gameId, white, black } = await matched();
	await t.run((ctx) => ctx.db.patch(gameId, { lifecyclePolicy: undefined }));
	expect(
		await t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 0,
				result: { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' },
				now: Date.now()
			})
		)
	).toBe(false);
	await black.mutation(api.games.resign, { gameId, expectedRevision: 0, requestId: randomUUID() });
	expect((await white.query(api.games.get, { gameId })).game.termination?.policyVersion).toBe(
		'legacy-v1'
	);
	await t.run((ctx) => ctx.db.patch(gameId, { termination: undefined }));
	expect(
		await t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 1,
				result: { reason: 'resignation', winner: 'white' },
				now: Date.now()
			})
		)
	).toBe(false);
	expect((await white.query(api.games.get, { gameId })).game.termination).toBeUndefined();
});
it('retains the old outcome when a rematch starts a new game and policy', async () => {
	const { t, gameId, white, black } = await matched();
	await t.run((ctx) => ctx.db.patch(gameId, { lifecyclePolicy: undefined }));
	await black.mutation(api.games.resign, { gameId, expectedRevision: 0, requestId: randomUUID() });
	const old = await t.run((ctx) => ctx.db.get(gameId));
	const args = { roomId: gameId, expectedGameId: gameId };
	await Promise.all([
		white.mutation(api.games.rematch, args),
		black.mutation(api.games.rematch, args)
	]);
	const current = (await white.query(api.games.get, { gameId })).game;
	expect(current._id).not.toBe(gameId);
	expect(current.lifecyclePolicy).toBe('online-v1');
	expect(current.termination).toBeUndefined();
	const previous = await t.run((ctx) => ctx.db.get(gameId));
	expect(previous?.result).toEqual(old?.result);
	expect(previous?.termination).toEqual(old?.termination);
});
it('distinguishes a cancelled search from an expired lease without game outcomes', async () => {
	const t = setup(),
		player = await guest(t);
	const first = await player.mutation(api.matchmaking.join, {
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	expect((await player.mutation(api.matchmaking.cancel, { id: first.id })).closeReason).toBe(
		'userCancelled'
	);
	const second = await player.mutation(api.matchmaking.join, {
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	vi.setSystemTime(second.expiresAt + 1);
	expect((await player.mutation(api.matchmaking.heartbeat, { id: second.id })).closeReason).toBe(
		'leaseExpired'
	);
	expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(0);
});

it('represents abandonment distinctly and does not apply no-show outcomes after opening moves', async () => {
	const { t, gameId, white, black } = await matched();
	await white.mutation(api.moves.submit, {
		gameId,
		expectedRevision: 0,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	});
	await black.mutation(api.moves.submit, {
		gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move: { from: 63, to: 31 }
	});
	expect(
		await t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 2,
				result: { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' },
				now: Date.now()
			})
		)
	).toBe(false);
	expect(
		await t.run((ctx) =>
			finishGame(ctx, {
				gameId,
				expectedRevision: 2,
				result: { reason: 'abandonment', winner: 'black', detail: 'disconnect' },
				now: Date.now()
			})
		)
	).toBe(true);
	const ended = (await white.query(api.games.get, { gameId })).game;
	expect(ended.termination?.cause).toBe('disconnectAbandonment');
	expect(ended.termination?.responsibleParticipantId).toBe(ended.whiteParticipantId);
	expect(await white.query(api.games.roomScore, { roomId: gameId })).toEqual({
		you: 0,
		opponent: 1,
		games: 1
	});
});
