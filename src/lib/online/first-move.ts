export const FIRST_MOVE_MS = 30_000;

// Absence of a deadline keeps games created before this policy on their original rules.
export function nextFirstMoveDeadline(current: number | undefined, nextPly: number, now: number) {
	return current !== undefined && nextPly === 1 ? now + FIRST_MOVE_MS : undefined;
}
