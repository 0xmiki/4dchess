import { tick } from 'svelte';
import { inCheck, type Board } from '$lib/chess';
import type { HistoryMove } from '$lib/chess/history';
import { gameSounds, type SoundCue } from './game-sounds';

export function historySound(move: HistoryMove, after?: Board): SoundCue {
	const next = move.piece.c === 'w' ? 'b' : 'w';
	if (after?.some((piece) => piece?.t === 'k' && piece.c === next) && inCheck(after, next))
		return 'check';
	if (move.piece.t === 'p' && after?.[move.to] && after[move.to]?.t !== 'p') return 'promote';
	return move.captured ? 'capture' : 'move';
}

export async function playHistorySound(move: HistoryMove, after?: Board) {
	const cue = historySound(move, after);
	// Let the live audio observer cancel pending sounds before replaying history.
	await tick();
	await gameSounds.unlock();
	await gameSounds.play(cue);
}
