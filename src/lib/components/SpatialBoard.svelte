<script lang="ts">
	import { onDestroy } from 'svelte';
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
	import Button from './Button.svelte';
	import AxisGizmo from './AxisGizmo.svelte';
	import type { PieceMotion } from './motion';
	import type { ThreatInspection } from '$lib/chess/threats';
	let {
		board,
		selected,
		moves,
		lastMove,
		onselect,
		oninspect,
		motion,
		inspection
	}: {
		board: Board;
		selected: number | null;
		moves: Move[];
		lastMove: Move | null;
		onselect: (square: number) => void;
		oninspect: (square: number) => void;
		motion: PieceMotion | null;
		inspection: ThreatInspection | null;
	} = $props();
	let yaw = $state(-0.48),
		pitch = $state(0.26);
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
	function rawProject([x, y, z, w]: Coordinates) {
		const wScale = 2.05 / (2.7 - (w * 2 - 1));
		const px = (x / 1.5 - 1) * wScale,
			py = (y / 1.5 - 1) * wScale,
			pz = (z * 2 - 1) * wScale;
		const rx = px * Math.cos(yaw) + pz * Math.sin(yaw),
			rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
		const ry = py * Math.cos(pitch) - rz * Math.sin(pitch),
			depth = py * Math.sin(pitch) + rz * Math.cos(pitch);
		const scale = 5.5 / (5.5 - depth);
		return { x: 220 + rx * 101 * scale, y: 220 - ry * 101 * scale, depth, scale };
	}
	const cameraFit = $derived.by(() => {
		let extent = 0;
		for (const x of [0, 3])
			for (const y of [0, 3])
				for (const z of [0, 1]) {
					const point = rawProject([x, y, z, 1]);
					extent = Math.max(extent, Math.abs(point.x - 220), Math.abs(point.y - 220));
				}
		return Math.min(1, 198 / extent);
	});
	function project(coordinate: Coordinates) {
		const point = rawProject(coordinate);
		return { ...point, x: 220 + (point.x - 220) * cameraFit, y: 220 + (point.y - 220) * cameraFit };
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
	const mover = $derived.by(() => {
		if (!motion) return null;
		const a = squareCoordinates(motion.from),
			b = squareCoordinates(motion.to),
			t = motion.progress;
		const p = project([
			a[0] + (b[0] - a[0]) * t,
			a[1] + (b[1] - a[1]) * t,
			a[2] + (b[2] - a[2]) * t,
			a[3] + (b[3] - a[3]) * t
		]);
		if (motion.piece.t === 'n') p.y -= Math.sin(Math.PI * t) * 21;
		return p;
	});
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
		yaw = -0.48;
		pitch = 0.26;
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
	<div class="row spatial-toolbar">
		<span>Tesseract projection</span><Button onclick={reset}>Reset view</Button>
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (This SVG is a keyboard-operable orbit control. Native board buttons provide keyboard access to every move.) -->
	<svg
		class="space-svg"
		viewBox="0 0 440 440"
		role="application"
		tabindex="0"
		aria-label="Rotatable tesseract. Drag or use arrow keys to rotate. Home resets the view."
		onpointerdown={down}
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
				orient="auto"
				><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.5" /></marker
			></defs
		>
		{#each faces as face (face.w * 2 + face.z)}
			<polygon
				points={face.ids.map((i) => `${points[i].x},${points[i].y}`).join(' ')}
				fill="var(--plane)"
				fill-opacity=".12"
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
		{#if inspection}{#each inspection.attackers as from (from)}<line
					x1={points[from].x}
					y1={points[from].y}
					x2={points[inspection.target].x}
					y2={points[inspection.target].y}
					stroke={inspection.position[from]?.c === inspection.color
						? 'var(--threat-defend)'
						: 'var(--threat-attack)'}
					stroke-dasharray={inspection.position[from]?.c === inspection.color ? '6 4' : undefined}
					class="threat-arrow"
					stroke-width="3"
					marker-end={`url(#${arrowId})`}
				/>{/each}
		{:else if selected !== null}
			{#each moves as move (move.to)}<line
					x1={points[selected].x}
					y1={points[selected].y}
					x2={points[move.to].x}
					y2={points[move.to].y}
					stroke="var(--legal)"
					stroke-width="1.3"
					stroke-dasharray="3 4"
					opacity=".65"
				/>{/each}
		{:else if lastMove && !motion}<line
				x1={points[lastMove.from].x}
				y1={points[lastMove.from].y}
				x2={points[lastMove.to].x}
				y2={points[lastMove.to].y}
				stroke="var(--accent)"
				stroke-width="2"
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
						x={point.x - 16}
						y={point.y - 16}
						width="32"
						height="32"
						rx="5"
						fill="var(--board-target)"
						stroke="var(--defender)"
					/>{:else if inspection?.attackers.includes(i)}<circle
						cx={point.x}
						cy={point.y}
						r="15"
						fill={p?.c === inspection.color ? 'var(--board-target)' : 'var(--board-threat)'}
					/>{/if}
				{#if selected === i}<circle
						cx={point.x}
						cy={point.y}
						r="15"
						fill="var(--board-selected)"
						stroke="var(--accent)"
					/>{/if}
				{#if legal}<circle
						cx={point.x}
						cy={point.y}
						r={p ? 14 : 5}
						fill={p ? 'none' : 'var(--legal)'}
						stroke={p ? 'var(--danger)' : 'var(--legal)'}
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
		<AxisGizmo axes={orientation} x={39} y={395} />
	</svg>
	<p class="muted caption">W = 0 is the inner cube. W = 1 is the outer cube.</p>
</section>

<style>
	.threat-arrow {
		filter: drop-shadow(0 1px 0 var(--threat-outline)) drop-shadow(0 -1px 0 var(--threat-outline))
			drop-shadow(1px 0 0 var(--threat-outline)) drop-shadow(-1px 0 0 var(--threat-outline));
	}
	.spatial {
		min-width: 0;
	}
	.spatial-toolbar {
		justify-content: space-between;
		font-size: 13px;
	}
	.space-svg {
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
