<script lang="ts">
	import type { Piece } from '$lib/chess';
	import { motionAllowed } from '$lib/motion-preferences';
	let {
		piece,
		size = '76%',
		x,
		y,
		opacity = 1,
		onDark = false,
		selected = false,
		landed = false,
		pressed = false,
		captureProgress = 0
	}: {
		piece: Piece;
		size?: number | string;
		x?: number;
		y?: number;
		opacity?: number;
		onDark?: boolean;
		selected?: boolean;
		landed?: boolean;
		pressed?: boolean;
		captureProgress?: number;
	} = $props();
</script>

<svg
	class="piece"
	class:white={piece.c === 'w'}
	class:black={piece.c === 'b'}
	class:on-dark={onDark}
	class:selected
	class:landed
	class:pressed
	class:motion-off={!$motionAllowed}
	style:transform={$motionAllowed && captureProgress > 0
		? `scale(${Math.max(0, 1 - captureProgress)})`
		: undefined}
	style:transition={captureProgress > 0 ? 'none' : undefined}
	{x}
	{y}
	width={size}
	height={size}
	{opacity}
	viewBox="0 0 64 64"
	aria-hidden="true"><use href={`/pieces.svg#piece-${piece.t}`} /></svg
>

<style>
	.piece {
		max-width: 72px;
		overflow: visible;
		pointer-events: none;
	}
	.piece {
		transform-box: fill-box;
		transform-origin: center;
		transition:
			transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1),
			filter 140ms;
	}
	.selected {
		transform: translateY(-6px) scale(1.05);
		filter: drop-shadow(0 5px 2px #0003);
	}
	.pressed {
		transform: scale(0.93);
		transition-duration: 55ms;
	}
	.landed {
		animation: settle 300ms ease-out;
	}
	@keyframes settle {
		0% {
			transform: scale(0.94, 1.05);
		}
		40% {
			transform: scale(1.05, 0.96);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.piece {
			animation: none;
			transition: none;
			transform: none;
		}
	}
	.motion-off {
		transform: none !important;
		transition: none;
		animation: none;
		filter: none;
	}
	.white {
		color: var(--piece-white);
		--stroke: var(--piece-white-outline);
		--detail: var(--piece-white-outline);
	}
	.black {
		color: var(--piece-black);
		--stroke: var(--piece-black-outline);
		--detail: var(--piece-black-detail);
	}
	.black.on-dark {
		--stroke: var(--piece-black-detail);
	}
</style>
