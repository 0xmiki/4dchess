<script lang="ts">
	import Spinner from './Spinner.svelte';
	let {
		text,
		turn,
		label,
		pending = false
	}: { text: string; turn: 'w' | 'b'; label?: string; pending?: boolean } = $props();
</script>

<p class="turn-indicator" role="status" aria-label={label ?? text}>
	{#if pending}<Spinner label="Confirming move" />{:else}<span
			class:black={turn === 'b'}
			aria-hidden="true"
		></span>{/if}{text}
</p>

<style>
	.turn-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--muted);
		line-height: 1.4;
	}
	.turn-indicator span {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		background: var(--piece-white);
		border-radius: 50%;
	}
	.turn-indicator span.black {
		background: var(--piece-black);
		box-shadow: inset 0 0 0 1px var(--line-strong);
	}
</style>
