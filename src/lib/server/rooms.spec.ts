import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api } from '../../convex/_generated/api';
beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'test-only-room-key-not-used-by-any-deployment');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
it('keeps a stable invitation, starts exactly one rematch, and retains the previous history', async () => {
	const t = setup(),
		white = await guest(t),
		black = await guest(t),
		outsider = await guest(t);
	const room = await white.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	await black.mutation(api.games.join, { token: room.token });
	const original = await white.query(api.games.get, { gameId: room.gameId });
	expect((await t.query(api.games.previewInvite, { token: room.token })).challengerName).toBe(
		original.players.white
	);
	await expect(
		white.mutation(api.games.rematch, { roomId: room.gameId, expectedGameId: room.gameId })
	).rejects.toThrow('MATCH_NOT_FINISHED');
	await white.mutation(api.moves.submit, {
		gameId: room.gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	});
	await black.mutation(api.games.resign, {
		gameId: room.gameId,
		expectedRevision: 2,
		requestId: randomUUID()
	});
	await expect(
		outsider.mutation(api.games.rematch, { roomId: room.gameId, expectedGameId: room.gameId })
	).rejects.toThrow('MATCH_NOT_FOUND');
	const offer = { roomId: room.gameId, expectedGameId: room.gameId };
	expect(await white.mutation(api.games.rematch, offer)).toBe(room.gameId);
	expect(await white.mutation(api.games.rematch, offer)).toBe(room.gameId);
	expect((await black.query(api.games.get, { gameId: room.gameId })).game).toMatchObject({
		status: 'finished',
		rematchRequestedBy: 'white'
	});
	await black.mutation(api.games.dismissRematch, { gameId: room.gameId });
	expect(
		(await white.query(api.games.get, { gameId: room.gameId })).game.rematchRequestedBy
	).toBeUndefined();
	await white.mutation(api.games.rematch, offer);
	const games = await Promise.all(
		[black, black].map((player) =>
			player.mutation(api.games.rematch, { roomId: room.gameId, expectedGameId: room.gameId })
		)
	);
	expect(games[0]).toBe(games[1]);
	expect(games[0]).not.toBe(room.gameId);
	expect(
		await t.run((ctx) =>
			ctx.db
				.query('games')
				.withIndex('by_room_round', (q) => q.eq('roomRootId', room.gameId))
				.collect()
		)
	).toHaveLength(2);
	for (const player of [white, black]) {
		const view = await player.query(api.games.get, { gameId: room.gameId });
		expect(view.seat).toBe(player === white ? 'black' : 'white');
		expect(view.players).toEqual({ white: original.players.black, black: original.players.white });
		expect(view.game).toMatchObject({
			_id: games[0],
			round: 2,
			status: 'active',
			ply: 0,
			revision: 0
		});
	}
	const joined = await black.mutation(api.games.join, { token: room.token });
	expect(await white.query(api.games.roomScore, { roomId: room.gameId })).toEqual({
		you: 1,
		opponent: 0,
		games: 1
	});
	await t.run((ctx) =>
		ctx.db.patch(games[0], {
			status: 'finished',
			result: { reason: 'draw', detail: 'stalemate', winner: null }
		})
	);
	expect(await black.query(api.games.roomScore, { roomId: room.gameId })).toEqual({
		you: 0.5,
		opponent: 1.5,
		games: 2
	});
	expect(joined.gameId).toBe(room.gameId);
	expect(joined.seat).toBe('white');
	const old = await t.run((ctx) => ctx.db.get(room.gameId));
	expect(old?.status).toBe('finished');
	expect(old?.ply).toBe(1);
	const moves = await white.query(api.moves.list, {
		gameId: room.gameId,
		paginationOpts: { numItems: 20, cursor: null }
	});
	expect(moves.page).toHaveLength(1);
	await expect(
		white.mutation(api.moves.submit, {
			gameId: room.gameId,
			expectedRevision: 3,
			requestId: randomUUID(),
			move: { from: 32, to: 0 }
		})
	).rejects.toThrow('MATCH_NOT_ACTIVE');
});

it('does not reopen a closed unjoined room', async () => {
	const t = setup(),
		player = await guest(t),
		room = await player.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	await player.mutation(api.games.cancel, { gameId: room.gameId, expectedRevision: 0 });
	await expect(
		player.mutation(api.games.rematch, { roomId: room.gameId, expectedGameId: room.gameId })
	).rejects.toThrow('ROOM_CLOSED');
});

it('rematches after zero-move resignations and counts wins for people after colors swap', async () => {
	const t = setup(),
		first = await guest(t),
		second = await guest(t);
	const room = await first.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	await second.mutation(api.games.join, { token: room.token });
	for (let round = 0; round < 3; round++) {
		const view = await second.query(api.games.get, { gameId: room.gameId });
		await second.mutation(api.games.resign, {
			gameId: view.game._id,
			expectedRevision: view.game.revision,
			requestId: randomUUID()
		});
		const offer = { roomId: room.gameId, expectedGameId: view.game._id };
		await second.mutation(api.games.rematch, offer);
		await first.mutation(api.games.rematch, offer);
		const next = await first.query(api.games.get, { gameId: room.gameId });
		expect(next.game.ply).toBe(0);
		expect(next.seat).toBe(round % 2 === 0 ? 'black' : 'white');
		expect(await first.query(api.games.roomScore, { roomId: room.gameId })).toEqual({
			you: round + 1,
			opponent: 0,
			games: round + 1
		});
	}
});
