import { expect, it } from 'vitest';
import { createInitialState } from '$lib/chess';
import { projectCoordinate, cameraForMove } from './projection';
it('uses the same fixed scale horizontally and vertically', () => {
	const camera = { yaw: 0, pitch: 0 };
	for (const w of [0, 1]) {
		const x = projectCoordinate([0, 1.5, 0.5, w], camera),
			y = projectCoordinate([1.5, 0, 0.5, w], camera);
		expect(220 - x.x).toBeCloseTo(y.y - 220, 10);
	}
});
it('chooses angles from the move geometry, not its ply number', () => {
	const board = createInitialState().board,
		current = { yaw: -0.48, pitch: 0.26 };
	const a = cameraForMove(board, { from: 0, to: 32 }, current),
		b = cameraForMove(board, { from: 1, to: 35 }, current);
	expect(a).not.toEqual(b);
	for (const [move, camera] of [
		[{ from: 0, to: 32 }, a],
		[{ from: 1, to: 35 }, b]
	] as const) {
		expect(Number.isFinite(camera.yaw)).toBe(true);
		expect(Math.abs(camera.yaw - current.yaw)).toBeLessThanOrEqual(Math.PI);
		expect(move.from).not.toBe(move.to);
	}
});
