import { describe, it, expect } from 'vitest';
import { createInitialState, applyMove, positionKey, type Piece } from './index';
import { searchPosition, difficulties } from './search';
import { analyzeThreats } from './threats';
import { exportGame } from './export';

describe('computer search', () => {
	it('returns a legal move within a small budget without changing the state', () => {
		const state = createInitialState(),
			before = JSON.stringify(state);
		const result = searchPosition(state, { ...difficulties.medium, budgetMs: 20 });
		expect(result.move).not.toBeNull();
		expect(applyMove(state, result.move!).ok).toBe(true);
		expect(JSON.stringify(state)).toBe(before);
	});
	it('finds a forced mate and returns no move for a terminal position', () => {
		const board: (Piece | null)[] = Array(64).fill(null);
		board[0] = { t: 'k', c: 'w' };
		board[2] = { t: 'k', c: 'b' };
		board[11] = { t: 'q', c: 'b' };
		const state = {
			...createInitialState(),
			board,
			turn: 'b' as const,
			positionKeys: [positionKey(board, 'b')]
		};
		const result = searchPosition(state, { ...difficulties.easy, budgetMs: 1000 });
		const next = applyMove(state, result.move!);
		expect(next.ok).toBe(true);
		if (!next.ok) throw Error('Rejected search result');
		expect(next.state.result).toEqual({ reason: 'checkmate', winner: 'black' });
		expect(searchPosition(next.state, difficulties.easy).move).toBeNull();
	});
});
describe('threat inspection', () => {
	it('shows attacks from both colors on empty squares even without kings', () => {
		const board: (Piece | null)[] = Array(64).fill(null);
		board[0] = { t: 'r', c: 'w' };
		board[3] = { t: 'r', c: 'b' };
		expect(analyzeThreats(board, 'w', 1).attackers).toEqual([0, 3]);
		expect(analyzeThreats(board, 'b', 1).attackers).toEqual([0, 3]);
		board[2] = { t: 'p', c: 'w' };
		expect(analyzeThreats(board, 'b', 1).attackers).toEqual([0]);
	});
	it('previews a move without modifying the actual position', () => {
		const state = createInitialState(),
			before = JSON.stringify(state);
		const inspection = analyzeThreats(state.board, 'w', 32, 0);
		expect(inspection.preview).toBe(true);
		expect(inspection.position[0]).toBeNull();
		expect(inspection.position[32]).toEqual({ t: 'r', c: 'w' });
		expect(JSON.stringify(state)).toBe(before);
	});
	it('includes pinned defenders when inspecting a king target', () => {
		const board: (Piece | null)[] = Array(64).fill(null);
		board[0] = { t: 'r', c: 'w' };
		board[1] = { t: 'r', c: 'b' };
		board[3] = { t: 'k', c: 'b' };
		board[10] = { t: 'k', c: 'w' };
		const inspection = analyzeThreats(board, 'w', 5, 10);
		expect(inspection.legalMove).toBe(false);
		expect(inspection.kingSquare).toBe(true);
		expect(inspection.attackers).toContain(1);
	});
});
describe('4D PGN export', () => {
	it('exports coordinates, rule metadata, and resignation results', () => {
		const text = exportGame(
			[
				{ from: 0, to: 32 },
				{ from: 63, to: 31 }
			],
			{ date: Date.UTC(2026, 8, 6), result: { reason: 'resignation', winner: 'black' } }
		);
		expect(text).toContain('[Rules "fourfold-v1"]');
		expect(text).toContain('[Date "2026.09.06"]');
		expect(text).toContain('1. Ra1[0,0]-a1[0,1] Rd4[1,1]-d4[1,0] 0-1');
	});
	it('rejects incomplete or illegal histories and escapes header input', () => {
		expect(() => exportGame([{ from: 0, to: 63 }])).toThrow('invalid move history');
		const text = exportGame([], { white: 'Name"\nInjected' });
		expect(text).toContain('[White "Name\\" Injected"]');
	});
});
