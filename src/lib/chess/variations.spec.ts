import { it, expect } from 'vitest';
import { createVariationTree, addVariation, mergeLiveMoves, variationRows } from './variations';
import { legalMoves } from './index';

it('keeps sibling branches and original positions intact', () => {
	const tree = createVariationTree(),
		root = tree.nodes.get('root')!;
	const before = JSON.stringify(root.state),
		choices = legalMoves(root.state.board, root.state.turn);
	const a = addVariation(tree, 'root', choices[0]),
		b = addVariation(tree, 'root', choices[1]);
	expect(a.id).not.toBe(b.id);
	expect(root.children).toEqual([a.id, b.id]);
	expect(JSON.stringify(root.state)).toBe(before);
	expect(tree.mainline).toEqual(['root']);
	expect(addVariation(tree, 'root', choices[0])).toBe(a);
});
it('merges actual moves without replacing a branch or duplicating an identical move', () => {
	const tree = createVariationTree(),
		root = tree.nodes.get('root')!;
	const choices = legalMoves(root.state.board, root.state.turn);
	const branch = addVariation(tree, 'root', choices[0]),
		actual = addVariation(tree, 'root', choices[1]);
	mergeLiveMoves(tree, [actual.move!]);
	expect(tree.mainline).toEqual(['root', actual.id]);
	expect(tree.nodes.get(branch.id)).toBe(branch);
	expect(branch.live).toBe(false);
	const next = addVariation(tree, actual.id, legalMoves(actual.state.board, actual.state.turn)[0]);
	mergeLiveMoves(tree, [actual.move!, next.move!]);
	mergeLiveMoves(tree, [actual.move!, next.move!]);
	expect(tree.nodes.size).toBe(4);
	expect(tree.mainline).toEqual(['root', actual.id, next.id]);
	expect(variationRows(tree)[0].node.id).toBe(actual.id);
});
it('rejects illegal variations and waits for contiguous history', () => {
	const tree = createVariationTree();
	expect(() => addVariation(tree, 'root', { from: 0, to: 0 })).toThrow();
	expect(tree.nodes.size).toBe(1);
	const first = addVariation(tree, 'root', { from: 0, to: 32 });
	const second = addVariation(tree, first.id, legalMoves(first.state.board, first.state.turn)[0]);
	mergeLiveMoves(tree, [second.move!]);
	expect(tree.mainline).toEqual(['root']);
	mergeLiveMoves(tree, [first.move!, second.move!]);
	expect(tree.mainline).toEqual(['root', first.id, second.id]);
});
