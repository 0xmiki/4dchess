import { expect, it } from 'vitest';
import { createInitialState, applyMove, type Piece } from './index';
import { historyPositions, moveNotation, type HistoryMove } from './history';
it('rewinds captures and promotions without modifying the live board', () => {
	const before: (Piece | null)[] = Array(64).fill(null);
	before[0] = { t: 'k', c: 'w' };
	before[63] = { t: 'k', c: 'b' };
	before[8] = { t: 'p', c: 'w' };
	before[13] = { t: 'r', c: 'b' };
	const after = before.slice();
	after[8] = null;
	after[13] = { t: 'q', c: 'w' };
	const move: HistoryMove = { from: 8, to: 13, ply: 1, piece: before[8]!, captured: before[13] };
	const positions = historyPositions(after, 1, [move]);
	expect(positions.get(0)).toEqual(before);
	expect(after[13]).toEqual({ t: 'q', c: 'w' });
	expect(moveNotation(move, before, after)).toContain('axb4[0,0]=Q');
});
it('does not invent historical positions across an unloaded page gap', () => {
	const initial = createInitialState(),
		one = applyMove(initial, { from: 0, to: 32 });
	if (!one.ok) throw Error();
	const two = applyMove(one.state, { from: 63, to: 31 });
	if (!two.ok) throw Error();
	const entry: HistoryMove = {
		from: 63,
		to: 31,
		ply: 2,
		piece: one.state.board[63]!,
		captured: null
	};
	const positions = historyPositions(two.state.board, 2, [entry]);
	expect(positions.get(1)).toEqual(one.state.board);
	expect(positions.has(0)).toBe(false);
	expect(moveNotation(entry, one.state.board, two.state.board)).toBe('Rd4[1,0]');
});
