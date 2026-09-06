<script lang="ts">
	import type { Snippet } from 'svelte';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	let { children }: { children: Snippet } = $props();
	let details: HTMLDetailsElement;
	export function close() {
		if (details) details.open = false;
	}
	export function focus() {
		details?.querySelector('summary')?.focus();
	}
	function key(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
			focus();
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		details.open = true;
		const items = Array.from(details.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
		const current = items.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? items.length - 1
					: (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
		items[next]?.focus();
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (details?.open && !details.contains(event.target as Node)) close();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && details?.open) {
			close();
			focus();
		}
	}}
/>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Keyboard handling extends the native details disclosure.) -->
<details bind:this={details} class="game-menu" onkeydown={key}>
	<summary aria-label="Game options"><DotsThreeIcon size={24} weight="bold" />Options</summary>
	<div class="menu-items">{@render children()}</div>
</details>

<style>
	.game-menu {
		position: relative;
		color: var(--text);
	}
	summary {
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		border-radius: 8px;
		font-size: 14px;
	}
	summary:hover,
	.game-menu[open] summary {
		background: var(--surface-raised);
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.menu-items {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		display: grid;
		min-width: 200px;
		padding: var(--space-1);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		box-shadow: 0 8px 24px #0006;
		z-index: 10;
	}
	.menu-items :global(button),
	.menu-items :global(button:active:not(:disabled)) {
		min-height: 40px;
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-radius: 6px;
		box-shadow: none;
		transform: none;
		background: transparent;
		justify-content: flex-start;
		text-align: left;
		font-weight: 450;
		font-size: 14px;
	}
	.menu-items :global(button:hover:not(:disabled)),
	.menu-items :global(button:focus-visible) {
		background: var(--surface-raised);
		outline: none;
	}
</style>
