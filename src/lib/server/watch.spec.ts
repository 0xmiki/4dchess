import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { setup, guest } from './test-helpers';
import { legalMoves } from '../chess';
beforeEach(() => {
	vi.stubEnv('INVITE_SECRET', 'spectator-test-only-invitation-secret-32');
});
afterEach(() => {
	vi.unstubAllEnvs();
});
async function players() {
	const t = setup(),
		white = await guest(t),
		black = await guest(t),
		other = await guest(t);
	const room = await white.mutation(api.games.create, { requestId: randomUUID(), seat: 'white' });
	await black.mutation(api.games.join, { token: room.token });
	return { t, white, black, other, room, args: { roomId: room.gameId } };
}
it('exposes only public game data and never creates a spectator participant', async () => {
	const { t, white, black, other, room, args } = await players();
	const before = await t.run((ctx) => ctx.db.query('participants').collect());
	expect(await t.query(api.watch.role, args)).toBe('spectator');
	expect(await other.query(api.watch.role, args)).toBe('spectator');
	expect(await white.query(api.watch.role, args)).toBe('white');
	expect(await black.query(api.watch.role, args)).toBe('black');
	const game = await t.query(api.watch.game, args);
	expect(Object.keys(game!).sort()).toEqual(
		['board', 'id', 'players', 'ply', 'result', 'round', 'status', 'timeControl', 'turn'].sort()
	);
	expect(game?.id).toBe(room.gameId);
	expect(await t.run((ctx) => ctx.db.query('participants').collect())).toEqual(before);
	expect(JSON.stringify(game)).not.toContain(room.token);
});
it('allows public history but rejects spectator mutations and private queries', async () => {
	const { t, white, other, room } = await players();
	const move = {
		gameId: room.gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	};
	await expect(t.mutation(api.moves.submit, move)).rejects.toThrow();
	await expect(other.mutation(api.moves.submit, move)).rejects.toThrow();
	await expect(
		other.mutation(api.games.resign, {
			gameId: room.gameId,
			expectedRevision: 1,
			requestId: randomUUID()
		})
	).rejects.toThrow();
	await expect(
		other.mutation(api.games.rematch, { roomId: room.gameId, expectedGameId: room.gameId })
	).rejects.toThrow();
	await expect(
		other.mutation(api.games.cancel, { gameId: room.gameId, expectedRevision: 1 })
	).rejects.toThrow();
	await expect(other.query(api.games.getInvitation, { gameId: room.gameId })).rejects.toThrow();
	await expect(t.query(api.games.get, { gameId: room.gameId })).rejects.toThrow();
	await white.mutation(api.moves.submit, move);
	const history = await t.query(api.watch.moves, {
		gameId: room.gameId,
		paginationOpts: { cursor: null, numItems: 1 }
	});
	expect(history.page).toHaveLength(1);
	expect(Object.keys(history.page[0]).sort()).toEqual(
		['gameId', 'ply', 'from', 'to', 'piece', 'captured'].sort()
	);
	expect(history.page[0].ply).toBe(1);
});
it('follows rematches, retains earlier history, and maps scores to swapped colors', async () => {
	const { t, white, black, room, args } = await players();
	await white.mutation(api.moves.submit, {
		gameId: room.gameId,
		expectedRevision: 1,
		requestId: randomUUID(),
		move: { from: 0, to: 32 }
	});
	const current = (await black.query(api.games.get, { gameId: room.gameId })).game;
	await black.mutation(api.moves.submit, {
		gameId: room.gameId,
		expectedRevision: 2,
		requestId: randomUUID(),
		move: legalMoves(current.board, current.turn)[0]
	});
	const first = await t.query(api.watch.moves, {
		gameId: room.gameId,
		paginationOpts: { cursor: null, numItems: 1 }
	});
	const second = await t.query(api.watch.moves, {
		gameId: room.gameId,
		paginationOpts: { cursor: first.continueCursor, numItems: 1 }
	});
	expect(first.page[0].ply).toBe(1);
	expect(second.page[0].ply).toBe(2);
	await black.mutation(api.games.resign, {
		gameId: room.gameId,
		expectedRevision: 3,
		requestId: randomUUID()
	});
	await white.mutation(api.games.rematch, { roomId: room.gameId, expectedGameId: room.gameId });
	const newId = await black.mutation(api.games.rematch, {
		roomId: room.gameId,
		expectedGameId: room.gameId
	});
	expect((await t.query(api.watch.game, args))?.id).toBe(newId);
	expect(await white.query(api.watch.role, args)).toBe('black');
	expect(await t.query(api.watch.score, args)).toEqual({ white: 0, black: 1, games: 1 });
	expect(
		(
			await t.query(api.watch.moves, {
				gameId: room.gameId,
				paginationOpts: { cursor: null, numItems: 20 }
			})
		).page
	).toHaveLength(2);
});
