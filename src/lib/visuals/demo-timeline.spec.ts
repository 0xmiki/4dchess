import { expect, it } from 'vitest';
import { demoFrame, DEMO_TIMING, DEMO_DURATION } from './demo-timeline';
it('holds selection and preview stationary before moving the piece', () => {
	const select = DEMO_TIMING.orbit,
		preview = select + DEMO_TIMING.selection,
		move = preview + DEMO_TIMING.preview;
	expect(demoFrame(select + 500)).toMatchObject({
		phase: 'selection',
		pieceProgress: 0,
		cameraProgress: 1
	});
	expect(demoFrame(preview + 300)).toMatchObject({
		phase: 'preview',
		pieceProgress: 0,
		cameraProgress: 1
	});
	expect(demoFrame(move)).toMatchObject({ phase: 'move', pieceProgress: 0 });
	expect(demoFrame(move + DEMO_TIMING.move / 2).pieceProgress).toBeCloseTo(0.5);
	expect(demoFrame(DEMO_DURATION - 1)).toMatchObject({
		phase: 'settle',
		pieceProgress: 1,
		done: false
	});
	expect(demoFrame(DEMO_DURATION).done).toBe(true);
});
