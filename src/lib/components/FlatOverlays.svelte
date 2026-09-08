<script lang="ts">
	import { type FlatPoint, type PieceMotion } from './motion';
	import type { ThreatInspection } from '$lib/chess/threats';
	import { onMount } from 'svelte';
	import PieceFlight from './PieceFlight.svelte';
	import type { Board } from '$lib/chess';
	const id = $props.id();
	const arrowId = id + '-threat-arrow',
		maskId = id + '-pieces';
	let {
		root,
		board,
		motion,
		inspections = []
	}: {
		root: HTMLElement;
		board: Board;
		motion: PieceMotion | null;
		inspections?: ThreatInspection[];
	} = $props();
	let boxes = $state<FlatPoint[]>([]),
		width = $state(0),
		height = $state(0);
	onMount(() => {
		function measure() {
			const r = root.getBoundingClientRect();
			width = r.width;
			height = r.height;
			boxes = Array.from({ length: 64 }, (_, i) => {
				const cell = root.querySelector(`[data-square="${i}"]`)!;
				const c = cell.getBoundingClientRect(),
					plane = cell.closest('.board')!.getBoundingClientRect();
				return {
					x: c.x - r.x + c.width / 2,
					y: c.y - r.y + c.height / 2,
					cellWidth: c.width,
					plane: {
						left: plane.left - r.left,
						right: plane.right - r.left,
						top: plane.top - r.top,
						bottom: plane.bottom - r.top
					},
					size: Math.min(72, c.width * 0.76)
				};
			});
		}
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		return () => observer.disconnect();
	});
	function segment(from: number, to: number) {
		const a = boxes[from],
			b = boxes[to],
			dx = b.x - a.x,
			dy = b.y - a.y,
			length = Math.hypot(dx, dy) || 1;
		const start = Math.min(a.cellWidth * 0.34, 27, length * 0.25),
			end = Math.min(board[to] ? b.cellWidth * 0.34 : 7, board[to] ? 27 : 7, length * 0.25);
		return {
			x1: a.x + (dx * start) / length,
			y1: a.y + (dy * start) / length,
			x2: b.x - (dx * end) / length,
			y2: b.y - (dy * end) / length
		};
	}
</script>

{#if boxes.length}
	<svg class="overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
		<defs
			><marker
				id={arrowId}
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerUnits="userSpaceOnUse"
				markerWidth="8"
				markerHeight="8"
				orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke" /></marker
			><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" {width} {height}>
				<rect x="0" y="0" {width} {height} fill="white" />
				{#each board as piece, i (i)}{#if piece}<circle
							cx={boxes[i].x}
							cy={boxes[i].y}
							r={Math.min(24, boxes[i].cellWidth * 0.29)}
							fill="black"
						/>{/if}{/each}
			</mask></defs
		>
		{#if inspections.length}
			<g mask={`url(#${maskId})`}>
				{#each inspections as marked (marked.target)}{#each marked.attackers as from (from)}
						<line
							{...segment(from, marked.target)}
							class="threat-arrow"
							stroke={marked.position[from]?.c === marked.color
								? 'var(--threat-defend)'
								: 'var(--threat-attack)'}
							stroke-width={marked.target === inspections.at(-1)?.target ? 2.5 : 1.5}
							marker-end={`url(#${arrowId})`}
						/>
					{/each}{/each}
			</g>
		{/if}
		<PieceFlight
			{motion}
			points={boxes}
			unit={motion ? boxes[motion.from].cellWidth : boxes[0].cellWidth}
			size={motion ? boxes[motion.from].size : boxes[0].size}
		/>
	</svg>
{/if}

<style>
	.threat-arrow {
		vector-effect: non-scaling-stroke;
	}
	.threat-arrow {
		stroke-linecap: butt;
	}
	.overlay {
		--threat-attack: #681e32;
		--threat-defend: #12394d;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		z-index: 3;
	}
</style>
