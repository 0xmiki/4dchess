import type {
	Board,
	Color,
	Coordinates,
	GameState,
	Move,
	MoveResult,
	Piece,
	Result
} from './types';

export const RULES_VERSION = 'fourfold-v1' as const;
export const DIMENSIONS = [4, 4, 2, 2] as const;
export const SQUARE_COUNT = 64;

export function isSquare(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value < SQUARE_COUNT;
}

export function squareIndex([x, y, z, w]: Coordinates): number {
	const coordinates = [x, y, z, w];
	if (
		coordinates.some(
			(value, axis) => !Number.isInteger(value) || value < 0 || value >= DIMENSIONS[axis]
		)
	) {
		throw new RangeError('Coordinates must be within the 4 × 4 × 2 × 2 board.');
	}
	return x + 4 * y + 16 * z + 32 * w;
}

export function squareCoordinates(square: number): Coordinates {
	if (!isSquare(square)) throw new RangeError('Square must be an integer from 0 to 63.');
	return [
		square % 4,
		Math.floor(square / 4) % 4,
		Math.floor(square / 16) % 2,
		Math.floor(square / 32)
	];
}

export function squareAddress(square: number): string {
	const [x, y, z, w] = squareCoordinates(square);
	return `${'abcd'[x]}${y + 1} [${z},${w}]`;
}

export function otherColor(color: Color): Color {
	return color === 'w' ? 'b' : 'w';
}

// Private geometry is computed once. No per-game state lives at module scope.
const coordinates = Array.from({ length: SQUARE_COUNT }, (_, square) => squareCoordinates(square));
const paths = coordinates.map((from, source) =>
	coordinates.map((to, destination) => {
		if (source === destination) return null;
		const delta = to.map((value, axis) => value - from[axis]);
		const distances = delta.filter(Boolean).map(Math.abs);
		const equal = distances.every((distance) => distance === distances[0]);
		const between: number[] = [];
		if (equal) {
			for (let step = 1; step < distances[0]; step++) {
				between.push(
					squareIndex([
						from[0] + Math.sign(delta[0]) * step,
						from[1] + Math.sign(delta[1]) * step,
						from[2] + Math.sign(delta[2]) * step,
						from[3] + Math.sign(delta[3]) * step
					])
				);
			}
		}
		return {
			delta,
			axes: distances.length,
			equal,
			between,
			king: Math.max(...distances) === 1,
			knight: distances.length === 2 && distances.includes(1) && distances.includes(2)
		};
	})
);

export function initialBoard(): Board {
	const board: (Piece | null)[] = Array(SQUARE_COUNT).fill(null);
	const put = (at: Coordinates, t: Piece['t'], c: Color) => {
		board[squareIndex(at)] = { t, c };
	};
	(['r', 'n', 'k', 'q'] as const).forEach((piece, x) => put([x, 0, 0, 0], piece, 'w'));
	for (let x = 0; x < 4; x++) put([x, 1, 0, 0], 'p', 'w');
	put([1, 0, 1, 0], 'b', 'w');
	put([2, 0, 1, 0], 'r', 'w');
	(['q', 'k', 'n', 'r'] as const).forEach((piece, x) => put([x, 3, 1, 1], piece, 'b'));
	for (let x = 0; x < 4; x++) put([x, 2, 1, 1], 'p', 'b');
	put([2, 3, 0, 1], 'b', 'b');
	put([1, 3, 0, 1], 'r', 'b');
	return board;
}

/** Geometric reach, including blocking, but not the moving side's king safety.
 * Attack mode includes defended friendly squares and pawn capture geometry.
 */
export function canReach(board: Board, from: number, to: number, attack = false): boolean {
	if (!isSquare(from) || !isSquare(to)) return false;
	const piece = board[from];
	const path = paths[from][to];
	if (!piece || !path) return false;
	const target = board[to];
	if (!attack && target?.c === piece.c) return false;
	const { delta, axes, equal, between, king, knight } = path;
	if (piece.t === 'p') {
		if (delta[1] !== (piece.c === 'w' ? 1 : -1)) return false;
		const lateral = Math.abs(delta[0]) + Math.abs(delta[2]) + Math.abs(delta[3]);
		return attack
			? lateral === 1
			: (!target && lateral === 0) || (!!target && target.c !== piece.c && lateral === 1);
	}
	if (piece.t === 'n') return knight;
	if (piece.t === 'k') return king;
	if (!equal || (piece.t === 'r' && axes !== 1) || (piece.t === 'b' && axes !== 2)) return false;
	return between.every((square) => !board[square]);
}

export function inCheck(board: Board, color: Color): boolean {
	const king = board.findIndex((piece) => piece?.c === color && piece.t === 'k');
	if (king < 0) return true;
	// Pinned pieces still control squares for king safety.
	return board.some(
		(piece, from) => piece && piece.c !== color && canReach(board, from, king, true)
	);
}

function moveBoard(board: Board, move: Move): Board {
	const next = board.slice();
	let piece = next[move.from]!;
	next[move.from] = null;
	if (piece.t === 'p' && coordinates[move.to][1] === (piece.c === 'w' ? 3 : 0)) {
		piece = { t: 'q', c: piece.c };
	}
	next[move.to] = piece;
	return next;
}

/** Apply geometry for search and threat previews. This does not establish move legality. */
export function simulateMove(board: Board, move: Move): Board {
	if (!isSquare(move.from) || !isSquare(move.to) || !board[move.from])
		throw new RangeError('Invalid simulation move.');
	return moveBoard(board, move);
}

export function legalMoves(board: Board, color: Color, onlyFrom?: number): Move[] {
	if (onlyFrom !== undefined && !isSquare(onlyFrom)) return [];
	const moves: Move[] = [];
	for (let from = 0; from < SQUARE_COUNT; from++) {
		const piece = board[from];
		if (!piece || piece.c !== color || (onlyFrom !== undefined && from !== onlyFrom)) continue;
		for (let to = 0; to < SQUARE_COUNT; to++) {
			if (board[to]?.t === 'k' || !canReach(board, from, to)) continue;
			const move = { from, to };
			if (!inCheck(moveBoard(board, move), color)) moves.push(move);
		}
	}
	return moves;
}

export function positionKey(board: Board, turn: Color): string {
	return turn + board.map((piece) => (piece ? piece.c + piece.t : '--')).join('');
}

export function getOutcome(
	board: Board,
	turn: Color,
	halfmoveClock = 0,
	positionKeys: readonly string[] = []
): Result | null {
	// Preserve prototype precedence, including checkmate before automatic draws.
	if (!legalMoves(board, turn).length) {
		return inCheck(board, turn)
			? { reason: 'checkmate', winner: turn === 'w' ? 'black' : 'white' }
			: { reason: 'draw', winner: null, detail: 'stalemate' };
	}
	if (board.every((piece) => !piece || piece.t === 'k'))
		return { reason: 'draw', winner: null, detail: 'bareKings' };
	if (halfmoveClock >= 100) return { reason: 'draw', winner: null, detail: 'fiftyMove' };
	const key = positionKey(board, turn);
	if (positionKeys.filter((previous) => previous === key).length >= 3)
		return { reason: 'draw', winner: null, detail: 'repetition' };
	return null;
}

export function createInitialState(): GameState {
	const board = initialBoard();
	return {
		rulesVersion: RULES_VERSION,
		board,
		turn: 'w',
		ply: 0,
		halfmoveClock: 0,
		positionKeys: [positionKey(board, 'w')],
		result: null
	};
}

/** Accept only states created by the engine or loaded from trusted storage.
 * Network adapters must validate their input shape and authorize the caller.
 */
export function applyMove(state: GameState, move: Move): MoveResult {
	if (state.rulesVersion !== RULES_VERSION)
		return { ok: false, error: 'UNSUPPORTED_RULES_VERSION' };
	if (!isSquare(move.from) || !isSquare(move.to)) return { ok: false, error: 'INVALID_MOVE' };
	if (state.result || getOutcome(state.board, state.turn, state.halfmoveClock, state.positionKeys))
		return { ok: false, error: 'GAME_OVER' };
	if (!legalMoves(state.board, state.turn, move.from).some((legal) => legal.to === move.to))
		return { ok: false, error: 'ILLEGAL_MOVE' };
	const irreversible = state.board[move.from]!.t === 'p' || state.board[move.to] !== null;
	const board = moveBoard(state.board, move);
	const turn = otherColor(state.turn);
	const halfmoveClock = irreversible ? 0 : state.halfmoveClock + 1;
	const key = positionKey(board, turn);
	const positionKeys = irreversible ? [key] : [...state.positionKeys, key];
	return {
		ok: true,
		state: {
			rulesVersion: RULES_VERSION,
			board,
			turn,
			ply: state.ply + 1,
			halfmoveClock,
			positionKeys,
			result: getOutcome(board, turn, halfmoveClock, positionKeys)
		}
	};
}
