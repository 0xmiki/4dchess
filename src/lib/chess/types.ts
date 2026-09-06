export type Color = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Coordinates = readonly [x: number, y: number, z: number, w: number];

// Preserve the prototype's compact piece and square representation.
export type Piece = Readonly<{ t: PieceType; c: Color }>;
export type Board = readonly (Piece | null)[];
export type Move = Readonly<{ from: number; to: number }>;

export type Result =
	| { reason: 'checkmate'; winner: 'white' | 'black' }
	| {
			reason: 'draw';
			winner: null;
			detail: 'stalemate' | 'repetition' | 'fiftyMove' | 'bareKings';
	  };

// Session identity, match lifecycle, revisions, and resignation belong to Convex.
export type GameState = Readonly<{
	rulesVersion: 'fourfold-v1';
	board: Board;
	turn: Color;
	ply: number;
	halfmoveClock: number;
	positionKeys: readonly string[];
	result: Result | null;
}>;

export type MoveError = 'UNSUPPORTED_RULES_VERSION' | 'GAME_OVER' | 'INVALID_MOVE' | 'ILLEGAL_MOVE';
export type MoveResult = { ok: true; state: GameState } | { ok: false; error: MoveError };
