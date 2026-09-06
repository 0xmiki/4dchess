<script lang="ts">
	import type { Piece } from '$lib/chess';
	let {
		piece,
		size = '76%',
		x,
		y,
		opacity = 1
	}: { piece: Piece; size?: number | string; x?: number; y?: number; opacity?: number } = $props();
</script>

<svg
	class="piece"
	class:white={piece.c === 'w'}
	class:black={piece.c === 'b'}
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
	.white {
		color: #fff9e8;
		--stroke: #405344;
		--detail: #405344;
	}
	.black {
		color: #284739;
		--stroke: #1c3228;
		--detail: #bed0b6;
	}
</style>
