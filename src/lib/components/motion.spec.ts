import { expect, it } from 'vitest';
import { flatMotionPoint, motionDuration, spatialMotionPoint, type FlatPoint } from './motion';
import { projectCoordinate, DEFAULT_CAMERA } from '$lib/visuals/projection';
it('bows cross-board moves but leaves ordinary rook travel straight', () => {
	const a: FlatPoint = {
			x: 50,
			y: 300,
			size: 48,
			cellWidth: 64,
			plane: { left: 20, right: 276, top: 260, bottom: 516 }
		},
		b: FlatPoint = { ...a, x: 50, y: 50 };
	const rook = { t: 'r', c: 'w' } as const;
	const cross = { from: 0, to: 32 };
	expect(flatMotionPoint(a, b, cross, rook, 0, 600, 600)).toMatchObject({ x: a.x, y: a.y });
	expect(flatMotionPoint(a, b, cross, rook, 1, 600, 600).y).toBeCloseTo(b.y);
	expect(flatMotionPoint(a, b, cross, rook, 0.5, 600, 600).x).not.toBe(a.x);
	expect(flatMotionPoint(a, b, { from: 0, to: 4 }, rook, 0.5, 600, 600)).toMatchObject({
		x: 50,
		y: 175
	});
	expect(motionDuration(cross, rook)).toBe(1100);
	expect(motionDuration({ from: 0, to: 4 }, rook)).toBe(650);
});
it('keeps the spatial curve anchored at the original squares', () => {
	const project = (coordinate: Parameters<typeof projectCoordinate>[0]) =>
		projectCoordinate(coordinate, DEFAULT_CAMERA);
	const move = { from: 0, to: 32 },
		rook = { t: 'r', c: 'w' } as const;
	expect(spatialMotionPoint(project, move, rook, 0)).toEqual(project([0, 0, 0, 0]));
	const end = spatialMotionPoint(project, move, rook, 1),
		expected = project([0, 0, 0, 1]);
	expect(end.x).toBeCloseTo(expected.x);
	expect(end.y).toBeCloseTo(expected.y);
});

it('animates backward captures and promotions while preserving restored pieces', async () => {
	const { boardTransition } = await import('./motion');
	const { simulateMove } = await import('$lib/chess');
	const before = Array<import('$lib/chess').Piece | null>(64).fill(null);
	before[0] = { t: 'r', c: 'w' };
	before[32] = { t: 'b', c: 'b' };
	const move = { from: 0, to: 32, ply: 1 };
	const after = simulateMove(before, move);
	expect(boardTransition(before, after, move, null)).toMatchObject({
		from: 0,
		to: 32,
		reverse: false
	});
	expect(boardTransition(after, before, null, move)).toMatchObject({
		from: 32,
		to: 0,
		piece: { t: 'r', c: 'w' },
		captured: null,
		reverse: true
	});
	expect(before[32]).toEqual({ t: 'b', c: 'b' });
	const pawn = Array<import('$lib/chess').Piece | null>(64).fill(null);
	pawn[8] = { t: 'p', c: 'w' };
	const promotion = { from: 8, to: 12 };
	const promoted = simulateMove(pawn, promotion);
	expect(boardTransition(promoted, pawn, null, promotion)).toMatchObject({
		from: 12,
		to: 8,
		reverse: true
	});
	expect(pawn[8]?.t).toBe('p');
	expect(boardTransition(before, pawn, null, move)).toBeNull();
});

it('scales spatial arcs with distance and retraces them in reverse', () => {
	const project = (coordinate: Parameters<typeof projectCoordinate>[0]) =>
		projectCoordinate(coordinate, DEFAULT_CAMERA);
	for (const move of [
		{ from: 0, to: 32 },
		{ from: 0, to: 16 },
		{ from: 1, to: 35 }
	]) {
		const piece = { t: move.from === 1 ? 'n' : 'r', c: 'w' } as const;
		for (const t of [0, 0.2, 0.5, 0.8, 1]) {
			const forward = spatialMotionPoint(project, move, piece, t);
			const backward = spatialMotionPoint(project, { from: move.to, to: move.from }, piece, 1 - t);
			expect(forward.x).toBeCloseTo(backward.x);
			expect(forward.y).toBeCloseTo(backward.y);
		}
	}
	const simpleProject = ([x, y, z, w]: readonly number[]) => ({
		x: x + z * 10,
		y: y + w * 10,
		depth: 0,
		scale: 1
	});
	const tiny = spatialMotionPoint(simpleProject, { from: 0, to: 16 }, { t: 'r', c: 'w' }, 0.5);
	expect(Math.abs(tiny.y)).toBeLessThan(2);
});
