export const DEMO_TIMING = {
	orbit: 1100,
	selection: 1100,
	preview: 700,
	move: 1500,
	settle: 450
} as const;
export const DEMO_DURATION = Object.values(DEMO_TIMING).reduce(
	(sum, duration) => sum + duration,
	0
);
export function demoFrame(elapsed: number) {
	const { orbit, selection, preview, move } = DEMO_TIMING;
	const movementStart = orbit + selection + preview;
	const phase =
		elapsed < orbit
			? 'orbit'
			: elapsed < orbit + selection
				? 'selection'
				: elapsed < movementStart
					? 'preview'
					: elapsed < movementStart + move
						? 'move'
						: 'settle';
	const ease = (value: number) => {
		const t = Math.max(0, Math.min(1, value));
		return t * t * (3 - 2 * t);
	};
	return {
		phase,
		cameraProgress: ease(elapsed / orbit),
		pieceProgress: ease((elapsed - movementStart) / move),
		done: elapsed >= DEMO_DURATION
	};
}
