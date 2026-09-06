import { difficulties, searchPosition, type Difficulty } from './search';
import type { GameState } from './types';

self.onmessage = (
	event: MessageEvent<{ id: number; state: GameState; difficulty: Difficulty }>
) => {
	const { id, state, difficulty } = event.data;
	try {
		const options = difficulties[difficulty];
		if (!options) throw new Error('Unknown difficulty');
		const result = searchPosition(state, options, (progress) =>
			self.postMessage({ type: 'progress', id, ...progress })
		);
		self.postMessage({ type: 'result', id, ...result });
	} catch {
		self.postMessage({ type: 'error', id });
	}
};
