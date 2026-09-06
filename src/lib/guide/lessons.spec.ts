import { describe, expect, it } from 'vitest';
import {
	canReach,
	squareIndex,
	type Board,
	type Coordinates,
	type Piece,
	type PieceType
} from '../chess';
import { lessons, lessonOrder } from './lessons';

function example(piece: PieceType, to: Coordinates): Board {
	const lesson = lessons[piece];
	const board: (Piece | null)[] = Array(64).fill(null);
	board[squareIndex(lesson.from)] = { t: piece, c: 'w' };
	if ('capture' in lesson && lesson.capture) board[squareIndex(to)] = { t: 'r', c: 'b' };
	return board;
}
describe('teaching examples agree with fourfold-v1', () => {
	it.each(lessonOrder)('%s has valid 3D and 4D examples and an invalid common mistake', (piece) => {
		const lesson = lessons[piece],
			from = squareIndex(lesson.from);
		expect(canReach(example(piece, lesson.three), from, squareIndex(lesson.three))).toBe(true);
		expect(canReach(example(piece, lesson.four), from, squareIndex(lesson.four))).toBe(true);
		expect(canReach(example(piece, lesson.bad), from, squareIndex(lesson.bad))).toBe(false);
	});
});
