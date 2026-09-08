import { describe, expect, it } from 'vitest';
import { simulateMove, type Board, type Piece } from '$lib/chess';
import { GameSoundTracker, type SoundSnapshot } from './game-events';
function board(): Board {
	const b: (Piece | null)[] = Array(64).fill(null);
	b[0] = { t: 'r', c: 'w' };
	b[12] = { t: 'k', c: 'w' };
	b[63] = { t: 'k', c: 'b' };
	return b;
}
function snapshot(overrides: Partial<SoundSnapshot> = {}): SoundSnapshot {
	return {
		key: 'game',
		board: board(),
		turn: 'w',
		ply: 0,
		active: true,
		result: null,
		move: null,
		seat: 'w',
		now: 0,
		...overrides
	};
}
describe('live game sound events', () => {
	it('announces a fresh game once, but not a restored finished position', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot();
		expect(tracker.update(s)).toEqual([{ cue: 'start', delay: 0 }]);
		expect(tracker.update({ ...s, now: 10 })).toEqual([]);
		expect(
			new GameSoundTracker().update({
				...s,
				ply: 12,
				result: { reason: 'checkmate' },
				active: false
			})
		).toEqual([]);
	});
	it('waits for matching move metadata and does not repeat on acknowledgement', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot();
		tracker.update(s);
		const move = { from: 0, to: 1, ply: 1 },
			after = { ...s, board: simulateMove(s.board, move), turn: 'b' as const, ply: 1, now: 100 };
		expect(tracker.update(after)).toEqual([]);
		expect(tracker.update({ ...after, move, now: 150 })).toEqual([{ cue: 'move', delay: 190 }]);
		expect(tracker.update({ ...after, move, now: 200 })).toEqual([]);
	});
	it('uses the seat for opponent sounds and capture precedence', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot({ seat: 'b' });
		tracker.update(s);
		const move = { from: 0, to: 1, ply: 1 };
		expect(
			tracker.update({ ...s, board: simulateMove(s.board, move), turn: 'b', ply: 1, move, now: 10 })
		).toEqual([{ cue: 'opponent', delay: 240 }]);
		const captureBoard = board().slice();
		captureBoard[1] = { t: 'b', c: 'b' };
		const other = new GameSoundTracker(),
			before = snapshot({ board: captureBoard });
		other.update(before);
		expect(
			other.update({
				...before,
				board: simulateMove(captureBoard, move),
				ply: 1,
				turn: 'b',
				move,
				now: 10
			})
		).toEqual([{ cue: 'capture', delay: 240 }]);
	});
	it('plays checkmate once instead of layering move, check and end', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot();
		tracker.update(s);
		const move = { from: 0, to: 1, ply: 1 };
		const end = {
			...s,
			board: simulateMove(s.board, move),
			ply: 1,
			move,
			result: { reason: 'checkmate' },
			active: false,
			now: 10
		};
		expect(tracker.update(end)).toEqual([{ cue: 'checkmate', delay: 240 }]);
		expect(tracker.update({ ...end, now: 20 })).toEqual([]);
	});
	it('plays independent endings once for resignation and ignores waiting-room cancellation', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot();
		tracker.update(s);
		const end = { ...s, result: { reason: 'resignation' }, active: false };
		expect(tracker.update(end)).toEqual([{ cue: 'end', delay: 0 }]);
		expect(tracker.update(end)).toEqual([]);
		const waiting = new GameSoundTracker();
		waiting.update({ ...s, active: false });
		expect(waiting.update({ ...end, result: { reason: 'cancellation' } })).toEqual([]);
	});
	it('does not replay background moves when leaving history or reconnecting', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot();
		tracker.update(s);
		const move = { from: 0, to: 1, ply: 1 },
			after = { ...s, board: simulateMove(s.board, move), turn: 'b' as const, ply: 1, now: 100 };
		expect(tracker.update({ ...after, audible: false })).toEqual([]);
		expect(tracker.update({ ...after, move, audible: true, now: 150 })).toEqual([]);
		expect(tracker.update({ ...after, ply: 9, move: { ...move, ply: 9 } })).toEqual([]);
	});
	it('warns only once for the local running clock and signals new rematch offers', () => {
		const tracker = new GameSoundTracker(),
			s = snapshot({ remaining: 15000 });
		tracker.update(s);
		expect(tracker.update({ ...s, remaining: 9000, now: 10 })).toEqual([
			{ cue: 'low-time', delay: 0 }
		]);
		expect(tracker.update({ ...s, remaining: 8000, now: 20 })).toEqual([]);
		expect(tracker.update({ ...s, remaining: 12000, now: 30 })).toEqual([]);
		expect(tracker.update({ ...s, remaining: 9000, now: 40, notification: 'rematch' })).toEqual([
			{ cue: 'notify', delay: 0 }
		]);
	});
});

it('does not use stale move metadata to rush a cross-board mate cue', () => {
	const tracker = new GameSoundTracker(),
		s = snapshot();
	tracker.update(s);
	const crossing = { from: 0, to: 32, ply: 1 };
	expect(
		tracker.update({
			...s,
			board: simulateMove(s.board, crossing),
			ply: 1,
			move: { from: 0, to: 1, ply: 0 },
			result: { reason: 'checkmate' },
			active: false,
			now: 20
		})
	).toEqual([{ cue: 'checkmate', delay: 380 }]);
});
