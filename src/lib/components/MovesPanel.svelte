<script lang="ts">
	import type { Snippet } from 'svelte';
	import ExportIcon from 'phosphor-svelte/lib/ExportIcon';
	let {
		children,
		indicator,
		onexport,
		disabled = false
	}: {
		children: Snippet;
		indicator?: Snippet;
		onexport: () => void;
		disabled?: boolean;
	} = $props();
</script>

<section class="moves-panel" aria-label="Moves">
	<div class="moves-heading">
		{#if indicator}{@render indicator()}{/if}
		<button aria-label="Export game" title="Export game" onclick={onexport} {disabled}
			><ExportIcon size={20} /></button
		>
	</div>
	<div class="move-content">{@render children()}</div>
</section>

<style>
	.moves-panel {
		min-width: 0;
	}
	.moves-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
		margin-bottom: var(--space-3);
	}
	button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		cursor: pointer;
		border-radius: 8px;
	}
	button:hover,
	button:focus-visible {
		background: var(--surface-raised);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.move-content {
		max-height: 360px;
		overflow: auto;
		font-size: 13px;
	}
</style>
