import { expect, it } from 'vitest';
import { demoFrame, DEMO_TIMING } from './demo-timeline';
it('reveals the move with the camera before selecting and moving the piece', () => {
	expect(demoFrame(550)).toMatchObject({ phase: 'orbit', cameraProgress: 0.5, pieceProgress: 0 });
	expect(demoFrame(1600)).toMatchObject({
		phase: 'selection',
		cameraProgress: 1,
		pieceProgress: 0
	});
	expect(demoFrame(2500)).toMatchObject({ phase: 'preview', pieceProgress: 0 });
	expect(demoFrame(3650)).toMatchObject({ phase: 'move', cameraProgress: 1, pieceProgress: 0.5 });
	expect(demoFrame(4500).phase).toBe('settle');
	expect(demoFrame(Object.values(DEMO_TIMING).reduce((a, b) => a + b, 0)).done).toBe(true);
});
it('continues the same move sequence without orbiting during manual camera control', () => {
	expect(demoFrame(500, 0)).toMatchObject({ phase: 'selection', pieceProgress: 0 });
	expect(demoFrame(2550, 0)).toMatchObject({ phase: 'move', pieceProgress: 0.5 });
	expect(demoFrame(3750, 0).done).toBe(true);
});
