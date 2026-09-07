<script lang="ts">
	let {
		remaining,
		running,
		side
	}: { remaining: number; running: boolean; side: 'white' | 'black' } = $props();
	const text = $derived.by(() => {
		const seconds = Math.max(0, remaining) / 1000;
		if (seconds < 10) return seconds.toFixed(1);
		const rounded = Math.ceil(seconds);
		return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
	});
</script>

<div
	class="clock"
	class:white={side === 'white'}
	class:running
	class:low={remaining < 20000}
	role="timer"
	aria-label={`${side === 'white' ? 'White' : 'Black'} clock`}
	aria-live="off"
>
	{text}
</div>

<style>
	.clock {
		margin-left: auto;
		min-width: 96px;
		padding: 6px 12px;
		border-radius: var(--radius-control);
		background: #303030;
		color: #d1d1d1;
		opacity: 0.7;
		font-size: 24px;
		font-weight: 600;
		line-height: 1.3;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.white {
		background: var(--piece-white);
		color: #333;
	}
	.running {
		opacity: 1;
	}
	.low {
		color: var(--game-secondary);
	}
	.white.low {
		color: #794a2e;
	}
</style>
