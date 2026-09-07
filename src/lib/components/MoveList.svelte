<script lang="ts">
	import { tick } from 'svelte';
	import HistoryShortcuts from './HistoryShortcuts.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { moveNotation, type HistoryMove } from '$lib/chess/history';
	import type { Board } from '$lib/chess';
	let {
		moves,
		positions = new SvelteMap<number, Board>(),
		selectedPly = 0,
		livePly = 0,
		onselect = () => {}
	}: {
		moves: readonly HistoryMove[];
		positions?: Map<number, Board>;
		selectedPly?: number;
		livePly?: number;
		onselect?: (ply: number) => void;
	} = $props();
	let root: HTMLDivElement;
	const rows = $derived.by(() => {
		const pairs: [number, HistoryMove[]][] = [];
		for (const move of [...moves].sort((a, b) => a.ply - b.ply)) {
			const n = Math.ceil(move.ply / 2);
			const last = pairs.at(-1);
			if (last?.[0] === n) last[1].push(move);
			else pairs.push([n, [move]]);
		}
		return pairs;
	});
	const available = $derived([...positions.keys()].sort((a, b) => a - b));
	$effect(() => {
		const ply = selectedPly;
		void moves.length;
		void tick().then(() =>
			(() => {
				const item = root?.querySelector(`[data-ply="${ply}"]`),
					container = root?.closest('.move-content');
				if (!item || !container) return;
				const r = item.getBoundingClientRect(),
					c = container.getBoundingClientRect();
				if (r.bottom > c.bottom) container.scrollTop += r.bottom - c.bottom;
				else if (r.top < c.top) container.scrollTop -= c.top - r.top;
			})()
		);
	});
	function step(direction: number) {
		const i = available.indexOf(selectedPly);
		const next = available[i + direction];
		if (next !== undefined) onselect(next);
	}
</script>

<HistoryShortcuts previous={() => step(-1)} next={() => step(1)} />

<div bind:this={root} class="score-sheet">
	<ol class="moves">
		{#each rows as [number, pair] (number)}<li>
				<span class="move-number">{number}.</span>{#each [0, 1] as side (side)}{@const move =
						pair.find((m) => (m.ply - 1) % 2 === side)}{#if move}<button
							data-ply={move.ply}
							aria-label={`Move ${move.ply}: ${moveNotation(move, positions.get(move.ply - 1), positions.get(move.ply))}`}
							aria-current={selectedPly === move.ply ? 'step' : undefined}
							class:current={selectedPly === move.ply}
							disabled={!positions.has(move.ply)}
							onclick={() => onselect(move.ply)}
							>{moveNotation(move, positions.get(move.ply - 1), positions.get(move.ply))}</button
						>{:else}<span></span>{/if}{/each}
			</li>{/each}
	</ol>
</div>
<div class="history-controls">
	<button
		aria-label="Previous move"
		aria-keyshortcuts="ArrowLeft"
		disabled={!available.some((p) => p < selectedPly)}
		onclick={() => step(-1)}>‹</button
	><span>{selectedPly === livePly ? 'Live' : `Move ${selectedPly}`}</span><button
		aria-label="Next move"
		aria-keyshortcuts="ArrowRight"
		disabled={selectedPly >= livePly}
		onclick={() => step(1)}>›</button
	>{#if selectedPly !== livePly}<button onclick={() => onselect(livePly)}>Live</button>{/if}
</div>

<style>
	.moves {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.moves li {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr);
		gap: 4px;
		align-items: start;
	}
	.move-number {
		padding-top: 9px;
		color: var(--muted);
		font-size: 12px;
	}
	button {
		cursor: pointer;
		border-radius: 5px;
		padding: 8px 5px;
		min-height: 34px;
		text-align: left;
		font: 12px var(--font-data);
		overflow-wrap: anywhere;
	}
	.moves button:hover {
		background: var(--surface);
	}
	.moves button.current {
		background: var(--line);
		color: var(--text);
	}
	.history-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: center;
		position: sticky;
		bottom: 0;
		background: var(--page);
		padding-top: 8px;
		font-size: 12px;
		color: var(--muted);
	}
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.history-controls button {
		min-width: 30px;
		text-align: center;
	}
</style>
