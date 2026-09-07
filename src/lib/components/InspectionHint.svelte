<script lang="ts">
	let { description = '', visible = true }: { description?: string; visible?: boolean } = $props();
</script>

{#if visible}<p class="inspection-hint" aria-label="Threat controls">
		<span class="pointer-hint"
			>Right-click a square to inspect threats. Click a board square to clear.</span
		><span class="touch-hint"
			>Long-press a square to inspect threats. Tap a board square to clear.</span
		>
	</p>{/if}

{#if description}<span class="sr-only" role="status">{description}</span>{/if}

<style>
	.inspection-hint {
		margin-top: var(--space-3);
		font-size: 12px;
		line-height: 1.5;
		color: var(--hint-color, var(--muted));
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
