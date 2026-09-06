<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Button from './Button.svelte';
	let {
		progress = $bindable(0),
		disabled = false,
		compact = false,
		label = 'Play move'
	}: { progress?: number; disabled?: boolean; compact?: boolean; label?: string } = $props();
	let ready = $state(false);
	let playing = $state(false),
		reduced = false,
		frame = 0;
	const id = $props.id();
	function stop() {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		playing = false;
	}
	onDestroy(stop);
	onMount(() => {
		ready = true;
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		reduced = query.matches;
		const changed = () => {
			reduced = query.matches;
			if (reduced && playing) {
				stop();
				progress = 1;
			}
		};
		const hidden = () => {
			if (document.hidden) stop();
		};
		query.addEventListener('change', changed);
		document.addEventListener('visibilitychange', hidden);
		return () => {
			query.removeEventListener('change', changed);
			document.removeEventListener('visibilitychange', hidden);
		};
	});
	$effect(() => {
		if (disabled) {
			stop();
			progress = 0;
		}
	});
	function play() {
		if (disabled) return;
		if (playing) {
			stop();
			return;
		}
		if (progress >= 1) progress = 0;
		if (reduced) {
			progress = 1;
			return;
		}
		playing = true;
		const initial = progress,
			start = performance.now();
		const tick = (now: number) => {
			progress = Math.min(1, initial + (now - start) / 1600);
			if (progress < 1) frame = requestAnimationFrame(tick);
			else playing = false;
		};
		frame = requestAnimationFrame(tick);
	}
</script>

<div class="playback" class:compact>
	<Button variant={compact ? 'default' : 'primary'} onclick={play} {disabled}
		><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
			>{#if playing}<path d="M4 3h3v10H4zM10 3h3v10h-3z" fill="currentColor" />{:else}<path
					d="M4 2l9 6-9 6z"
					fill="currentColor"
				/>{/if}</svg
		>{playing ? 'Pause move' : progress >= 1 ? 'Replay move' : label}</Button
	>
	{#if !compact}<label class="sr-only" for={id}>Move progress</label><input
			{id}
			type="range"
			min="0"
			max="100"
			step="1"
			value={progress * 100}
			disabled={disabled || !ready}
			aria-valuetext={progress === 0
				? 'Before the move'
				: progress === 1
					? 'After the move'
					: `${Math.round(progress * 100)} percent`}
			oninput={(event) => {
				stop();
				progress = Number(event.currentTarget.value) / 100;
			}}
		/><output for={id}
			>{progress === 0
				? 'Before'
				: progress === 1
					? 'After'
					: `${Math.round(progress * 100)}%`}</output
		>{/if}
</div>

<style>
	.playback {
		display: flex;
		align-items: center;
		gap: 20px;
	}
	.playback input {
		min-width: 60px;
		flex: 1;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.playback output {
		min-width: 50px;
		font-size: 12px;
		color: var(--muted);
	}
	.compact {
		justify-content: flex-start;
	}
	@media (max-width: 500px) {
		.playback {
			flex-wrap: wrap;
			gap: 12px;
		}
		.playback :global(button) {
			min-width: 150px;
		}
		.playback input {
			flex-basis: calc(100% - 70px);
			order: 2;
		}
		.playback output {
			order: 3;
		}
	}
</style>
