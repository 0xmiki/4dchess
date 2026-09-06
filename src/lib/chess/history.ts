import { canReach, inCheck, legalMoves, squareAddress, squareCoordinates } from './fourfold-v1';
import type { Board, Move, Piece } from './types';
export type HistoryMove = Move & { ply: number; piece: Piece; captured: Piece | null };
/** Undo recorded changes, including captures and promotions, without changing live state. */
export function historyPositions(board: Board, ply: number, moves: readonly HistoryMove[]) {
	const positions = new Map<number, Board>([[ply, board]]);
	let current = board,
		expected = ply;
	for (const move of [...moves].sort((a, b) => b.ply - a.ply)) {
		if (move.ply > expected) continue;
		if (move.ply !== expected) break;
		const before = current.slice();
		before[move.from] = move.piece;
		before[move.to] = move.captured;
		current = before;
		positions.set(--expected, current);
	}
	return positions;
}
export function moveNotation(move: HistoryMove, before?: Board, after?: Board) {
	const letter = move.piece.t === 'p' ? '' : move.piece.t.toUpperCase();
	let origin = move.piece.t === 'p' && move.captured ? 'abcd'[squareCoordinates(move.from)[0]] : '';
	if (
		before &&
		before.some(
			(p, from) =>
				from !== move.from &&
				p?.t === move.piece.t &&
				p.c === move.piece.c &&
				canReach(before, from, move.to)
		)
	)
		origin = squareAddress(move.from).replace(' ', '');
	if (!before) origin = squareAddress(move.from).replace(' ', '');
	const promotion =
		move.piece.t === 'p' && squareCoordinates(move.to)[1] === (move.piece.c === 'w' ? 3 : 0)
			? '=Q'
			: '';
	const next = move.piece.c === 'w' ? 'b' : 'w';
	const suffix = after && inCheck(after, next) ? (legalMoves(after, next).length ? '+' : '#') : '';
	return `${letter}${origin}${move.captured ? 'x' : ''}${squareAddress(move.to).replace(' ', '')}${promotion}${suffix}`;
}
