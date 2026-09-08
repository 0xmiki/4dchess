<script lang="ts">
	import { onMount } from 'svelte';
	import { drawFireworks, FIREWORKS_DURATION } from '$lib/visuals/fireworks';
	let {
		exclusion,
		ondone
	}: {
		exclusion: () => DOMRect | undefined;
		ondone: () => void;
	} = $props();
	let layer: HTMLDivElement, canvas: HTMLCanvasElement;
	onMount(() => {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		if (preference.matches || document.hidden) {
			ondone();
			return;
		}
		let frame = 0,
			stopped = false,
			width = 0,
			height = 0,
			lastDraw = -Infinity;
		const started = performance.now();
		function resize() {
			width = window.innerWidth;
			height = window.innerHeight;
			const ratio = Math.min(window.devicePixelRatio || 1, width < 768 ? 2 : 1.5);
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
		}
		function finish() {
			if (stopped) return;
			stopped = true;
			cancelAnimationFrame(frame);
			ondone();
		}
		function draw(now: number) {
			if (stopped) return;
			const elapsed = (now - started) / 1000;
			if (elapsed >= FIREWORKS_DURATION) {
				finish();
				return;
			}
			if (now - lastDraw >= 1000 / (width < 768 ? 30 : 60) - 0.5) {
				drawFireworks(canvas, elapsed, width, height, exclusion());
				lastDraw = now;
			}
			frame = requestAnimationFrame(draw);
		}
		const motionChanged = () => {
			if (preference.matches) finish();
		};
		const visibilityChanged = () => {
			if (document.hidden) finish();
		};
		resize();
		// A manual popover sits above the dialog backdrop without taking focus.
		layer.showPopover?.();
		frame = requestAnimationFrame(draw);
		window.addEventListener('resize', resize);
		preference.addEventListener('change', motionChanged);
		document.addEventListener('visibilitychange', visibilityChanged);
		return () => {
			stopped = true;
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', resize);
			preference.removeEventListener('change', motionChanged);
			document.removeEventListener('visibilitychange', visibilityChanged);
		};
	});
</script>

<div class="win-fireworks" popover="manual" bind:this={layer} aria-hidden="true">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.win-fireworks {
		position: fixed;
		inset: 0;
		margin: 0;
		padding: 0;
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		border: 0;
		background: transparent;
		overflow: hidden;
		pointer-events: none;
		z-index: 100;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.win-fireworks {
			display: none;
		}
	}
</style>
