<script lang="ts">
	import { squareIndex, type Coordinates, type PieceType } from '$lib/chess';
	import Piece from './Piece.svelte';
	let {
		from,
		to,
		piece,
		progress,
		capture = false,
		invalid = false
	}: {
		from: Coordinates;
		to: Coordinates;
		piece: PieceType;
		progress: number;
		capture?: boolean;
		invalid?: boolean;
	} = $props();
	const point = ([x, y, z, w]: Coordinates) => ({
		x: 35 + z * 130 + x * 25 + 12.5,
		y: 27 + (1 - w) * 124 + (3 - y) * 25 + 12.5
	});
	const start = $derived(point(from)),
		end = $derived(point(to));
	const mover = $derived({
		x: start.x + (end.x - start.x) * (invalid ? 0 : progress),
		y: start.y + (end.y - start.y) * (invalid ? 0 : progress)
	});
</script>

<svg
	viewBox="0 0 280 270"
	role="img"
	aria-label="The same move on four flat boards, in White's orientation"
>
	{#each [1, 0] as w (w)}{#each [0, 1] as z (z)}{#each [0, 1, 2, 3] as y (y)}{#each [0, 1, 2, 3] as x (x)}
					{@const p = point([x, y, z, w])}{@const target =
						squareIndex([x, y, z, w]) === squareIndex(to)}
					<rect
						x={p.x - 12.5}
						y={p.y - 12.5}
						width="25"
						height="25"
						fill={target
							? 'var(--board-selected)'
							: (x + y) % 2
								? 'var(--board-light)'
								: 'var(--board-dark)'}
					/>
				{/each}{/each}{/each}{/each}
	{#each [1, 0] as w (w)}{#each [0, 1] as z (z)}{#each [0, 1, 2, 3] as n (n)}{@const p = point([
					n,
					0,
					z,
					w
				])}{@const rank = point([0, n, z, w])}<text x={p.x} y={p.y + 24}>{'abcd'[n]}</text><text
					x={rank.x - 20}
					y={rank.y + 3}>{n + 1}</text
				>{/each}{/each}{/each}
	<text x="85" y="16">Z = 0</text><text x="215" y="16">Z = 1</text><text
		x="13"
		y="80"
		transform="rotate(-90 13 80)"
		class="w-label">W = 1</text
	><text x="13" y="205" transform="rotate(-90 13 205)" class="w-label">W = 0</text>
	<line
		x1={start.x}
		y1={start.y}
		x2={end.x}
		y2={end.y}
		stroke={invalid ? 'var(--danger)' : 'var(--legal-ink)'}
		stroke-width="2"
		stroke-dasharray="4 4"
	/>
	{#if capture && progress < 1}<Piece
			piece={{ t: 'r', c: 'b' }}
			x={end.x - 11}
			y={end.y - 11}
			size={22}
		/>{/if}
	<Piece piece={{ t: piece, c: 'w' }} x={mover.x - 11} y={mover.y - 11} size={22} />
	{#if invalid}<path
			d={`M${end.x - 6},${end.y - 6}l12,12m0,-12l-12,12`}
			stroke="var(--danger-ink)"
			stroke-width="2"
		/>{/if}
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		max-width: 300px;
	}
	text {
		font: 10px var(--font-data);
		fill: var(--muted);
		text-anchor: middle;
	}
	.w-label {
		fill: var(--axis-w);
	}
</style>
