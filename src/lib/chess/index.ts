export type {
	Board,
	Color,
	Coordinates,
	GameState,
	Move,
	MoveError,
	MoveResult,
	Piece,
	PieceType,
	Result
} from './types';
export {
	RULES_VERSION,
	DIMENSIONS,
	SQUARE_COUNT,
	squareIndex,
	squareCoordinates,
	squareAddress,
	isSquare,
	otherColor,
	initialBoard,
	canReach,
	inCheck,
	legalMoves,
	positionKey,
	getOutcome,
	createInitialState,
	applyMove
} from './fourfold-v1';
