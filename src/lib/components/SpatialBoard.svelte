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
					stroke-width={n === 0 || n === 3 ? 1.3 : 0.7}
				/>
				<line
					x1={c.x}
					y1={c.y}
					x2={d.x}
					y2={d.y}
					stroke="var(--grid)"
					stroke-width={n === 0 || n === 3 ? 1.3 : 0.7}
				/>
			{/each}
		{/each}
		{#each [0, 3] as x (x)}{#each [0, 3] as y (y)}{#each [0, 1] as layer (layer)}
					{@const a = project([x, y, 0, layer])}{@const b = project([x, y, 1, layer])}
					{@const c = project([x, y, layer, 0])}{@const d = project([x, y, layer, 1])}
					<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--grid)" stroke-width="1.2" />
					<line
						x1={c.x}
						y1={c.y}
						x2={d.x}
						y2={d.y}
						stroke="var(--axis-w)"
						stroke-width="1.2"
						stroke-dasharray="4 4"
					/>
				{/each}{/each}{/each}
		{#if inspections.length}{#each inspections as marked (marked.target)}{#each marked.attackers as from (from)}<line
						x1={points[from].x}
						y1={points[from].y}
						x2={points[marked.target].x}
						y2={points[marked.target].y}
						stroke={marked.position[from]?.c === 'w'
							? 'var(--threat-white)'
							: 'var(--threat-black)'}
						class="threat-arrow"
						stroke-width="1.6"
						opacity=".48"
						marker-end={`url(#${arrowId})`}
					/>{/each}{/each}
		{:else if selected !== null}
			{#each moves as move (move.to)}<line
					x1={points[selected].x}
					y1={points[selected].y}
					x2={points[move.to].x}
					y2={points[move.to].y}
					stroke="var(--legal)"
					stroke-width="1.3"
					opacity=".16"
				/>{/each}
		{:else if lastMove && !motion}<line
				x1={points[lastMove.from].x}
				y1={points[lastMove.from].y}
				x2={points[lastMove.to].x}
				y2={points[lastMove.to].y}
				stroke="var(--accent)"
				stroke-width="2"
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
				stroke-width="2"
			/>{/if}
		{#if motion && !focusMove}<path
				d={motionRoute}
				fill="none"
				stroke="var(--grid)"
				stroke-width="1.3"
				opacity=".3"
				pointer-events="none"
			/>{/if}
		{#each nodes as i (i)}
			{@const p = board[i]}{@const point = points[i]}{@const legal = moves.some(
				(m) => m.to === i
			)}{@const size = 26 * Math.min(1.15, point.scale)}
			<g data-node={i}>
				<title
					>{squareAddress(i)}, {p
						? `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]}`
						: 'empty'}</title
				>
				<circle cx={point.x} cy={point.y} r="12" fill="transparent" />
				{#if inspection?.target === i}<rect
						in:fade={markerFade()}
						x={point.x - 16}
						y={point.y - 16}
						width="32"
						height="32"
						rx="5"
						fill="var(--board-target)"
						fill-opacity=".18"
						stroke="none"
					/>{:else if inspection?.attackers.includes(i)}<circle
						cx={point.x}
						cy={point.y}
						r="15"
						fill={p?.c === inspection.color ? 'var(--board-target)' : 'var(--board-threat)'}
						fill-opacity=".28"
					/>{/if}
				{#if selected === i}<circle
						in:fade={markerFade()}
						cx={point.x}
						cy={point.y}
						r="15"
						fill="var(--board-selected)"
						fill-opacity=".2"
						stroke="none"
					/>{/if}
				{#if legal}<circle
						in:fade={markerFade()}
						cx={point.x}
						cy={point.y}
						r={p ? 14 : 5}
						fill={p ? 'none' : 'var(--legal)'}
						opacity=".42"
						stroke={p ? 'var(--legal)' : 'none'}
						stroke-width="2"
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
						stroke-width="2"
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
		{#if annotations}<AxisGizmo axes={orientation} x={39} y={395} />{/if}
	</svg>
	{#if annotations}<p class="muted caption">
			W = 0 is the inner cube. W = 1 is the outer cube.
		</p>{/if}
</section>

<style>
	.threat-arrow {
		stroke-linecap: butt;
	}
	.spatial {
		--axis-w: #aaa;
		--grid: #828282;
		--grid-soft: #606060;
		--plane: #777;
		--legal: #aaa;
		--defender: #aaa;
		--accent: #aaa;
		--board-selected: #aaa;
		--board-target: #aaa;
		--board-threat: #888;
		--demo-mark: #aaa;
		--demo-mark-fill: #777;
		--threat-white: #b5b5b5;
		--threat-black: #909090;
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
	.caption {
		font-size: 12px;
		text-align: center;
	}
</style>
