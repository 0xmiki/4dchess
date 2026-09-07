export const timeControls = {
	'3+2': { label: '3 + 2', initialMs: 180000, incrementMs: 2000 },
	'5+3': { label: '5 + 3', initialMs: 300000, incrementMs: 3000 },
	'10+5': { label: '10 + 5', initialMs: 600000, incrementMs: 5000 }
} as const;
export type TimedControl = keyof typeof timeControls;
export type TimeControl = TimedControl | 'untimed';
export const START_DELAY_MS = 3000;
export type ClockState = { whiteMs: number; blackMs: number; turnStartedAt: number | null };
export function initialClock(control: TimedControl, startsAt: number | null): ClockState {
	const initialMs = timeControls[control].initialMs;
	return { whiteMs: initialMs, blackMs: initialMs, turnStartedAt: startsAt };
}
export function remainingTime(
	clock: ClockState,
	turn: 'w' | 'b',
	side: 'white' | 'black',
	now: number
) {
	const remaining = side === 'white' ? clock.whiteMs : clock.blackMs;
	const running = clock.turnStartedAt !== null && (turn === 'w' ? 'white' : 'black') === side;
	return Math.max(0, remaining - (running ? Math.max(0, now - clock.turnStartedAt!) : 0));
}
export function clockAfterMove(
	clock: ClockState,
	turn: 'w' | 'b',
	control: TimedControl,
	now: number
): ClockState {
	const side = turn === 'w' ? 'white' : 'black';
	return {
		...clock,
		[side === 'white' ? 'whiteMs' : 'blackMs']:
			remainingTime(clock, turn, side, now) + timeControls[control].incrementMs,
		turnStartedAt: now
	};
}
export function stoppedClock(clock: ClockState, turn: 'w' | 'b', now: number): ClockState {
	return {
		whiteMs: remainingTime(clock, turn, 'white', now),
		blackMs: remainingTime(clock, turn, 'black', now),
		turnStartedAt: null
	};
}
export function timeControlLabel(control?: TimeControl) {
	return !control || control === 'untimed' ? 'Untimed' : timeControls[control].label;
}
