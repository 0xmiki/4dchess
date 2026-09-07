import { applyMove, createInitialState, inCheck, squareAddress } from './fourfold-v1';
import type { Move } from './types';

export type ExportResult = {
	reason: string;
	winner: 'white' | 'black' | null;
	detail?: string;
} | null;
export function exportGame(
	moves: readonly Move[],
	options: {
		white?: string;
		black?: string;
		result?: ExportResult;
		date?: number;
		site?: string;
		timeControl?: string;
	} = {}
) {
	let state = createInitialState();
	const notation: string[] = [];
	for (const move of moves) {
		const piece = state.board[move.from];
		const captured = state.board[move.to];
		const next = applyMove(state, move);
		if (!next.ok || !piece) throw new Error('Cannot export an invalid move history.');
		const promotion = piece.t === 'p' && next.state.board[move.to]?.t === 'q';
		const suffix =
			next.state.result?.reason === 'checkmate'
				? '#'
				: inCheck(next.state.board, next.state.turn)
					? '+'
					: '';
		notation.push(
			`${piece.t === 'p' ? '' : piece.t.toUpperCase()}${squareAddress(move.from).replace(' ', '')}${captured ? 'x' : '-'}${squareAddress(move.to).replace(' ', '')}${promotion ? '=Q' : ''}${suffix}`
		);
		state = next.state;
	}
	const result = options.result === undefined ? state.result : options.result;
	const marker =
		!result || result.reason === 'cancellation'
			? '*'
			: result.winner === 'white'
				? '1-0'
				: result.winner === 'black'
					? '0-1'
					: '1/2-1/2';
	const headers = {
		Event: '4D chess',
		Site: options.site ?? 'Local',
		Date: new Date(options.date ?? Date.now()).toISOString().slice(0, 10).replaceAll('-', '.'),
		Round: '-',
		White: options.white ?? 'White',
		Black: options.black ?? 'Black',
		Result: marker,
		Variant: '4D Chess',
		Board: '4x4x2x2',
		Notation: '4D-LAN',
		Rules: 'fourfold-v1',
		...(options.timeControl ? { TimeControl: options.timeControl } : {})
	};
	const quote = (value: string) =>
		value
			.replace(/[\r\n]/g, ' ')
			.replaceAll('\\', '\\\\')
			.replaceAll('"', '\\"');
	const pairs: string[] = [];
	for (let i = 0; i < notation.length; i += 2)
		pairs.push(`${i / 2 + 1}. ${notation[i]}${notation[i + 1] ? ' ' + notation[i + 1] : ''}`);
	return (
		Object.entries(headers)
			.map(([key, value]) => `[${key} "${quote(value)}"]`)
			.join('\n') +
		'\n\n' +
		pairs.join(' ') +
		' ' +
		marker +
		'\n'
	);
}
