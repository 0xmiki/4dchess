import type { Move, Piece } from '$lib/chess';
export type PresentedMove = Move & { piece?: Piece; captured?: Piece | null; ply?: number };
export type PieceMotion = Move & { piece: Piece; captured: Piece | null; progress: number };
