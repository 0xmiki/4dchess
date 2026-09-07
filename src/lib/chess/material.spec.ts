import { expect, it } from 'vitest';
import { createInitialState, type Piece } from './index';
import { capturedPieces, materialAdvantage } from './material';
it('shows material advantage without counting promotion as a capture', () => {
	const initial = createInitialState().board;
	expect(materialAdvantage(initial)).toEqual({ white: 0, black: 0 });
	const promoted = initial.slice();
	promoted[4] = { t: 'q', c: 'w' };
	expect(materialAdvantage(promoted)).toEqual({ white: 8, black: 0 });
	expect(capturedPieces([{ piece: { t: 'p', c: 'w' }, captured: null }])).toEqual({
		white: [],
		black: []
	});
	const captured = initial.slice();
	captured[0] = null;
	expect(materialAdvantage(captured)).toEqual({ white: 0, black: 5 });
});
it('assigns captured pieces to their capturer and groups them by value', () => {
	const moves: { piece: Piece; captured: Piece | null }[] = [
		{ piece: { t: 'r', c: 'b' }, captured: { t: 'q', c: 'w' } },
		{ piece: { t: 'q', c: 'w' }, captured: { t: 'p', c: 'b' } },
		{ piece: { t: 'b', c: 'b' }, captured: { t: 'p', c: 'w' } }
	];
	expect(capturedPieces(moves)).toEqual({
		white: [{ t: 'p', c: 'b' }],
		black: [
			{ t: 'p', c: 'w' },
			{ t: 'q', c: 'w' }
		]
	});
});
