<script lang="ts">
	let {
		online,
		deadline,
		now,
		own = false
	}: { online: boolean; deadline: number | null; now: number; own?: boolean } = $props();
	const seconds = $derived(
		deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
	);
	const urgent = $derived(seconds !== null && seconds <= 10);
	const announcement = $derived(
		online
			? ''
			: urgent
				? own
					? 'Reconnect now. Ten seconds or less remain.'
					: 'Opponent disconnected. Ten seconds or less remain.'
				: own
					? 'Connection lost. Reconnecting.'
					: 'Opponent disconnected. Waiting for reconnection.'
	);
</script>

<div class="reconnect-notice" class:urgent>
	{#if !online}<span aria-hidden="true"
			>{own ? 'Reconnecting' : 'Opponent disconnected'}{#if seconds !== null}
				· {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}{/if}</span
		>{/if}
	<span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
</div>

<style>
	.reconnect-notice {
		min-height: 20px;
		line-height: 20px;
		font-size: 12px;
		color: var(--muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.urgent {
		color: var(--game-secondary);
	}
</style>
