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
export function motionDuration(move: Move, _piece?: Piece) {
	void _piece;
	return crossesBoards(move) ? 380 : 240;
}
export function motionProgress(progress: number, move: Move) {
	const t = Math.max(0, Math.min(1, progress));
	return crossesBoards(move)
		? t < 0.5
			? 4 * t ** 3
			: 1 - (-2 * t + 2) ** 3 / 2
		: 1 - (1 - t) ** 3;
}
export type Point = { x: number; y: number };
export type FlatPoint = Point & {
	size: number;
	cellWidth: number;
	plane: { left: number; right: number; top: number; bottom: number };
};
const lifts: Record<Piece['t'], number> = {
	p: 12 / 70,
	n: 48 / 70,
	b: 8 / 70,
	r: 0,
	q: 20 / 70,
	k: 5 / 70
};
export function motionPoint(a: Point, b: Point, move: Move, piece: Piece, t: number, unit: number) {
	const dx = b.x - a.x,
		dy = b.y - a.y,
		distance = Math.hypot(dx, dy);
	if (crossesBoards(move)) {
		const controlY = Math.max(0, (a.y + b.y) / 2 - Math.min((unit * 60) / 70, distance * 0.12));
		const tangentY = 2 * ((1 - t) * (controlY - a.y) + t * (b.y - controlY));
		return {
			x: a.x + dx * t,
			y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * controlY + t ** 2 * b.y,
			angle: (Math.atan2(tangentY, dx) * 180) / Math.PI,
			velocityScale: distance > 0.001 ? Math.min(1, Math.hypot(dx, tangentY) / distance) : 0
		};
	}
	const lift = unit * lifts[piece.t];
	return {
		x: a.x + dx * t,
		y: a.y + dy * t - Math.sin(Math.PI * t) * lift,
		angle: (Math.atan2(dy - Math.PI * Math.cos(Math.PI * t) * lift, dx) * 180) / Math.PI,
		velocityScale: 1
	};
}
export function piecePose(a: Point, b: Point, motion: PieceMotion, unit: number) {
	unit = Math.max(1, unit);
	const raw = Math.max(0, Math.min(1, motion.progress)),
		t = motionProgress(raw, motion);
	const point = motionPoint(a, b, motion, motion.piece, t, unit),
		distance = Math.hypot(b.x - a.x, b.y - a.y);
	const warp = crossesBoards(motion) ? Math.sin(Math.PI * raw) ** 1.5 * point.velocityScale : 0;
	const wave = Math.sin(Math.PI * t),
		direction = Math.sign(b.x - a.x) || 1,
		kind = motion.piece.t;
	const rotation = wave * direction * { p: 0, n: -13, b: 9, r: 0, q: -4, k: 4 }[kind] * (1 - warp);
	const stretch = wave * { p: 0.07, n: 0.1, b: 0.025, r: -0.035, q: 0.05, k: -0.02 }[kind];
	return {
		...point,
		warp,
		rotation,
		sx: 1 - stretch * 0.5,
		sy: 1 + stretch,
		warpScale: 1 + (Math.max(1, Math.min(4, distance / unit)) - 1) * warp,
		warpThin: 1 - 0.94 * warp,
		length: Math.min((unit * 170) / 70, distance * 0.42) * warp
	};
}
export function flatMotionPoint(
	a: FlatPoint,
	b: FlatPoint,
	move: Move,
	piece: Piece,
	t: number,
	_width: number,
	_height: number
) {
	void _width;
	void _height;
	return { ...motionPoint(a, b, move, piece, t, a.cellWidth), size: a.size };
}
export type ProjectedPoint = { x: number; y: number; depth: number; scale: number };
export function spatialMotionPoint(
	project: (coordinate: Coordinates) => ProjectedPoint,
	move: Move,
	piece: Piece,
	t: number
) {
	// The spatial view follows the projected move without piece-specific embellishment.
	void piece;
	const a = squareCoordinates(move.from),
		b = squareCoordinates(move.to);
	return project(a.map((v, i) => v + (b[i] - v) * t) as unknown as Coordinates);
}
