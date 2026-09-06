import {
	legalMoves,
	canReach,
	inCheck,
	simulateMove,
	positionKey,
	otherColor,
	squareCoordinates
} from './fourfold-v1';
import type { Board, Color, GameState, Move } from './types';

export const difficulties = {
	easy: { label: 'Easy', budgetMs: 250, maxDepth: 2, quiescence: 0, cacheLimit: 4096 },
	medium: { label: 'Medium', budgetMs: 500, maxDepth: 4, quiescence: 2, cacheLimit: 4096 },
	hard: { label: 'Hard', budgetMs: 1800, maxDepth: 6, quiescence: 2, cacheLimit: 16384 },
	extreme: { label: 'Extreme', budgetMs: 6000, maxDepth: 9, quiescence: 3, cacheLimit: 32768 }
} as const;
export type Difficulty = keyof typeof difficulties;
type Options = { budgetMs: number; maxDepth: number; quiescence: number; cacheLimit: number };
export type SearchResult = { move: Move | null; depth: number; nodes: number; elapsed: number };
const values = { p: 100, n: 330, b: 360, r: 470, q: 950, k: 0 };
const MATE = 100000,
	INF = 200000;
const coordinates = Array.from({ length: 64 }, (_, i) => squareCoordinates(i));

/** Prototype search translated to shared rules: iterative deepening, alpha-beta,
 * capture search, bounded caches, and repetition-aware transposition identity. */
export function searchPosition(
	state: GameState,
	options: Options,
	progress: (result: SearchResult) => void = () => {}
): SearchResult {
	const started = performance.now(),
		deadline = started + options.budgetMs;
	const timeout = Symbol('timeout');
	let nodes = 0,
		hash1 = 0,
		hash2 = 0;
	const repeats = new Map<string, { count: number; hash: [number, number] }>();
	const table = new Map<
		string,
		{ depth: number; score: number; move: Move | null; flag: number }
	>();
	const evaluations = new Map<string, number>();
	function hash(key: string): [number, number] {
		let a = 2166136261,
			b = 0x9e3779b9;
		for (let i = 0; i < key.length; i++) {
			a = Math.imul(a ^ key.charCodeAt(i), 16777619);
			b = Math.imul(b ^ key.charCodeAt(i), 2246822519);
		}
		return [a >>> 0, b >>> 0];
	}
	function enter(key: string) {
		let entry = repeats.get(key);
		if (!entry) {
			entry = { count: 0, hash: hash(key) };
			repeats.set(key, entry);
		}
		entry.count++;
		hash1 = (hash1 + entry.hash[0]) >>> 0;
		hash2 = (hash2 + entry.hash[1]) >>> 0;
	}
	function leave(key: string) {
		const entry = repeats.get(key)!;
		hash1 = (hash1 - entry.hash[0]) >>> 0;
		hash2 = (hash2 - entry.hash[1]) >>> 0;
		if (--entry.count === 0) repeats.delete(key);
	}
	function put<K, V>(map: Map<K, V>, key: K, value: V) {
		if (!map.has(key) && map.size >= options.cacheLimit) map.delete(map.keys().next().value!);
		map.set(key, value);
	}
	function tick() {
		nodes++;
		if ((nodes & 15) === 0 && performance.now() >= deadline) throw timeout;
	}
	function draw(board: Board, key: string, quiet: number) {
		return (
			quiet >= 100 || (repeats.get(key)?.count ?? 0) >= 3 || board.every((p) => !p || p.t === 'k')
		);
	}
	function evaluate(board: Board, color: Color, key: string) {
		let score = evaluations.get(key.slice(1));
		if (score === undefined) {
			score = 0;
			for (let i = 0; i < 64; i++) {
				const p = board[i];
				if (!p) continue;
				const [x, y] = coordinates[i];
				let worth = values[p.t];
				if (p.t === 'p') worth += (p.c === 'w' ? y : 3 - y) * 24;
				else if (p.t !== 'k') worth += (3 - Math.abs(x - 1.5) - Math.abs(y - 1.5)) * 5;
				let defended = false,
					attacked = false,
					mobility = 0;
				for (let j = 0; j < 64; j++) {
					if (canReach(board, i, j, true) && (!board[j] || board[j]!.c !== p.c)) mobility++;
					const other = board[j];
					if (other && canReach(board, j, i, true)) {
						if (other.c === p.c) defended = true;
						else attacked = true;
					}
				}
				if (p.t !== 'p' && p.t !== 'k') worth += mobility * (p.t === 'q' ? 0.5 : 1);
				if (attacked) worth -= p.t === 'k' ? 45 : values[p.t] * (defended ? 0.035 : 0.14);
				score += (p.c === 'w' ? 1 : -1) * worth;
			}
			put(evaluations, key.slice(1), score);
		}
		return color === 'w' ? score : -score;
	}
	function order(board: Board, moves: Move[], preferred: Move | null) {
		const rank = (m: Move) =>
			(preferred && m.from === preferred.from && m.to === preferred.to ? 1000000 : 0) +
			(board[m.to] ? values[board[m.to]!.t] * 10 - values[board[m.from]!.t] : 0) +
			(board[m.from]!.t === 'p' && coordinates[m.to][1] === (board[m.from]!.c === 'w' ? 3 : 0)
				? 9000
				: 0);
		return moves.sort((a, b) => rank(b) - rank(a));
	}
	function child(
		board: Board,
		color: Color,
		move: Move,
		quiet: number,
		visit: (b: Board, c: Color, q: number, k: string) => number
	) {
		const next = simulateMove(board, move),
			side = otherColor(color),
			key = positionKey(next, side),
			clock = board[move.from]!.t === 'p' || board[move.to] ? 0 : quiet + 1;
		enter(key);
		try {
			return visit(next, side, clock, key);
		} finally {
			leave(key);
		}
	}
	function quiesce(
		board: Board,
		color: Color,
		alpha: number,
		beta: number,
		ply: number,
		left: number,
		quiet: number,
		key: string
	): number {
		tick();
		const checked = inCheck(board, color),
			all = legalMoves(board, color);
		if (!all.length) return checked ? -MATE + ply : 0;
		if (draw(board, key, quiet)) return 0;
		const stand = evaluate(board, color, key);
		if (left <= 0) return stand;
		if (!checked) {
			if (stand >= beta) return stand;
			alpha = Math.max(alpha, stand);
		}
		const moves = checked
			? all
			: all.filter(
					(m) =>
						board[m.to] ||
						(board[m.from]!.t === 'p' && coordinates[m.to][1] === (color === 'w' ? 3 : 0))
				);
		let best = checked ? -INF : stand;
		for (const move of order(board, moves, null)) {
			const score = -child(board, color, move, quiet, (b, c, q, k) =>
				quiesce(b, c, -beta, -alpha, ply + 1, left - 1, q, k)
			);
			best = Math.max(best, score);
			alpha = Math.max(alpha, score);
			if (alpha >= beta) break;
		}
		return best;
	}
	function search(
		board: Board,
		color: Color,
		depth: number,
		alpha: number,
		beta: number,
		ply: number,
		quiet: number,
		key: string
	): number {
		if (depth <= 0) return quiesce(board, color, alpha, beta, ply, options.quiescence, quiet, key);
		tick();
		const cacheKey = `${key}|${quiet}|${hash1}:${hash2}`,
			entry = table.get(cacheKey),
			originalAlpha = alpha;
		if (entry && entry.depth >= depth) {
			const score =
				entry.score > MATE - 100
					? entry.score - ply
					: entry.score < -MATE + 100
						? entry.score + ply
						: entry.score;
			if (
				entry.flag === 0 ||
				(entry.flag === 1 && score >= beta) ||
				(entry.flag === -1 && score <= alpha)
			)
				return score;
		}
		const moves = legalMoves(board, color);
		if (!moves.length) return inCheck(board, color) ? -MATE + ply : 0;
		if (draw(board, key, quiet)) return 0;
		let best = -INF,
			bestMove: Move | null = null;
		for (const move of order(board, moves, entry?.move ?? null)) {
			const score = -child(board, color, move, quiet, (b, c, q, k) =>
				search(b, c, depth - 1, -beta, -alpha, ply + 1, q, k)
			);
			if (score > best) {
				best = score;
				bestMove = move;
			}
			alpha = Math.max(alpha, score);
			if (alpha >= beta) break;
		}
		put(table, cacheKey, {
			depth,
			score: best > MATE - 100 ? best + ply : best < -MATE + 100 ? best - ply : best,
			move: bestMove,
			flag: best <= originalAlpha ? -1 : best >= beta ? 1 : 0
		});
		return best;
	}
	const { board, turn, halfmoveClock } = state,
		key = positionKey(board, turn);
	for (const past of state.positionKeys.length ? state.positionKeys : [key]) enter(past);
	const moves = order(board, legalMoves(board, turn), null);
	if (state.result || !moves.length || draw(board, key, halfmoveClock))
		return { move: null, depth: 0, nodes, elapsed: performance.now() - started };
	let bestMove: Move = moves[0],
		depth = 0;
	progress({ move: bestMove, depth, nodes, elapsed: 0 });
	for (let nextDepth = 1; nextDepth <= options.maxDepth; nextDepth++) {
		let candidate = bestMove,
			best = -INF,
			alpha = -INF;
		try {
			for (const move of order(board, moves, bestMove)) {
				if (performance.now() >= deadline) throw timeout;
				const score = -child(board, turn, move, halfmoveClock, (b, c, q, k) =>
					search(b, c, nextDepth - 1, -INF, -alpha, 1, q, k)
				);
				if (score > best) {
					best = score;
					candidate = move;
				}
				alpha = Math.max(alpha, score);
			}
		} catch (error) {
			if (error !== timeout) throw error;
			break;
		}
		bestMove = candidate;
		depth = nextDepth;
		progress({ move: bestMove, depth, nodes, elapsed: performance.now() - started });
		if (Math.abs(best) > MATE - 100) break;
	}
	return { move: bestMove, depth, nodes, elapsed: performance.now() - started };
}
