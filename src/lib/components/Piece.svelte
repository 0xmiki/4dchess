<script lang="ts">
	import type { Piece } from '$lib/chess';
	let {
		piece,
		size = '76%',
		x,
		y,
		opacity = 1,
		onDark = false
	}: {
		piece: Piece;
		size?: number | string;
		x?: number;
		y?: number;
		opacity?: number;
		onDark?: boolean;
	} = $props();
</script>

<svg
	class="piece"
	class:white={piece.c === 'w'}
	class:black={piece.c === 'b'}
	class:on-dark={onDark}
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
