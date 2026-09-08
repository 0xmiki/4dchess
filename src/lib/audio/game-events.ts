import { inCheck, type Board, type Color } from '$lib/chess';
import { boardTransition, motionDuration, type PresentedMove } from '$lib/components/motion';
import type { SoundCue } from './game-sounds';
export type SoundSnapshot = {
	key: string;
	board: Board;
	turn: Color;
	ply: number;
	active: boolean;
	result: { reason: string } | null;
	move: PresentedMove | null;
	seat: Color | null;
	remaining?: number | null;
	notification?: string | null;
	audible?: boolean;
	announceStart?: boolean;
	now: number;
};
export type SoundEvent = { cue: SoundCue; delay: number };
export class GameSoundTracker {
	private last: SoundSnapshot | null = null;
	private before: Board | null = null;
	private soundedPly = 0;
	private changedAt = 0;
	private ended = false;
	private low = false;
	update(s: SoundSnapshot): SoundEvent[] {
		const previous = this.last;
		this.last = s;
		if (!previous || previous.key !== s.key) {
			this.before = null;
			this.soundedPly = s.ply;
			this.ended = !!s.result;
			this.low = false;
			return s.active &&
				s.ply === 0 &&
				!s.result &&
				s.announceStart !== false &&
				s.audible !== false
				? [{ cue: 'start', delay: 0 }]
				: [];
		}
		const events: SoundEvent[] = [];
		if (s.ply !== previous.ply) {
			this.before = s.ply === previous.ply + 1 ? previous.board : null;
			this.changedAt = s.now;
			if (!this.before) this.soundedPly = s.ply;
		}
		if (!this.ended && s.result) {
			this.ended = true;
			this.soundedPly = s.ply;
			const finalMove =
				this.before && s.move ? boardTransition(this.before, s.board, s.move, null) : null;
			if (!['aborted', 'cancellation'].includes(s.result.reason))
				events.push({
					cue: s.result.reason === 'checkmate' ? 'checkmate' : 'end',
					delay:
						s.result.reason === 'checkmate' && this.before
							? Math.max(
									0,
									(finalMove ? motionDuration(finalMove) : 380) - (s.now - this.changedAt)
								)
							: 0
				});
		} else if (
			!this.ended &&
			this.before &&
			s.move &&
			this.soundedPly < s.ply &&
			(s.move.ply === undefined || s.move.ply === s.ply)
		) {
			const transition = boardTransition(this.before, s.board, s.move, null);
			if (transition) {
				this.soundedPly = s.ply;
				const checked =
					s.board.some((p) => p?.t === 'k' && p.c === s.turn) && inCheck(s.board, s.turn);
				const promotion = transition.piece.t === 'p' && s.board[transition.to]?.t !== 'p';
				const cue: SoundCue = checked
					? 'check'
					: promotion
						? 'promote'
						: transition.captured
							? 'capture'
							: s.seat && transition.piece.c === s.seat
								? 'move'
								: 'opponent';
				if (s.now - this.changedAt < 2000)
					events.push({
						cue,
						delay: Math.max(0, motionDuration(transition) - (s.now - this.changedAt))
					});
			}
		}
		if (!previous.active && s.active && s.ply === 0 && !s.result && s.announceStart !== false)
			events.push({ cue: 'start', delay: 0 });
		if (
			!this.low &&
			s.active &&
			s.seat === s.turn &&
			s.remaining != null &&
			s.remaining > 0 &&
			s.remaining <= 10000
		) {
			this.low = true;
			events.push({ cue: 'low-time', delay: 0 });
		}
		if (s.notification && s.notification !== previous.notification)
			events.push({ cue: 'notify', delay: 0 });
		if (s.audible === false) {
			this.soundedPly = s.ply;
			return [];
		}
		return events;
	}
}
