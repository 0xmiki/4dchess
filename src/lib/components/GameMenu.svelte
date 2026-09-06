<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
	let details: HTMLDetailsElement;
	export function close() {
		details.open = false;
	}
	export function focus() {
		details.querySelector('summary')?.focus();
	}
</script>

<details bind:this={details} class="game-menu">
	<summary aria-label="Game options">⋯</summary>
	<div class="menu-items">{@render children()}</div>
</details>

<style>
	.game-menu {
		position: relative;
	}
	.game-menu summary {
		cursor: pointer;
		list-style: none;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--surface);
		min-width: 44px;
		min-height: var(--control-height);
		display: grid;
		place-items: center;
		font-size: 24px;
	}
	.game-menu summary::-webkit-details-marker {
		display: none;
	}
	.menu-items {
		position: absolute;
		right: 0;
		top: 48px;
		display: grid;
		min-width: 170px;
		padding: 6px;
		background: var(--page);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		z-index: 10;
	}
	.menu-items :global(button) {
		justify-content: flex-start;
		border: 0;
		text-align: left;
	}
</style>
