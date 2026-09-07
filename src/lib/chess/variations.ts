import { applyMove, createInitialState, type GameState, type Move } from './index';
import type { HistoryMove } from './history';

export type VariationNode = {
	id: string;
	parent: string | null;
	children: string[];
	state: GameState;
	move: HistoryMove | null;
	live: boolean;
};
export type VariationTree = {
	nodes: Map<string, VariationNode>;
	mainline: string[];
	nextId: number;
};
export function createVariationTree(): VariationTree {
	const root: VariationNode = {
		id: 'root',
		parent: null,
		children: [],
		state: createInitialState(),
		move: null,
		live: true
	};
	return { nodes: new Map([[root.id, root]]), mainline: [root.id], nextId: 1 };
}
export function addVariation(tree: VariationTree, parentId: string, move: Move): VariationNode {
	const parent = tree.nodes.get(parentId);
	if (!parent) throw new Error('Position unavailable');
	const existing = parent.children
		.map((id) => tree.nodes.get(id)!)
		.find((n) => n.move?.from === move.from && n.move.to === move.to);
	if (existing) return existing;
	const result = applyMove(parent.state, move);
	if (!result.ok) throw new Error('That move is not legal.');
	const node: VariationNode = {
		id: `variation-${tree.nextId++}`,
		parent: parent.id,
		children: [],
		state: result.state,
		live: false,
		move: {
			...move,
			ply: result.state.ply,
			piece: parent.state.board[move.from]!,
			captured: parent.state.board[move.to]
		}
	};
	tree.nodes.set(node.id, node);
	parent.children.push(node.id);
	return node;
}
export function mergeLiveMoves(tree: VariationTree, moves: readonly HistoryMove[]) {
	for (const move of moves) {
		if (move.ply < tree.mainline.length) continue;
		if (move.ply !== tree.mainline.length) break;
		const node = addVariation(tree, tree.mainline.at(-1)!, move);
		node.live = true;
		tree.mainline.push(node.id);
	}
}
// A flat depth-first view avoids deeply nested DOM while retaining every fork.
export function variationRows(tree: VariationTree): { node: VariationNode; depth: number }[] {
	const rows: { node: VariationNode; depth: number }[] = [];
	const stack = [...tree.nodes.get('root')!.children]
		.sort((a, b) => Number(tree.nodes.get(b)!.live) - Number(tree.nodes.get(a)!.live))
		.reverse()
		.map((id) => ({ id, depth: 0 }));
	while (stack.length) {
		const { id, depth } = stack.pop()!;
		const node = tree.nodes.get(id)!;
		rows.push({ node, depth });
		const children = [...node.children].sort(
			(a, b) => Number(tree.nodes.get(b)!.live) - Number(tree.nodes.get(a)!.live)
		);
		for (let i = children.length - 1; i >= 0; i--)
			stack.push({ id: children[i], depth: depth + (i > 0 ? 1 : 0) });
	}
	return rows;
}
