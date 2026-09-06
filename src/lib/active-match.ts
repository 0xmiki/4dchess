import { applyMove, createInitialState } from './chess';
export type ActiveMatch = { kind: 'friend'; gameId: string } | { kind: 'computer' };
const key = 'fourfold-active-match';
export function activeMatch(): ActiveMatch | null {
	try {
		const stored = localStorage.getItem(key);
		if (stored !== null) {
			const value = JSON.parse(stored);
			if (value?.kind === 'computer') {
				if (computerMatchActive()) return value;
				leaveMatch();
				return null;
			}
			if (value?.kind === 'friend' && /^[a-z0-9]+$/.test(value.gameId)) return value;
			return null;
		}
		const legacy = localStorage.getItem('fourfold-last-game');
		if (legacy && /^[a-z0-9]+$/.test(legacy)) return { kind: 'friend', gameId: legacy };
		return computerMatchActive() ? { kind: 'computer' } : null;
	} catch {
		return null;
	}
}
export function rememberMatch(match: ActiveMatch) {
	try {
		localStorage.setItem(key, JSON.stringify(match));
	} catch {
		/* Storage is optional. */
	}
}
/** Explicit null prevents legacy saves from opting back into auto-resume after leaving. */
export function leaveMatch() {
	try {
		localStorage.setItem(key, 'null');
		localStorage.removeItem('fourfold-last-game');
	} catch {
		/* Storage is optional. */
	}
}

export function computerMatchActive(): boolean {
	try {
		const saved = JSON.parse(localStorage.getItem('fourfold-computer-v1') ?? 'null');
		if (
			saved?.version !== 1 ||
			saved.resigned ||
			!Array.isArray(saved.moves) ||
			saved.moves.length > 10000 ||
			!['w', 'b'].includes(saved.player)
		)
			return false;
		let state = createInitialState();
		for (const move of saved.moves) {
			const applied = applyMove(state, move);
			if (!applied.ok) return false;
			state = applied.state;
		}
		return !state.result;
	} catch {
		return false;
	}
}
