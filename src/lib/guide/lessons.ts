import type { Coordinates, PieceType } from '../chess';

export type Lesson = {
	name: string;
	from: Coordinates;
	three: Coordinates;
	four: Coordinates;
	bad: Coordinates;
	capture?: boolean;
	title: string;
	rule: string;
	threeText: string;
	fourText: string;
	takeaway: string;
	flatText: string;
	note: string;
	badTitle: string;
	badText: string;
};

// Movement examples and explanations adapted from the original Fourfold guide.
export const lessons = {
	r: {
		name: 'Rook',
		from: [0, 0, 0, 0],
		three: [0, 0, 1, 0],
		four: [0, 0, 0, 1],
		bad: [1, 0, 0, 1],
		title: 'A straight line can point along W.',
		rule: 'A rook changes exactly one coordinate. In 3D, that can be Z. In 4D, W is another choice, with X, Y, and Z staying fixed.',
		threeText: 'The rook changes layers inside one cube. Only Z changes.',
		fourText: 'The rook changes cubes at the same X, Y, and Z. Only W changes.',
		takeaway: 'Same square, other cube.',
		flatText:
			'The rook goes from a1 in the bottom-left board to a1 in the top-left board. The diagonal-looking line between the cubes represents one straight W step.',
		note: "This is the W move available to White's a1 rook in the starting position.",
		badTitle: 'Two changed axes is too many for a rook.',
		badText:
			'a1 [0,0] → b1 [0,1] changes both X and W. A bishop or queen can use this diagonal; a rook cannot.'
	},
	b: {
		name: 'Bishop',
		from: [0, 0, 0, 0],
		three: [1, 0, 1, 0],
		four: [1, 0, 0, 1],
		bad: [1, 1, 0, 1],
		title: 'A diagonal still changes exactly two axes.',
		rule: "A bishop changes two coordinates by equal amounts. The pair can include W. This game's bishop never changes three coordinates in one move.",
		threeText: 'One step along X and one along Z makes a diagonal within the cube.',
		fourText: 'Replace Z with W: one X step and one W step make a diagonal between cubes.',
		takeaway: 'Move across a file as you change cubes.',
		flatText:
			'a1 in the bottom-left board becomes b1 in the top-left board. X and W each increase by one; Y and Z stay fixed.',
		note: 'A bishop can also change Z and W together, arriving at the same file and rank in a diagonally opposite board.',
		badTitle: 'A three-axis diagonal belongs to the queen.',
		badText:
			'a1 [0,0] → b2 [0,1] changes X, Y, and W. The distances match, but a bishop must change exactly two axes.'
	},
	n: {
		name: 'Knight',
		from: [0, 0, 0, 0],
		three: [2, 0, 1, 0],
		four: [2, 0, 0, 1],
		bad: [1, 0, 0, 1],
		title: 'Keep the 2 + 1 jump. Change which axes you use.',
		rule: 'The knight changes one coordinate by two and a different coordinate by one. It can make its one-step part along W.',
		threeText: 'Jump two files along X and one layer along Z.',
		fourText: 'Jump two files along X and one cube along W. Y and Z stay fixed.',
		takeaway: 'Two files over, one cube across.',
		flatText:
			'The knight leaves a1 in the bottom-left board and arrives at c1 in the top-left board. The X change is two, and the W change is one.',
		note: 'The curved line represents a jump, not a sequence of occupied squares. The knight skips intervening pieces. Only X or Y is long enough for the two-step part.',
		badTitle: 'A 1 + 1 diagonal is not a knight jump.',
		badText:
			'a1 [0,0] → b1 [0,1] changes X and W by one each. A knight needs a two-step change as well as a one-step change.'
	},
	q: {
		name: 'Queen',
		from: [0, 0, 0, 0],
		three: [1, 1, 1, 0],
		four: [1, 1, 1, 1],
		bad: [2, 1, 1, 1],
		title: 'The queen can use all four axes at once.',
		rule: 'Choose one, two, three, or four axes. Every changed coordinate must move by the same amount. This example changes each selected coordinate by one.',
		threeText: 'One step each along X, Y, and Z follows a diagonal through the cube.',
		fourText:
			'Add one W step. The move goes diagonally inside the cube while changing to the other cube.',
		takeaway: 'A 3D diagonal, plus a change of cube.',
		flatText:
			'a1 in the bottom-left board becomes b2 in the top-right board. All four coordinates change by one, so the move is legal for a queen.',
		note: 'The queen can also use an ordinary file, rank, two-axis diagonal, or three-axis diagonal. It is blocked by pieces along its full 4D path.',
		badTitle: 'All changed distances must match.',
		badText:
			'a1 [0,0] → c2 [1,1] changes X by two, but Y, Z, and W by one. A queen cannot mix these distances in one move.'
	},
	k: {
		name: 'King',
		from: [0, 0, 0, 0],
		three: [1, 1, 1, 0],
		four: [1, 1, 1, 1],
		bad: [2, 1, 1, 1],
		title: 'A neighboring square can differ on every axis.',
		rule: 'A king moves at most one step on each axis, using any combination. A square in the other cube can therefore be a neighbor, even when it looks far away.',
		threeText: 'One step on X, Y, and Z reaches a neighboring square in 3D.',
		fourText: 'A one-step change on W as well reaches a neighboring square in 4D.',
		takeaway: 'Count coordinate steps, not screen distance.',
		flatText:
			'The king can move from a1 in the bottom-left board to b2 in the top-right board. Each coordinate changes by just one.',
		note: 'This example shows movement only. In a game, an attacked destination is illegal. The opposing king also controls its neighbors across W.',
		badTitle: 'The king cannot take a two-step move.',
		badText:
			'a1 [0,0] → c2 [1,1] changes X by two. Every changed coordinate of a king move must change by only one.'
	},
	p: {
		name: 'Pawn',
		from: [0, 1, 0, 0],
		three: [0, 2, 1, 0],
		four: [0, 2, 0, 1],
		bad: [0, 1, 0, 1],
		capture: true,
		title: 'Forward stays Y. Captures can reach across W.',
		rule: 'A white pawn captures one rank forward plus one step along exactly one other axis. W is allowed for that other axis. A non-capturing move only advances along Y.',
		threeText: 'Capture the black rook one rank forward and one Z layer away.',
		fourText: 'Capture the black rook one rank forward in the other W cube.',
		takeaway: 'Change cubes only as part of a forward capture.',
		flatText:
			'White captures from a2 in the bottom-left board to a3 in the top-left board. The destination must contain an opposing piece.',
		note: 'Black goes the other way along Y. White promotes at rank 4, Black at rank 1, on any board. Promotion is automatically to a queen.',
		badTitle: 'A pawn cannot capture sideways along W.',
		badText:
			'a2 [0,0] → a2 [0,1] changes W but does not advance along Y. It is illegal even with an enemy piece on the destination.'
	}
} as const satisfies Record<PieceType, Lesson>;
export const lessonOrder: PieceType[] = ['r', 'b', 'n', 'q', 'k', 'p'];
