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
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		background: white;
		min-width: 42px;
		min-height: 42px;
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
		background: #fafbf9;
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		z-index: 10;
	}
	.menu-items :global(button) {
		border: 0;
		text-align: left;
	}
</style>
