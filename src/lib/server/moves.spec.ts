import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api } from '../../convex/_generated/api';
import { initialBoard, positionKey, squareIndex, type Piece } from '../chess';

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'test-only-invitation-key-not-used-by-any-deployment');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

async function match() {
	const t = setup();
	const white = await guest(t),
		black = await guest(t),
		stranger = await guest(t);
	const created = await white.mutation(api.games.create, {
		requestId: randomUUID(),
		seat: 'white'
	});
	await black.mutation(api.games.join, { token: created.token });
	const request = {
		gameId: created.gameId,
		requestId: randomUUID(),
		expectedRevision: 1,
		move: { from: 0, to: 32 }
	};
	return { t, white, black, stranger, created, request };
}

describe('authoritative moves', () => {
	it('commits the move, position, counters, and receipt together', async () => {
		const { white, black, request } = await match();
		expect(await white.mutation(api.moves.submit, request)).toEqual({
			revision: 2,
			ply: 1,
			result: null
		});
		const { game } = await black.query(api.games.get, { gameId: request.gameId });
		expect(game).toMatchObject({ revision: 2, ply: 1, turn: 'b', halfmoveClock: 1 });
		expect(game.board[0]).toBeNull();
		expect(game.board[32]).toEqual({ t: 'r', c: 'w' });
		const history = await black.query(api.moves.list, {
			gameId: request.gameId,
			paginationOpts: { numItems: 20, cursor: null }
		});
		expect(history.page).toHaveLength(1);
		expect(history.page[0]).toMatchObject({ from: 0, to: 32, ply: 1, revision: 2, captured: null });
	});
	it('returns the original receipt after an opponent reply and rejects reused contents', async () => {
		const { white, black, request } = await match();
		const receipt = await white.mutation(api.moves.submit, request);
		await black.mutation(api.moves.submit, {
			...request,
			requestId: randomUUID(),
			expectedRevision: 2,
			move: { from: 63, to: 31 }
		});
		expect(await white.mutation(api.moves.submit, request)).toEqual(receipt);
		expect(
			await white.query(api.moves.receipt, { gameId: request.gameId, requestId: request.requestId })
		).toEqual(receipt);
		await expect(
			white.mutation(api.moves.submit, { ...request, move: { from: 0, to: 16 } })
		).rejects.toThrow('REQUEST_ID_REUSED');
		expect((await white.query(api.games.get, { gameId: request.gameId })).game.ply).toBe(2);
	});
	it('makes concurrent retries one move and competing requests a stale revision', async () => {
		const { t, white, request } = await match();
		const results = await Promise.all([
			white.mutation(api.moves.submit, request),
			white.mutation(api.moves.submit, request)
		]);
		expect(results[0]).toEqual(results[1]);
		await expect(
			white.mutation(api.moves.submit, { ...request, requestId: randomUUID() })
		).rejects.toThrow('STALE_REVISION');
		expect(await t.run((ctx) => ctx.db.query('moves').collect())).toHaveLength(1);
	});
	it('rejects strangers, wrong turns, malformed moves, and illegal destinations without writes', async () => {
		const { t, white, black, stranger, request } = await match();
		await expect(stranger.mutation(api.moves.submit, request)).rejects.toThrow('MATCH_NOT_FOUND');
		await expect(black.mutation(api.moves.submit, request)).rejects.toThrow('NOT_YOUR_TURN');
		await expect(
			white.mutation(api.moves.submit, { ...request, move: { from: 0, to: 64 } })
		).rejects.toThrow('INVALID_MOVE');
		await expect(
			white.mutation(api.moves.submit, { ...request, move: { from: 0, to: 1 } })
		).rejects.toThrow('ILLEGAL_MOVE');
		await expect(
			white.mutation(api.moves.submit, { ...request, expectedRevision: 1.5 })
		).rejects.toThrow('INVALID_REVISION');
		await expect(
			stranger.query(api.moves.list, {
				gameId: request.gameId,
				paginationOpts: { numItems: 10, cursor: null }
			})
		).rejects.toThrow('MATCH_NOT_FOUND');
		expect(await t.run((ctx) => ctx.db.query('moves').collect())).toEqual([]);
		expect((await white.query(api.games.get, { gameId: request.gameId })).game.revision).toBe(1);
	});
	it('stores checkmate and prevents further moves while allowing the original retry', async () => {
		const { t, white, black, request } = await match();
		const board: (Piece | null)[] = Array(64).fill(null);
		board[0] = { t: 'k', c: 'w' };
		board[2] = { t: 'k', c: 'b' };
		board[11] = { t: 'q', c: 'b' };
		await t.run((ctx) =>
			ctx.db.patch(request.gameId, { board, turn: 'b', positionKeys: [positionKey(board, 'b')] })
		);
		const mate = { ...request, move: { from: 11, to: 1 } };
		const receipt = await black.mutation(api.moves.submit, mate);
		expect(receipt.result).toEqual({ reason: 'checkmate', winner: 'black' });
		const { game } = await white.query(api.games.get, { gameId: request.gameId });
		expect(game.status).toBe('finished');
		expect(game.finishedAt).not.toBeNull();
		expect(await black.mutation(api.moves.submit, mate)).toEqual(receipt);
		await expect(
			white.mutation(api.moves.submit, { ...request, expectedRevision: 2, requestId: randomUUID() })
		).rejects.toThrow('MATCH_NOT_ACTIVE');
	});
	it('commits the automatic halfmove draw', async () => {
		const { t, white, request } = await match();
		await t.run((ctx) => ctx.db.patch(request.gameId, { halfmoveClock: 99 }));
		expect((await white.mutation(api.moves.submit, request)).result).toEqual({
			reason: 'draw',
			winner: null,
			detail: 'fiftyMove'
		});
		expect((await white.query(api.games.get, { gameId: request.gameId })).game.status).toBe(
			'finished'
		);
	});
	it('preserves promotion and captured-piece history', async () => {
		const { t, white, request } = await match();
		const board: (Piece | null)[] = Array(64).fill(null);
		board[0] = { t: 'k', c: 'w' };
		board[63] = { t: 'k', c: 'b' };
		board[squareIndex([1, 2, 0, 0])] = { t: 'p', c: 'w' };
		board[squareIndex([2, 3, 0, 0])] = { t: 'r', c: 'b' };
		await t.run((ctx) =>
			ctx.db.patch(request.gameId, { board, positionKeys: [positionKey(board, 'w')] })
		);
		await white.mutation(api.moves.submit, { ...request, move: { from: 9, to: 14 } });
		expect((await white.query(api.games.get, { gameId: request.gameId })).game.board[14]).toEqual({
			t: 'q',
			c: 'w'
		});
		expect(await white.query(api.moves.latest, { gameId: request.gameId })).toMatchObject({
			piece: { t: 'p', c: 'w' },
			captured: { t: 'r', c: 'b' }
		});
	});
});

describe('resignation', () => {
	it('ends a match, is idempotent, and retains earlier move receipts', async () => {
		const { white, black, request } = await match();
		const receipt = await white.mutation(api.moves.submit, request);
		const resign = { gameId: request.gameId, expectedRevision: 2, requestId: randomUUID() };
		expect(await white.mutation(api.games.resign, resign)).toBe(3);
		expect(await white.mutation(api.games.resign, resign)).toBe(3);
		expect((await black.query(api.games.get, { gameId: request.gameId })).game.result).toEqual({
			reason: 'resignation',
			winner: 'black'
		});
		expect(await white.mutation(api.moves.submit, request)).toEqual(receipt);
	});
	it('serializes a move against resignation with no mixed outcome', async () => {
		const { t, white, black, request } = await match();
		const attempts = await Promise.allSettled([
			white.mutation(api.moves.submit, request),
			black.mutation(api.games.resign, {
				gameId: request.gameId,
				expectedRevision: 1,
				requestId: randomUUID()
			})
		]);
		expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
		const { game } = await white.query(api.games.get, { gameId: request.gameId });
		expect(game.revision).toBe(2);
		if (game.status === 'finished') {
			expect(game.board).toEqual(initialBoard());
			expect(await t.run((ctx) => ctx.db.query('moves').collect())).toEqual([]);
		} else {
			expect(game.ply).toBe(1);
			expect(game.result).toBeNull();
		}
	});
});
