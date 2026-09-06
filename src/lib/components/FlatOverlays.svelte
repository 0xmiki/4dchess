<script lang="ts">
	import { flatMotionPoint, type FlatPoint, type PieceMotion } from './motion';
	import type { ThreatInspection } from '$lib/chess/threats';
	import { onMount } from 'svelte';
	import Piece from './Piece.svelte';
	let {
		root,
		motion,
		inspections = []
	}: {
		root: HTMLElement;
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
	const point = $derived.by(() => {
		if (!motion || !boxes.length) return null;
		const a = boxes[motion.from],
			b = boxes[motion.to],
			t = motion.progress;
		return flatMotionPoint(a, b, motion, motion.piece, t, width, height);
	});
	const route = $derived(
		motion && boxes.length
			? Array.from({ length: 21 }, (_, i) => {
					const p = flatMotionPoint(
						boxes[motion.from],
						boxes[motion.to],
						motion,
						motion.piece,
						i / 20,
						width,
						height
					);
					return (i ? 'L' : 'M') + p.x + ',' + p.y;
				}).join(' ')
			: ''
	);
</script>

{#if boxes.length}
	<svg class="overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
		<defs
			><marker
				id="flat-threat-arrow"
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerWidth="3"
				markerHeight="3"
				orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke" /></marker
			></defs
		>
		{#if inspections.length}{#each inspections as marked (marked.target)}{#each marked.attackers as from (from)}<line
						x1={boxes[from].x}
						y1={boxes[from].y}
						x2={boxes[marked.target].x}
						y2={boxes[marked.target].y}
						stroke={marked.position[from]?.c === 'w'
							? 'var(--threat-white)'
							: 'var(--threat-black)'}
						class="threat-arrow"
						stroke-width="10"
						opacity=".48"
						marker-end="url(#flat-threat-arrow)"
					/>{/each}{/each}{/if}
		{#if motion && point}<path
				d={route}
				fill="none"
				stroke="var(--legal-ink)"
				stroke-width="1.5"
				opacity=".3"
			/><g data-animation="piece"
				><Piece
					onDark
					piece={motion.piece}
					x={point.x - point.size / 2}
					y={point.y - point.size / 2}
					size={point.size}
				/></g
			>{/if}
	</svg>
{/if}

<style>
	.threat-arrow {
		stroke-linecap: butt;
	}
	.overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		z-index: 3;
	}
</style>
