import { expect, it } from 'vitest';
import { createHistoryMotion } from './history-motion';
it('accelerates rapid taps, consumes each gesture once, and resets after a pause', () => {
	const motion = createHistoryMotion();
	motion.record(0, false);
	expect(motion.consume(1)).toBe(Infinity);
	motion.record(200, false);
	expect(motion.consume(201)).toBe(140);
	expect(motion.consume(202)).toBe(Infinity);
	motion.record(400, false);
	expect(motion.consume(401)).toBe(110);
	motion.record(600, false);
	expect(motion.consume(601)).toBe(0);
	motion.record(1600, false);
	expect(motion.consume(1601)).toBe(Infinity);
});
it('recognizes held-key repeats even after the operating system repeat delay', () => {
	const held = createHistoryMotion(),
		taps = createHistoryMotion();
	held.record(0, false);
	held.consume(1);
	taps.record(0, false);
	taps.consume(1);
	held.record(500, true);
	taps.record(500, false);
	expect(held.consume(501)).toBe(140);
	expect(taps.consume(501)).toBe(220);
	for (const at of [540, 580, 620]) held.record(at, true);
	expect(held.consume(621)).toBe(0);
	held.record(1500, false);
	expect(held.consume(1501)).toBe(Infinity);
});
it('does not speed up unrelated updates after a stale gesture', () => {
	const motion = createHistoryMotion();
	motion.record(0, false);
	motion.record(100, false);
	expect(motion.consume(1000)).toBe(Infinity);
});
