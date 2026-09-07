import type { Board, Piece, PieceType } from './types';
// Familiar material points for the display; these are not an engine evaluation.
const points: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function materialAdvantage(board: Board) {
	const difference = board.reduce(
		(total, piece) => total + (piece ? points[piece.t] * (piece.c === 'w' ? 1 : -1) : 0),
		0
	);
	return { white: Math.max(0, difference), black: Math.max(0, -difference) };
}
export function capturedPieces(moves: readonly { piece: Piece; captured: Piece | null }[]) {
	const result: { white: Piece[]; black: Piece[] } = { white: [], black: [] };
	for (const move of moves)
		if (move.captured) result[move.piece.c === 'w' ? 'white' : 'black'].push(move.captured);
	for (const pieces of Object.values(result))
		pieces.sort((a, b) => points[a.t] - points[b.t] || a.t.localeCompare(b.t));
	return result;
}
