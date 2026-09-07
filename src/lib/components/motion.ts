import {
	simulateMove,
	squareCoordinates,
	type Board,
	type Coordinates,
	type Move,
	type Piece
} from '$lib/chess';
export type PresentedMove = Move & { piece?: Piece; captured?: Piece | null; ply?: number };
export type PieceMotion = Move & { piece: Piece; captured: Piece | null; progress: number };
export function boardTransition(
	before: Board,
	after: Board,
	forward: PresentedMove | null,
	backward: PresentedMove | null
) {
	const equal = (a: Board, b: Board) =>
		a.every((piece, i) => piece?.t === b[i]?.t && piece?.c === b[i]?.c);
	if (forward && before[forward.from] && equal(simulateMove(before, forward), after)) {
		return {
			...forward,
			piece: before[forward.from]!,
			captured: before[forward.to],
			reverse: false
		};
	}
	if (backward && after[backward.from] && equal(simulateMove(after, backward), before)) {
		return {
			from: backward.to,
			to: backward.from,
			ply: backward.ply,
			piece: before[backward.to]!,
			captured: before[backward.from],
			reverse: true
		};
	}
	return null;
}
export function crossesBoards(move: Move) {
	const a = squareCoordinates(move.from),
		b = squareCoordinates(move.to);
	return a[2] !== b[2] || a[3] !== b[3];
}
export function motionDuration(move: Move, piece: Piece) {
	return crossesBoards(move) ? 1100 : piece.t === 'n' ? 850 : 650;
}
export type FlatPoint = {
	x: number;
	y: number;
	size: number;
	cellWidth: number;
	plane: { left: number; right: number; top: number; bottom: number };
};
export function flatMotionPoint(
	a: FlatPoint,
	b: FlatPoint,
	move: Move,
	piece: Piece,
	t: number,
	width: number,
	height: number
) {
	const from = squareCoordinates(move.from),
		to = squareCoordinates(move.to),
		z = from[2] !== to[2],
		w = from[3] !== to[3];
	let bendX = 0,
		bendY = 0;
	if (w && !z) {
		const lane =
			a.x < (a.plane.left + a.plane.right) / 2
				? Math.max(4, a.plane.left - 14)
				: Math.min(width - 4, a.plane.right + 14);
		bendX = lane - a.x;
	} else if (z && !w) {
		const lane =
			a.y > (a.plane.top + a.plane.bottom) / 2
				? Math.min(height - 4, a.plane.bottom + 14)
				: Math.max(4, a.plane.top - 14);
		bendY = lane - a.y;
	} else if (z && w) bendX = Math.sign(b.x - a.x || 1) * a.cellWidth * 0.65;
	const lift = piece.t === 'n' ? a.cellWidth * 0.52 : 0;
	return {
		x: a.x + (b.x - a.x) * t + Math.sin(Math.PI * t) * bendX,
		y: a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * (bendY - lift),
		size: a.size
	};
}
export type ProjectedPoint = { x: number; y: number; depth: number; scale: number };
export function spatialMotionPoint(
	project: (coordinate: Coordinates) => ProjectedPoint,
	move: Move,
	piece: Piece,
	t: number
) {
	const a = squareCoordinates(move.from),
		b = squareCoordinates(move.to);
	const p = project(a.map((value, i) => value + (b[i] - value) * t) as unknown as Coordinates);
	const start = project(a),
		end = project(b);
	const dx = end.x - start.x,
		dy = end.y - start.y;
	const distance = Math.hypot(dx, dy);
	if (distance < 0.001 || (piece.t !== 'n' && !crossesBoards(move))) return p;

	// A quadratic arc keeps the preview and travelling piece on one smooth route.
	// Scale the lift with distance so short moves do not make oversized detours.
	const bow = 4 * t * (1 - t);
	p.x = start.x + dx * t;
	p.y = start.y + dy * t;
	if (piece.t === 'n') {
		p.y -= bow * Math.min(34, distance * 0.24);
	} else {
		// Canonical endpoint order makes backward review retrace the same curve.
		const direction = move.from < move.to ? 1 : -1;
		let nx = (-dy / distance) * direction,
			ny = (dx / distance) * direction;
		if (a[3] !== b[3]) {
			// Layer changes bow away from the center of the two projected endpoints.
			const center = project([1.5, 1.5, 0.5, (a[3] + b[3]) / 2]);
			if (nx * ((start.x + end.x) / 2 - center.x) + ny * ((start.y + end.y) / 2 - center.y) < 0) {
				nx = -nx;
				ny = -ny;
			}
		} else if (ny > 0) {
			nx = -nx;
			ny = -ny;
		}
		const lift = Math.min(26, distance * 0.14);
		p.x += nx * bow * lift;
		p.y += ny * bow * lift;
	}
	return p;
}
