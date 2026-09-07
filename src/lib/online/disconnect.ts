import { timeControls, type TimedControl } from './time-controls';
export const PRESENCE_VERSION = 1 as const;
export const HEARTBEAT_MS = 10_000;
export const PRESENCE_LEASE_MS = 30_000;
export const MAX_PLAYING_SESSIONS = 8;
export type PresenceSide = 'white' | 'black';
export type Coverage = { start: number; end: number };
export type DisconnectCandidate = {
	side: PresenceSide;
	episode: number;
	deadline: number;
	state: 'armed' | 'waitingOpponent';
};
export function reconnectGrace(control: TimedControl): number {
	const { initialMs, incrementMs } = timeControls[control];
	return Math.max(30_000, Math.min(180_000, (initialMs + 40 * incrementMs) * 0.1));
}
export function presentAt(coverage: readonly Coverage[], at: number): boolean {
	return coverage.some((interval) => interval.start <= at && at < interval.end);
}
export function extendCoverage(coverage: readonly Coverage[], now: number): Coverage[] {
	const next = coverage.map((interval) => ({ ...interval }));
	const last = next.at(-1);
	// Touching intervals still have a lease-expiry boundary. Keep that boundary explicit.
	if (last && now < last.end) last.end = Math.max(last.end, now + PRESENCE_LEASE_MS);
	else next.push({ start: now, end: now + PRESENCE_LEASE_MS });
	return next;
}
export function pruneCoverage(
	coverage: readonly Coverage[],
	now: number,
	candidate?: DisconnectCandidate
): Coverage[] {
	return coverage.filter(
		(interval, index) =>
			index === coverage.length - 1 ||
			interval.end > now ||
			(candidate?.state === 'armed' &&
				interval.start <= candidate.deadline &&
				candidate.deadline < interval.end)
	);
}
export function currentCandidate(
	candidate: DisconnectCandidate | undefined,
	coverage: readonly Coverage[],
	side: PresenceSide,
	turnStartedAt: number,
	now: number,
	grace: number
): DisconnectCandidate | undefined {
	if (presentAt(coverage, now)) return undefined;
	const episode = coverage.at(-1)?.end;
	if (episode === undefined) return undefined;
	if (candidate?.side === side && candidate.episode === episode) return candidate;
	return { side, episode, deadline: Math.max(episode, turnStartedAt) + grace, state: 'armed' };
}
