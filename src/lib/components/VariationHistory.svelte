<script lang="ts">
	import { tick } from 'svelte';
	import { moveNotation } from '$lib/chess/history';
	import { variationRows, type VariationTree } from '$lib/chess/variations';
	let {
		tree,
		version,
		selected,
		onselect
	}: { tree: VariationTree; version: number; selected: string; onselect: (id: string) => void } =
		$props();
	const rows = $derived.by(() => {
		void version;
		return variationRows(tree);
	});
	let root: HTMLDivElement;
	$effect(() => {
		const id = selected;
		void tick().then(() => {
			const button = root?.querySelector<HTMLElement>(`[data-node="${id}"]`);
			if (!button || !root) return;
			if (button.offsetTop < root.scrollTop) root.scrollTop = button.offsetTop;
			else if (button.offsetTop + button.offsetHeight > root.scrollTop + root.clientHeight)
				root.scrollTop = button.offsetTop + button.offsetHeight - root.clientHeight;
		});
	});
</script>

<div class="variation-history" bind:this={root} aria-label="Move history and variations">
	<button
		data-node="root"
		aria-current={selected === 'root' ? 'step' : undefined}
		onclick={() => onselect('root')}>Starting position</button
	>
	{#each rows as { node, depth } (node.id)}
		{@const parent = tree.nodes.get(node.parent!)!}
		{@const notation = moveNotation(node.move!, parent.state.board, node.state.board)}
		<div class="move-row" class:variation={!node.live} style:--depth={Math.min(depth, 4)}>
			{#if !node.live && (parent.live || parent.children.length > 1)}<small
					>Variation from move {parent.state.ply}</small
				>{/if}
			<button
				data-node={node.id}
				data-live-ply={node.live ? node.state.ply : undefined}
				aria-label={`${node.live ? 'Move' : 'Variation move'} ${node.state.ply}: ${notation}`}
				aria-current={selected === node.id ? 'step' : undefined}
				onclick={() => onselect(node.id)}
			>
				<span class="number"
					>{Math.ceil(node.state.ply / 2)}{node.move!.piece.c === 'w' ? '.' : '…'}</span
				>{notation}
			</button>
		</div>
	{/each}
</div>

<style>
	.variation-history {
		position: relative;
		max-height: 360px;
		overflow: auto;
	}
	button {
		display: flex;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2);
		min-height: 36px;
		border-radius: 5px;
		text-align: left;
		cursor: pointer;
		font: 12px var(--font-data);
	}
	button:hover {
		background: var(--surface);
	}
	button[aria-current] {
		background: var(--line);
		color: var(--text);
	}
	.number {
		min-width: 24px;
		color: var(--muted);
	}
	.move-row {
		margin-left: calc(var(--depth) * var(--space-3));
	}
	.variation {
		border-left: 2px solid var(--primary-fill);
		padding-left: var(--space-1);
	}
	small {
		display: block;
		color: var(--muted);
		font-size: 11px;
		padding: var(--space-2);
	}
</style>
