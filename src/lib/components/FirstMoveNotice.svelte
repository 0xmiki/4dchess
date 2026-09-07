<script lang="ts">
	import { FIRST_MOVE_MS } from '$lib/online/first-move';
	let {
		deadline,
		now,
		own,
		synced
	}: { deadline?: number; now: number; own: boolean; synced: boolean } = $props();
	const visible = $derived(deadline !== undefined && synced && now >= deadline - FIRST_MOVE_MS);
	const seconds = $derived(Math.max(0, Math.ceil(((deadline ?? now) - now) / 1000)));
	const urgent = $derived(seconds <= 10);
	const announcement = $derived(
		!visible
			? ''
			: seconds === 0
				? 'First-move time has expired. Waiting for the game result.'
				: urgent
					? own
						? 'Make your first move. Ten seconds or less remain.'
						: 'Your opponent has ten seconds or less to make their first move.'
					: own
						? 'Make your first move before the countdown ends.'
						: 'Waiting for your opponent’s first move.'
	);
</script>

<div class="first-move-notice" class:urgent={visible && urgent}>
	{#if visible}<span aria-hidden="true"
			>{own ? (urgent ? 'Move now' : 'Make your first move') : 'Waiting for opponent'} ·
			<span class="countdown">0:{String(seconds).padStart(2, '0')}</span></span
		>{/if}
	<span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
</div>

<style>
	.first-move-notice {
		min-height: 20px;
		text-align: right;
		font-size: 12px;
		line-height: 20px;
		color: var(--muted);
	}
	.urgent {
		color: var(--game-secondary);
	}
	.countdown {
		font-variant-numeric: tabular-nums;
	}
</style>
