<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { projectCoordinate, DEFAULT_CAMERA } from '$lib/visuals/projection';
	import {
		squareCoordinates,
		squareIndex,
		squareAddress,
		type Board,
		type Move,
		type Coordinates
	} from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	import Piece from './Piece.svelte';
	import AxisGizmo from './AxisGizmo.svelte';
	import { spatialMotionPoint, type PieceMotion } from './motion';
	import type { ThreatInspection } from '$lib/chess/threats';
	let {
		annotations = true,
		focusMove = null,
		onclear = () => {},
		yaw = $bindable(DEFAULT_CAMERA.yaw),
		pitch = $bindable(DEFAULT_CAMERA.pitch),
		board,
		selected,
		moves,
		lastMove,
		onselect,
		oninspect,
		motion,
		inspection,
		inspections = []
	}: {
		annotations?: boolean;
		focusMove?: (Move & { knight?: boolean }) | null;
		onclear?: () => void;
		yaw?: number;
		pitch?: number;
		board: Board;
		selected: number | null;
		moves: Move[];
		lastMove: Move | null;
		onselect: (square: number) => void;
		oninspect: (square: number) => void;
		motion: PieceMotion | null;
		inspection: ThreatInspection | null;
		inspections?: ThreatInspection[];
	} = $props();

	let gesture: {
		id: number;
		x: number;
		y: number;
		lastX: number;
		lastY: number;
		moved: boolean;
		inspected?: boolean;
		square: number | null;
	} | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(holdTimer));
	const componentId = $props.id();
	const arrowId = componentId + '-spatial-threat';
	const markerFade = () => ({
		duration:
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
				? 0
				: 180
	});
	function project(coordinate: Coordinates) {
		return projectCoordinate(coordinate, { yaw, pitch });
	}
	const points = $derived(Array.from({ length: 64 }, (_, i) => project(squareCoordinates(i))));
	function threatSegment(from: number, to: number) {
		const a = points[from],
			b = points[to],
			dx = b.x - a.x,
			dy = b.y - a.y;
		const length = Math.hypot(dx, dy) || 1,
			pad = Math.min(16, length * 0.25);
		return {
			x1: a.x + (dx * pad) / length,
			y1: a.y + (dy * pad) / length,
			x2: b.x - (dx * pad) / length,
			y2: b.y - (dy * pad) / length
		};
	}
	const orientation = $derived.by(() => {
		const origin = project([1.5, 1.5, 0.5, 1]);
		const tips: Coordinates[] = [
			[2.15, 1.5, 0.5, 1],
			[1.5, 2.15, 0.5, 1],
			[1.5, 1.5, 0.825, 1]
		];
		return tips.map((coordinate, i) => {
			const tip = project(coordinate);
			return { label: 'XYZ'[i], dx: (tip.x - origin.x) * 0.6, dy: (tip.y - origin.y) * 0.6 };
		});
	});
	const mover = $derived(
		motion ? spatialMotionPoint(project, motion, motion.piece, motion.progress) : null
	);
	const motionRoute = $derived(
		motion
			? Array.from({ length: 25 }, (_, i) => {
					const p = spatialMotionPoint(project, motion, motion.piece, i / 24);
					return (i ? 'L' : 'M') + p.x + ',' + p.y;
				}).join(' ')
			: ''
	);
	const faces = $derived(
		[0, 1]
			.flatMap((w) =>
				[0, 1].map((z) => ({
					w,
					z,
					ids: [
						squareIndex([0, 0, z, w]),
						squareIndex([3, 0, z, w]),
						squareIndex([3, 3, z, w]),
						squareIndex([0, 3, z, w])
					]
				}))
			)
			.sort(
				(a, b) =>
					a.ids.reduce((sum, i) => sum + points[i].depth, 0) -
					b.ids.reduce((sum, i) => sum + points[i].depth, 0)
			)
	);
	const nodes = $derived(
		Array.from({ length: 64 }, (_, i) => i).sort((a, b) => {
			const layer = (i: number) => (moves.some((m) => m.to === i) ? 2 : selected === i ? 1 : 0);
			return layer(a) - layer(b) || points[a].depth - points[b].depth;
		})
	);
	function reset() {
		yaw = DEFAULT_CAMERA.yaw;
		pitch = DEFAULT_CAMERA.pitch;
	}
	function down(event: PointerEvent) {
		if (event.button !== 0 || gesture) return;
		const target = (event.target as Element).closest('[data-node]');
		gesture = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			lastX: event.clientX,
			lastY: event.clientY,
			moved: false,
			square: target ? Number(target.getAttribute('data-node')) : null
		};
		(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
		if (event.pointerType !== 'mouse' && gesture.square !== null) {
			holdTimer = setTimeout(() => {
				if (gesture?.square !== null && gesture) {
					gesture.inspected = true;
					oninspect(gesture.square);
				}
			}, 500);
		}
	}
	function drag(event: PointerEvent) {
		if (!gesture || gesture.id !== event.pointerId) return;
		if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.moved = true;
		if (gesture.moved) clearTimeout(holdTimer);
		if (gesture.moved && !gesture.inspected) {
			yaw += (event.clientX - gesture.lastX) * 0.009;
			pitch = Math.max(-1.35, Math.min(1.35, pitch + (event.clientY - gesture.lastY) * 0.009));
		}
		gesture.lastX = event.clientX;
		gesture.lastY = event.clientY;
	}
	function up(event: PointerEvent) {
		clearTimeout(holdTimer);
		if (!gesture || gesture.id !== event.pointerId) return;
		const previous = gesture;
		gesture = null;
		const svg = event.currentTarget as SVGSVGElement;
		if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
		if (!previous.moved && !previous.inspected && previous.square !== null)
			onselect(previous.square);
	}
	function key(event: KeyboardEvent) {
		if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
			event.preventDefault();
			if (selected !== null) oninspect(selected);
			return;
		}
		if (event.key === 'Home') {
			event.preventDefault();
			reset();
		}
		if (!event.key.startsWith('Arrow')) return;
		event.preventDefault();
		if (event.key === 'ArrowLeft') yaw -= 0.12;
		if (event.key === 'ArrowRight') yaw += 0.12;
		if (event.key === 'ArrowUp') pitch = Math.max(-1.35, pitch - 0.12);
		if (event.key === 'ArrowDown') pitch = Math.min(1.35, pitch + 0.12);
	}
</script>

<section class="spatial" aria-label="Tesseract projection">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (This SVG is a keyboard-operable orbit control. Native board buttons provide keyboard access to every move.) -->
	<svg
		class="space-svg"
		viewBox="0 0 440 440"
		role="application"
		tabindex="0"
		aria-label="Rotatable tesseract. Drag or use arrow keys to rotate. Home resets the view."
		onpointerdown={(event) => {
			if (event.button === 0) onclear();
			down(event);
		}}
		oncontextmenu={(event) => {
			event.preventDefault();
			clearTimeout(holdTimer);
			if (gesture?.inspected) return;
			if (gesture) gesture.inspected = true;
			const node = (event.target as Element).closest('[data-node]');
			if (node) oninspect(Number(node.getAttribute('data-node')));
		}}
		onpointermove={drag}
		onpointerup={up}
		onpointercancel={() => {
			clearTimeout(holdTimer);
			gesture = null;
		}}
		onlostpointercapture={() => {
			clearTimeout(holdTimer);
			gesture = null;
		}}
		onkeydown={key}
	>
		<title>Four-dimensional chess position projected into 3D</title>
		<defs
			><marker
				id={arrowId}
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerWidth="6"
				markerHeight="6"
				orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke" /></marker
			></defs
		>
		{#each faces as face (face.w * 2 + face.z)}
			<polygon
				points={face.ids.map((i) => `${points[i].x},${points[i].y}`).join(' ')}
				fill="var(--plane)"
				fill-opacity=".025"
			/>
			{#each [0, 1, 2, 3] as n (n)}
				{@const a = project([n, 0, face.z, face.w])}{@const b = project([n, 3, face.z, face.w])}
				{@const c = project([0, n, face.z, face.w])}{@const d = project([3, n, face.z, face.w])}
				<line
					x1={a.x}
					y1={a.y}
					x2={b.x}
					y2={b.y}
					stroke="var(--grid)"
					stroke-width="1"
					stroke-opacity={n === 0 || n === 3 ? 0.7 : 0.4}
				/>
				<line
					x1={c.x}
					y1={c.y}
					x2={d.x}
					y2={d.y}
					stroke="var(--grid)"
					stroke-width="1"
					stroke-opacity={n === 0 || n === 3 ? 0.7 : 0.4}
				/>
			{/each}
		{/each}
		{#each [0, 3] as x (x)}{#each [0, 3] as y (y)}{#each [0, 1] as layer (layer)}
					{@const a = project([x, y, 0, layer])}{@const b = project([x, y, 1, layer])}
					{@const c = project([x, y, layer, 0])}{@const d = project([x, y, layer, 1])}
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke="var(--grid)"
						stroke-width="1"
						stroke-opacity=".7"
					/>
					<line
						x1={c.x}
						y1={c.y}
						x2={d.x}
						y2={d.y}
						stroke="var(--axis-w)"
						stroke-width="1"
						stroke-dasharray="4 4"
						stroke-opacity=".5"
					/>
				{/each}{/each}{/each}
		{#if inspections.length}{#each inspections as marked (marked.target)}{#each marked.attackers as from (from)}{@const segment =
						threatSegment(from, marked.target)}<line
						{...segment}
						stroke={marked.position[from]?.c === 'w'
							? 'var(--threat-white)'
							: 'var(--threat-black)'}
						class="threat-arrow"
						stroke-width="1"
						opacity={marked.target === inspection?.target ? 0.85 : 0.5}
						marker-end={`url(#${arrowId})`}
					/>{/each}{/each}
		{:else if lastMove && !motion && selected === null}<line
				x1={points[lastMove.from].x}
				y1={points[lastMove.from].y}
				x2={points[lastMove.to].x}
				y2={points[lastMove.to].y}
				stroke="var(--game-secondary)"
				opacity=".55"
				stroke-width="1"
			/>{/if}
		{#if focusMove}{@const a = points[focusMove.from]}{@const b = points[focusMove.to]}<path
				in:fade={markerFade()}
				class="demo-path"
				d={focusMove.knight
					? `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 45} ${b.x} ${b.y}`
					: `M${a.x} ${a.y} L${b.x} ${b.y}`}
				fill="none"
				stroke="var(--demo-mark)"
				opacity=".48"
				stroke-width="1"
			/>{/if}
		{#if motion && !focusMove}<path
				d={motionRoute}
				fill="none"
				stroke="var(--grid)"
				stroke-width="1"
				opacity=".3"
				pointer-events="none"
			/>{/if}
		{#each nodes as i (i)}
			{@const p = board[i]}{@const point = points[i]}{@const legal =
				inspections.length === 0 && moves.some((m) => m.to === i)}{@const size =
				26 * Math.min(1.15, point.scale)}
			<g data-node={i}>
				<title
					>{squareAddress(i)}, {p
						? `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]}`
						: 'empty'}</title
				>
				<circle cx={point.x} cy={point.y} r="12" fill="transparent" />
				{#if inspections.some((marked) => marked.target === i)}<rect
						data-state="inspection-target"
						in:fade={markerFade()}
						x={point.x - 16}
						y={point.y - 16}
						width="32"
						height="32"
						rx="5"
						fill="var(--board-target)"
						fill-opacity=".08"
						stroke="var(--spatial-selection-outline)"
						stroke-width="1"
						stroke-opacity=".8"
					/>{:else if inspections.some((marked) => marked.attackers.includes(i))}<circle
						data-state="threat-source"
						cx={point.x}
						cy={point.y}
						r="15"
						fill={p?.c === 'w' ? 'var(--threat-white)' : 'var(--threat-black)'}
						fill-opacity=".08"
						stroke={p?.c === 'w' ? 'var(--threat-white)' : 'var(--threat-black)'}
						stroke-width="1"
						stroke-opacity=".7"
					/>{/if}
				{#if selected === i && inspections.length === 0}<circle
						data-state="selected"
						in:fade={markerFade()}
						cx={point.x}
						cy={point.y}
						r="15"
						fill="var(--spatial-selection-outline)"
						fill-opacity=".1"
						stroke="var(--spatial-selection-outline)"
						stroke-opacity=".85"
						stroke-width="1"
					/>{/if}
				{#if legal}<circle
						data-state="legal-destination"
						in:fade={markerFade()}
						cx={point.x}
						cy={point.y}
						r={p ? 14 : 4}
						fill={p ? 'none' : 'var(--spatial-destination)'}
						opacity=".8"
						stroke={p ? 'var(--spatial-destination)' : 'none'}
						stroke-width="1"
					/>{/if}
				{#if selected === null && !inspections.length && lastMove && !motion && (i === lastMove.from || i === lastMove.to)}<circle
						data-state="last-move"
						cx={point.x}
						cy={point.y}
						r={i === lastMove.to ? 14 : 4}
						fill="none"
						stroke="var(--game-secondary)"
						stroke-opacity=".55"
						stroke-width="1"
					/>{/if}
				{#if focusMove && (i === focusMove.from || i === focusMove.to)}<circle
						in:fade={markerFade()}
						class="demo-endpoint"
						opacity=".3"
						cx={point.x}
						cy={point.y}
						r="15"
						fill="var(--demo-mark-fill)"
						stroke="var(--demo-mark)"
						stroke-width="1"
					/>{/if}
				{#if p}<Piece
						onDark
						piece={p}
						x={point.x - size / 2}
						y={point.y - size / 2}
						{size}
						opacity={motion?.to === i
							? 1 - Math.max(0, (motion.progress - 0.8) / 0.2)
							: inspection?.preview && inspection.target === i
								? 0.65
								: 1}
					/>
				{:else if !legal}<circle
						cx={point.x}
						cy={point.y}
						r="2"
						fill="var(--grid)"
						pointer-events="none"
					/>{/if}
			</g>
		{/each}
		{#if motion && mover}{@const size = 26 * Math.min(1.15, mover.scale)}<g
				data-animation="spatial-piece"
				><Piece
					onDark
					piece={motion.piece}
					x={mover.x - size / 2}
					y={mover.y - size / 2}
					{size}
				/></g
			>{/if}
		{#if annotations}<g class="axis-gizmo"><AxisGizmo axes={orientation} x={380} y={395} /></g>{/if}
	</svg>
	{#if annotations}<p class="muted caption">
			W = 0 is the inner cube. W = 1 is the outer cube.
		</p>{/if}
</section>

<style>
	.space-svg > line,
	.space-svg > path,
	.space-svg [data-node] > circle,
	.space-svg [data-node] > rect {
		vector-effect: non-scaling-stroke;
	}
	.space-svg > line,
	.space-svg > path {
		pointer-events: none;
	}

	.threat-arrow {
		stroke-linecap: butt;
	}
	.spatial {
		position: relative;
		--axis-w: #aaa;
		--grid: #828282;
		--grid-soft: #606060;
		--plane: #777;
		--piece-white: #eee;
		--piece-white-outline: #333;
		--piece-black: #292929;
		--piece-black-outline: #151515;
		--piece-black-detail: #ccc;

		min-width: 0;
	}
	.space-svg {
		overflow: visible;
		display: block;
		width: 100%;
		touch-action: none;
		user-select: none;
		cursor: grab;
	}
	.space-svg:focus {
		outline: none;
		box-shadow: none;
	}
	.space-svg:focus-visible {
		background: var(--surface);
		border-radius: var(--radius-panel);
	}
	.space-svg:active {
		cursor: grabbing;
	}
	.axis-gizmo {
		opacity: 0.45;
	}
	.caption {
		opacity: 0.5;
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		font-size: 12px;
		text-align: center;
	}
</style>
