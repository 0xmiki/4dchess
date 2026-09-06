import { squareCoordinates, type Coordinates, type Move, type Piece } from '$lib/chess';
export type PresentedMove = Move & { piece?: Piece; captured?: Piece | null; ply?: number };
export type PieceMotion = Move & { piece: Piece; captured: Piece | null; progress: number };
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
	const wave = Math.sin(Math.PI * t);
	if (piece.t === 'n') p.y -= wave * 21;
	else if (crossesBoards(move)) {
		const start = project(a),
			end = project(b),
			dx = end.x - start.x,
			dy = end.y - start.y,
			length = Math.hypot(dx, dy) || 1;
		p.x -= (dy / length) * wave * 12;
		p.y += (dx / length) * wave * 12;
	}
	return p;
}
