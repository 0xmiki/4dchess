import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
	applyMove,
	canReach,
	createInitialState,
	getOutcome,
	inCheck,
	legalMoves,
	positionKey,
	type Board,
	type Color,
	type Move,
	type Piece,
	type Result
} from './index';

type PrototypeOutcome =
	{ type: 'mate'; winner: Color } | { type: 'stalemate' | 'bare' | 'fifty' | 'repetition' } | null;
type Prototype = {
	initial(): Board;
	canReach(board: Board, from: number, to: number, attack?: boolean): boolean;
	inCheck(board: Board, color: Color): boolean;
	legal(board: Board, color: Color): Move[];
	apply(board: Board, move: Move): Board;
	key(board: Board, turn: Color): string;
	outcome(board: Board, turn: Color, halfmove?: number, keys?: readonly string[]): PrototypeOutcome;
};

// This fixture has no dependency on the developer's original prototype directory.
const source = readFileSync(new URL('./fixtures/prototype-rules.txt', import.meta.url), 'utf8');
const prototype = runInNewContext(`${source}\ncreateRules()`, {}, { timeout: 1000 }) as Prototype;

function normalize(outcome: PrototypeOutcome): Result | null {
	if (!outcome) return null;
	if (outcome.type === 'mate')
		return { reason: 'checkmate', winner: outcome.winner === 'w' ? 'white' : 'black' };
	const details = {
		stalemate: 'stalemate',
		bare: 'bareKings',
		fifty: 'fiftyMove',
		repetition: 'repetition'
	} as const;
	return { reason: 'draw', winner: null, detail: details[outcome.type] };
}

describe('prototype parity', () => {
	it('matches every piece and square pair on empty and occupied boards', () => {
		for (const c of ['w', 'b'] as const) {
			for (const t of ['p', 'r', 'n', 'b', 'q', 'k'] as const) {
				for (let from = 0; from < 64; from++) {
					for (const occupied of [false, true]) {
						const board: (Piece | null)[] = Array.from({ length: 64 }, (_, square) =>
							occupied && square % 3 === 0 ? { t: 'p', c: square % 2 ? 'b' : 'w' } : null
						);
						board[from] = { t, c };
						for (const attack of [false, true]) {
							const actual = Array.from({ length: 64 }, (_, to) =>
								canReach(board, from, to, attack)
							);
							const expected = Array.from({ length: 64 }, (_, to) =>
								prototype.canReach(board, from, to, attack)
							);
							expect(
								actual,
								`${c}${t} from ${from}, occupied=${occupied}, attack=${attack}`
							).toEqual(expected);
						}
					}
				}
			}
		}
	});

	it('matches legal moves, king safety, positions, and outcomes through seeded games', () => {
		let seed = 20260906;
		let checkedPositions = 0;
		for (let game = 0; game < 24; game++) {
			let state = createInitialState();
			let board = prototype.initial();
			let turn: Color = 'w';
			let halfmove = 0;
			const keys = [prototype.key(board, turn)];
			for (let ply = 0; ply < 200; ply++) {
				checkedPositions++;
				expect(state.board).toEqual(board);
				expect(positionKey(state.board, state.turn)).toBe(prototype.key(board, turn));
				for (const side of ['w', 'b'] as const) {
					expect(inCheck(state.board, side)).toBe(prototype.inCheck(board, side));
					expect(legalMoves(state.board, side)).toEqual(prototype.legal(board, side));
				}
				const outcome = normalize(prototype.outcome(board, turn, halfmove, keys));
				expect(state.result).toEqual(outcome);
				expect(
					getOutcome(state.board, state.turn, state.halfmoveClock, state.positionKeys)
				).toEqual(outcome);
				if (outcome) break;
				const moves = prototype.legal(board, turn);
				seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
				const move = moves[seed % moves.length];
				halfmove = board[move.from]!.t === 'p' || board[move.to] ? 0 : halfmove + 1;
				board = prototype.apply(board, move);
				turn = turn === 'w' ? 'b' : 'w';
				keys.push(prototype.key(board, turn));
				const applied = applyMove(state, move);
				if (!applied.ok) throw new Error(`Prototype move rejected: ${applied.error}`);
				state = applied.state;
				expect(state.ply).toBe(ply + 1);
				expect(state.halfmoveClock).toBe(halfmove);
				expect(state.positionKeys.length).toBeLessThanOrEqual(101);
			}
		}
		expect(checkedPositions).toBeGreaterThan(1000);
	}, 15000);
});
