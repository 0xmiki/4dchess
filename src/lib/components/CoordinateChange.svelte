<script lang="ts">
	import type { Coordinates } from '$lib/chess';
	let { from, to }: { from: Coordinates; to: Coordinates } = $props();
	const axes = ['X', 'Y', 'Z', 'W'];
	const value = (axis: number, n: number) => (axis === 0 ? 'abcd'[n] : axis === 1 ? n + 1 : n);
</script>

<div class="coordinate-change" aria-label="Coordinate changes">
	{#each axes as axis, i (axis)}<div class:changed={from[i] !== to[i]} class:fourth={i === 3}>
			<span>{axis}</span><strong
				>{value(i, from[i])}{#if from[i] !== to[i]}
					→ {value(i, to[i])}{/if}</strong
			>
		</div>{/each}
</div>

<style>
	.coordinate-change {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
		font-family: var(--font-data);
		font-size: 12px;
	}
	.coordinate-change > div {
		display: grid;
		gap: 4px;
		border-top: 1px solid var(--line);
		padding-top: 8px;
		color: var(--muted);
	}
	.coordinate-change span {
		font-size: 11px;
	}
	.coordinate-change strong {
		font-weight: 500;
	}
	.coordinate-change .changed {
		color: var(--accent);
		border-color: var(--accent);
	}
	.coordinate-change .fourth.changed {
		color: var(--axis-w);
		border-color: var(--axis-w);
	}
</style>
