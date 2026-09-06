<script lang="ts">
	import type { PieceMotion } from './motion';
	import type { ThreatInspection } from '$lib/chess/threats';
	import { onMount } from 'svelte';
	import Piece from './Piece.svelte';
	let {
		root,
		motion,
		inspection
	}: { root: HTMLElement; motion: PieceMotion | null; inspection: ThreatInspection | null } =
		$props();
	let boxes = $state<{ x: number; y: number; size: number }[]>([]),
		width = $state(0),
		height = $state(0);
	onMount(() => {
		function measure() {
			const r = root.getBoundingClientRect();
			width = r.width;
			height = r.height;
			boxes = Array.from({ length: 64 }, (_, i) => {
				const c = root.querySelector(`[data-square="${i}"]`)!.getBoundingClientRect();
				return {
					x: c.x - r.x + c.width / 2,
					y: c.y - r.y + c.height / 2,
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
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t - (motion.piece.t === 'n' ? Math.sin(Math.PI * t) * 24 : 0),
			size: a.size
		};
	});
</script>

{#if boxes.length}
	<svg class="overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
		<defs
			><marker
				id="flat-threat-arrow"
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerWidth="6"
				markerHeight="6"
				orient="auto"
				><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.5" /></marker
			></defs
		>
		{#if inspection}{#each inspection.attackers as from (from)}<line
					x1={boxes[from].x}
					y1={boxes[from].y}
					x2={boxes[inspection.target].x}
					y2={boxes[inspection.target].y}
					stroke={inspection.position[from]?.c === inspection.color
						? 'var(--threat-defend)'
						: 'var(--threat-attack)'}
					stroke-dasharray={inspection.position[from]?.c === inspection.color ? '6 4' : undefined}
					class="threat-arrow"
					stroke-width="3"
					marker-end="url(#flat-threat-arrow)"
				/>{/each}{/if}
		{#if motion && point}<g data-animation="piece"
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
		filter: drop-shadow(0 1px 0 var(--threat-outline)) drop-shadow(0 -1px 0 var(--threat-outline))
			drop-shadow(1px 0 0 var(--threat-outline)) drop-shadow(-1px 0 0 var(--threat-outline));
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
