export const DEMO_TIMING = {
	orbit: 1100,
	selection: 1100,
	preview: 700,
	move: 1500,
	settle: 450
} as const;
export const DEMO_CAMERA_IDLE = 60_000;
export function demoFrame(
	elapsed: number,
	orbit = DEMO_TIMING.orbit as number,
	moveDuration = DEMO_TIMING.move as number
) {
	const movementStart = orbit + DEMO_TIMING.selection + DEMO_TIMING.preview;
	const phase =
		elapsed < orbit
			? 'orbit'
			: elapsed < orbit + DEMO_TIMING.selection
				? 'selection'
				: elapsed < movementStart
					? 'preview'
					: elapsed < movementStart + moveDuration
						? 'move'
						: 'settle';
	const ease = (value: number) => {
		const t = Math.max(0, Math.min(1, value));
		return t * t * (3 - 2 * t);
	};
	return {
		phase,
		cameraProgress: orbit ? ease(elapsed / orbit) : 1,
		pieceProgress: ease((elapsed - movementStart) / moveDuration),
		done: elapsed >= movementStart + moveDuration + DEMO_TIMING.settle
	};
}
