<script lang="ts">
	let { description = '' }: { description?: string } = $props();
</script>

<p class="inspection-hint" aria-label="Threat controls">
	<span class="pointer-hint">Right-click a square to inspect threats. Left-click to clear.</span
	><span class="touch-hint">Long-press a square to inspect threats. Tap to clear.</span>
</p>

{#if description}<span class="sr-only" role="status">{description}</span>{/if}

<style>
	.inspection-hint {
		margin-top: var(--space-3);
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}
	.touch-hint {
		display: none;
	}
	@media (pointer: coarse) {
		.pointer-hint {
			display: none;
		}
		.touch-hint {
			display: inline;
		}
	}
</style>
