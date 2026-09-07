export const historyMotionKey = Symbol('history-motion');

export function createHistoryMotion() {
	let lastAt = -Infinity,
		taps = 0,
		repeats = 0,
		sequence = 0,
		consumed = 0;
	let cap = Infinity;
	return {
		record(now: number, held: boolean) {
			const gap = now - lastAt;
			if (gap > 650) {
				taps = 0;
				repeats = 0;
			}
			if (held) {
				repeats++;
				cap = repeats >= 4 ? 0 : 140 / repeats;
			} else {
				repeats = 0;
				taps = gap < 650 ? taps + 1 : 1;
				cap = taps >= 4 ? 0 : taps > 1 ? Math.min(220 / (taps - 1), gap * 0.7) : Infinity;
			}
			lastAt = now;
			sequence++;
		},
		consume(now: number) {
			if (sequence === consumed || now - lastAt > 250) return Infinity;
			consumed = sequence;
			return cap;
		}
	};
}
export type HistoryMotion = ReturnType<typeof createHistoryMotion>;
