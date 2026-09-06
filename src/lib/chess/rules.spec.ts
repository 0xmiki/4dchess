import { describe, expect, it } from 'vitest';
import {
	applyMove,
	canReach,
	createInitialState,
	getOutcome,
	inCheck,
	initialBoard,
	legalMoves,
	positionKey,
	squareAddress,
	squareCoordinates,
	squareIndex,
	type Board,
	type Color,
	type Coordinates,
	type GameState,
	type Move,
	type Piece
} from './index';

function boardWith(...pieces: [Coordinates, Piece['t'], Color][]): Board {
	const board: (Piece | null)[] = Array(64).fill(null);
	for (const [at, t, c] of pieces) board[squareIndex(at)] = { t, c };
	return board;
}

function stateWith(board: Board, turn: Color = 'w', halfmoveClock = 0): GameState {
	return {
		rulesVersion: 'fourfold-v1',
		board,
		turn,
		ply: 0,
		halfmoveClock,
		positionKeys: [positionKey(board, turn)],
		result: null
	};
}

function play(state: GameState, move: Move): GameState {
	const result = applyMove(state, move);
	if (!result.ok) throw new Error(`Unexpected move failure: ${result.error}`);
	return result.state;
}

describe('fourfold-v1 coordinates and setup', () => {
	it('round-trips every square and preserves prototype notation', () => {
		for (let square = 0; square < 64; square++)
			expect(squareIndex(squareCoordinates(square))).toBe(square);
		expect(squareAddress(32)).toBe('a1 [0,1]');
		expect(squareAddress(63)).toBe('d4 [1,1]');
	});

	it('rejects coordinates that could alias another square', () => {
		for (const at of [
			[4, 0, 0, 0],
			[0, -1, 0, 0],
			[0, 0, 2, 0],
			[0, 0, 0, 2],
			[0.5, 0, 0, 0]
		] as const) {
			expect(() => squareIndex(at)).toThrow(RangeError);
		}
		for (const square of [-1, 64, 0.5, NaN, Infinity])
			expect(() => squareCoordinates(square)).toThrow(RangeError);
	});

	it('starts with ten pieces per side, white to move, and an initial repetition key', () => {
		const state = createInitialState();
		expect(state.board).toHaveLength(64);
		for (const color of ['w', 'b'] as const) {
			expect(state.board.filter((piece) => piece?.c === color)).toHaveLength(10);
			expect(legalMoves(state.board, color)).toHaveLength(41);
		}
		expect(state).toMatchObject({
			rulesVersion: 'fourfold-v1',
			turn: 'w',
			ply: 0,
			halfmoveClock: 0,
			result: null
		});
		expect(state.positionKeys).toEqual([positionKey(state.board, 'w')]);
		expect(positionKey(state.board, 'w')).not.toBe(positionKey(state.board, 'b'));
	});
});

describe('movement geometry', () => {
	it.each([
		['r', [0, 0, 0, 1], true],
		['r', [0, 0, 1, 1], false],
		['b', [0, 0, 1, 1], true],
		['b', [1, 0, 1, 1], false],
		['q', [1, 1, 1, 1], true],
		['q', [2, 1, 0, 0], false],
		['k', [1, 1, 1, 1], true],
		['k', [2, 0, 0, 0], false],
		['n', [2, 0, 0, 1], true],
		['n', [1, 0, 1, 1], false]
	] as [Piece['t'], Coordinates, boolean][])(
		'%s from the origin to %j: %s',
		(type, destination, expected) => {
			expect(canReach(boardWith([[0, 0, 0, 0], type, 'w']), 0, squareIndex(destination))).toBe(
				expected
			);
		}
	);

	it('blocks sliders only on their actual path and lets knights jump', () => {
		const blocked = boardWith([[0, 0, 0, 0], 'b', 'w'], [[1, 1, 0, 0], 'p', 'w']);
		expect(canReach(blocked, 0, squareIndex([3, 3, 0, 0]))).toBe(false);
		const otherSlice = boardWith([[0, 0, 0, 0], 'b', 'w'], [[1, 1, 1, 0], 'p', 'w']);
		expect(canReach(otherSlice, 0, squareIndex([3, 3, 0, 0]))).toBe(true);
		const knight = boardWith(
			[[0, 0, 0, 0], 'n', 'w'],
			[[1, 0, 0, 0], 'p', 'w'],
			[[1, 1, 0, 0], 'p', 'w']
		);
		expect(canReach(knight, 0, squareIndex([2, 1, 0, 0]))).toBe(true);
	});

	it.each(['w', 'b'] as const)(
		'handles %s pawn advances and captures along X, Z, and W',
		(color) => {
			const y = color === 'w' ? 1 : 2;
			const nextY = color === 'w' ? 2 : 1;
			const from = squareIndex([1, y, 0, 0]);
			const pawn = boardWith([[1, y, 0, 0], 'p', color]);
			const forward = squareIndex([1, nextY, 0, 0]);
			expect(canReach(pawn, from, forward)).toBe(true);
			expect(canReach(pawn, from, forward, true)).toBe(false);
			expect(canReach(pawn, from, squareIndex([1, color === 'w' ? 3 : 0, 0, 0]))).toBe(false);
			const enemy = color === 'w' ? 'b' : 'w';
			for (const target of [
				[2, nextY, 0, 0],
				[1, nextY, 1, 0],
				[1, nextY, 0, 1]
			] as const) {
				const to = squareIndex(target);
				expect(canReach(pawn, from, to)).toBe(false);
				expect(canReach(pawn, from, to, true)).toBe(true);
				expect(
					canReach(boardWith([[1, y, 0, 0], 'p', color], [target, 'r', enemy]), from, to)
				).toBe(true);
				expect(
					canReach(boardWith([[1, y, 0, 0], 'p', color], [target, 'r', color]), from, to)
				).toBe(false);
			}
			expect(
				canReach(
					boardWith([[1, y, 0, 0], 'p', color], [[1, nextY, 0, 0], 'r', enemy]),
					from,
					forward
				)
			).toBe(false);
			expect(
				canReach(
					boardWith([[1, y, 0, 0], 'p', color], [[1, nextY, 1, 1], 'r', enemy]),
					from,
					squareIndex([1, nextY, 1, 1])
				)
			).toBe(false);
		}
	);
});

describe('king safety', () => {
	it('treats a pinned enemy piece as controlling squares the king cannot enter', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'r', 'w'],
			[[1, 0, 0, 0], 'r', 'b'],
			[[3, 0, 0, 0], 'k', 'b'],
			[[2, 2, 0, 0], 'k', 'w']
		);
		expect(inCheck(board, 'w')).toBe(false);
		expect(legalMoves(board, 'b', 1)).not.toContainEqual({ from: 1, to: 5 });
		expect(canReach(board, 1, 5, true)).toBe(true);
		expect(applyMove(stateWith(board), { from: 10, to: 5 })).toEqual({
			ok: false,
			error: 'ILLEGAL_MOVE'
		});
	});

	it('detects check across W and rejects moves that fail to escape it', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[0, 0, 0, 1], 'r', 'b'],
			[[3, 3, 1, 1], 'k', 'b'],
			[[3, 0, 0, 0], 'r', 'w']
		);
		expect(inCheck(board, 'w')).toBe(true);
		expect(applyMove(stateWith(board), { from: 3, to: 7 })).toEqual({
			ok: false,
			error: 'ILLEGAL_MOVE'
		});
	});

	it('rejects exposing a pinned king', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[1, 0, 0, 0], 'r', 'w'],
			[[3, 0, 0, 0], 'r', 'b'],
			[[3, 3, 1, 1], 'k', 'b']
		);
		expect(canReach(board, 1, 5)).toBe(true);
		expect(legalMoves(board, 'w', 1)).not.toContainEqual({ from: 1, to: 5 });
		expect(legalMoves(board, 'w', 1)).toContainEqual({ from: 1, to: 3 });
	});

	it('never allows king capture or moving adjacent to the other king', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[2, 0, 0, 0], 'k', 'b'],
			[[2, 3, 0, 0], 'r', 'w']
		);
		expect(canReach(board, 14, 2)).toBe(true);
		expect(legalMoves(board, 'w', 14)).not.toContainEqual({ from: 14, to: 2 });
		expect(legalMoves(board, 'w', 0)).not.toContainEqual({ from: 0, to: 1 });
	});
});

describe('state transitions', () => {
	it('rejects an unknown stored rules version', () => {
		const state = {
			...createInitialState(),
			rulesVersion: 'future-version' as GameState['rulesVersion']
		};
		expect(applyMove(state, { from: 0, to: 32 })).toEqual({
			ok: false,
			error: 'UNSUPPORTED_RULES_VERSION'
		});
	});

	it('is deterministic, serializable, and leaves the input untouched', () => {
		const state = createInitialState();
		const before = JSON.stringify(state);
		state.board.forEach((piece) => {
			if (piece) Object.freeze(piece);
		});
		Object.freeze(state.board);
		Object.freeze(state.positionKeys);
		Object.freeze(state);
		const next = play(state, { from: 0, to: 32 });
		expect(next).toEqual(play(state, { from: 0, to: 32 }));
		expect(JSON.parse(JSON.stringify(next))).toEqual(next);
		expect(JSON.stringify(state)).toBe(before);
		expect(next).toMatchObject({ turn: 'b', ply: 1, halfmoveClock: 1, result: null });
		expect(next.board[0]).toBeNull();
		expect(next.board[32]).toEqual({ t: 'r', c: 'w' });
	});

	it('rejects invalid indices, empty sources, wrong-side pieces, and friendly destinations', () => {
		const state = createInitialState();
		for (const value of [-1, 64, 0.5, NaN, Infinity]) {
			expect(applyMove(state, { from: value, to: 32 })).toEqual({
				ok: false,
				error: 'INVALID_MOVE'
			});
			expect(applyMove(state, { from: 0, to: value })).toEqual({
				ok: false,
				error: 'INVALID_MOVE'
			});
		}
		for (const move of [
			{ from: 32, to: 0 },
			{ from: 63, to: 31 },
			{ from: 0, to: 1 },
			{ from: 0, to: 0 }
		]) {
			expect(applyMove(state, move)).toEqual({ ok: false, error: 'ILLEGAL_MOVE' });
		}
	});

	it.each(['w', 'b'] as const)('promotes %s pawns and resets draw tracking', (color) => {
		const y = color === 'w' ? 2 : 1;
		const finalY = color === 'w' ? 3 : 0;
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[3, 3, 1, 1], 'k', 'b'],
			[[1, y, 0, 0], 'p', color]
		);
		const next = play(stateWith(board, color, 99), {
			from: squareIndex([1, y, 0, 0]),
			to: squareIndex([1, finalY, 0, 0])
		});
		expect(next.board[squareIndex([1, finalY, 0, 0])]).toEqual({ t: 'q', c: color });
		expect(next.halfmoveClock).toBe(0);
		expect(next.positionKeys).toEqual([positionKey(next.board, next.turn)]);
		expect(next.result).toBeNull();
	});

	it('resets draw tracking on capture and detects bare kings after the capture', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[1, 0, 0, 0], 'n', 'b'],
			[[3, 3, 1, 1], 'k', 'b']
		);
		const next = play(stateWith(board, 'w', 99), { from: 0, to: 1 });
		expect(next.halfmoveClock).toBe(0);
		expect(next.positionKeys).toEqual([positionKey(next.board, next.turn)]);
		expect(next.result).toEqual({ reason: 'draw', winner: null, detail: 'bareKings' });
	});

	it('draws on the third occurrence, counting the initial position', () => {
		let state = createInitialState();
		const cycle = [
			{ from: 0, to: 32 },
			{ from: 63, to: 31 },
			{ from: 32, to: 0 },
			{ from: 31, to: 63 }
		];
		for (const move of cycle) state = play(state, move);
		expect(state.result).toBeNull();
		for (const move of cycle) state = play(state, move);
		expect(state.result).toEqual({ reason: 'draw', winner: null, detail: 'repetition' });
		expect(applyMove(state, cycle[0])).toEqual({ ok: false, error: 'GAME_OVER' });
	});

	it('draws at 100 quiet halfmoves, not 99', () => {
		const state = { ...createInitialState(), halfmoveClock: 98 };
		const next = play(state, { from: 0, to: 32 });
		expect(next.result).toBeNull();
		const finished = play(next, { from: 63, to: 31 });
		expect(finished.halfmoveClock).toBe(100);
		expect(finished.result).toEqual({ reason: 'draw', winner: null, detail: 'fiftyMove' });
	});
});

describe('terminal results', () => {
	const mate = boardWith(
		[[0, 0, 0, 0], 'k', 'w'],
		[[2, 0, 0, 0], 'k', 'b'],
		[[1, 0, 0, 0], 'q', 'b']
	);

	it('gives checkmate precedence over halfmove and repetition draws', () => {
		const key = positionKey(mate, 'w');
		expect(getOutcome(mate, 'w', 100, [key, key, key])).toEqual({
			reason: 'checkmate',
			winner: 'black'
		});
		expect(applyMove(stateWith(mate), { from: 0, to: 16 })).toEqual({
			ok: false,
			error: 'GAME_OVER'
		});
	});

	it('stores checkmate on the move that delivers it', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[2, 0, 0, 0], 'k', 'b'],
			[[3, 2, 0, 0], 'q', 'b']
		);
		const next = play(stateWith(board, 'b', 99), { from: 11, to: 1 });
		expect(next.result).toEqual({ reason: 'checkmate', winner: 'black' });
		expect(next.halfmoveClock).toBe(100);
	});

	it('distinguishes stalemate from checkmate', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[2, 0, 0, 1], 'k', 'b'],
			[[1, 2, 0, 1], 'q', 'b'],
			[[0, 0, 1, 1], 'r', 'b'],
			[[0, 3, 1, 1], 'q', 'b']
		);
		expect(inCheck(board, 'w')).toBe(false);
		expect(legalMoves(board, 'w')).toEqual([]);
		expect(getOutcome(board, 'w')).toEqual({ reason: 'draw', winner: null, detail: 'stalemate' });
	});

	it('does not invent insufficient-material draws beyond bare kings', () => {
		const board = boardWith(
			[[0, 0, 0, 0], 'k', 'w'],
			[[3, 3, 1, 1], 'k', 'b'],
			[[1, 0, 0, 0], 'n', 'w']
		);
		expect(getOutcome(board, 'w')).toBeNull();
	});

	it('preserves bare-kings and fifty-move precedence over repetition', () => {
		const kings = boardWith([[0, 0, 0, 0], 'k', 'w'], [[3, 3, 1, 1], 'k', 'b']);
		const key = positionKey(kings, 'w');
		expect(getOutcome(kings, 'w', 100, [key, key, key])).toEqual({
			reason: 'draw',
			winner: null,
			detail: 'bareKings'
		});
		const board = initialBoard();
		const initialKey = positionKey(board, 'w');
		expect(getOutcome(board, 'w', 100, [initialKey, initialKey, initialKey])).toEqual({
			reason: 'draw',
			winner: null,
			detail: 'fiftyMove'
		});
	});
});
