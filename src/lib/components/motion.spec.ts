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
