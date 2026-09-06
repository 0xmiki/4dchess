import { squareCoordinates, type Board, type Coordinates, type Move } from '$lib/chess';
export type Camera = { yaw: number; pitch: number };
export const DEFAULT_CAMERA: Camera = { yaw: -0.48, pitch: 0.26 };
export const PROJECTION_SCALE = 86;
export function projectCoordinate([x, y, z, w]: Coordinates, { yaw, pitch }: Camera) {
	const wScale = 2.05 / (2.7 - (w * 2 - 1));
	const px = (x / 1.5 - 1) * wScale,
		py = (y / 1.5 - 1) * wScale,
		pz = (z * 2 - 1) * wScale;
	const rx = px * Math.cos(yaw) + pz * Math.sin(yaw),
		rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
	const ry = py * Math.cos(pitch) - rz * Math.sin(pitch),
		depth = py * Math.sin(pitch) + rz * Math.cos(pitch);
	const scale = 5.5 / (5.5 - depth);
	return {
		x: 220 + rx * PROJECTION_SCALE * scale,
		y: 220 - ry * PROJECTION_SCALE * scale,
		depth,
		scale
	};
}
/** Prefer a visible move path, unobscured endpoints, and a modest camera turn. */
export function cameraForMove(board: Board, move: Move, current: Camera): Camera {
	let best = current,
		bestScore = -Infinity;
	for (const yaw of [-0.85, -0.65, -0.48, -0.25, 0.1, 0.3, 0.48, 0.65])
		for (const pitch of [0.14, 0.26, 0.38]) {
			const camera = { yaw, pitch };
			const a = projectCoordinate(squareCoordinates(move.from), camera),
				b = projectCoordinate(squareCoordinates(move.to), camera);
			const dx = b.x - a.x,
				dy = b.y - a.y,
				length = Math.hypot(dx, dy);
			let score =
				Math.min(length, 180) -
				Math.abs(camera.yaw - current.yaw) * 24 -
				Math.abs(pitch - current.pitch) * 24;
			// Keep the inner layer readable across all pieces, not just the moving piece.
			const inner = board.flatMap((piece, i) =>
				piece && i < 32 ? [projectCoordinate(squareCoordinates(i), camera)] : []
			);
			for (let i = 0; i < inner.length; i++)
				for (let j = i + 1; j < inner.length; j++) {
					const distance = Math.hypot(inner[i].x - inner[j].x, inner[i].y - inner[j].y);
					if (distance < 22) score -= (22 - distance) * 2.5;
				}
			// Avoid a face-on cube, which hides how the layers connect.
			score += Math.abs(Math.sin(2 * camera.yaw)) * 18;
			for (let i = 0; i < 64; i++) {
				if (!board[i] || i === move.from || i === move.to) continue;
				const point = projectCoordinate(squareCoordinates(i), camera);
				const t = Math.max(
					0,
					Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length || 1))
				);
				const distance = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
				if (distance < 24 && point.depth > a.depth + (b.depth - a.depth) * t - 0.15)
					score -= (24 - distance) * 2;
			}
			if (score > bestScore) {
				bestScore = score;
				best = camera;
			}
		}
	return best;
}
