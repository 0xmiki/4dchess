<script lang="ts">
	import {
		squareCoordinates,
		squareIndex,
		squareAddress,
		type Board,
		type Move,
		type Coordinates
	} from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	let {
		board,
		selected,
		moves,
		lastMove,
		onselect
	}: {
		board: Board;
		selected: number | null;
		moves: Move[];
		lastMove: Move | null;
		onselect: (square: number) => void;
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
		square: number | null;
	} | null = null;
	function project([x, y, z, w]: Coordinates) {
		const wScale = 2.05 / (2.7 - (w * 2 - 1));
		const px = (x / 1.5 - 1) * wScale,
			py = (y / 1.5 - 1) * wScale,
			pz = (z * 2 - 1) * wScale;
		const rx = px * Math.cos(yaw) + pz * Math.sin(yaw),
			rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
		const ry = py * Math.cos(pitch) - rz * Math.sin(pitch),
			depth = py * Math.sin(pitch) + rz * Math.cos(pitch);
		const scale = 5.5 / (5.5 - depth);
		return { x: 220 + rx * 86 * scale, y: 220 - ry * 86 * scale, depth, scale };
	}
	const points = $derived(Array.from({ length: 64 }, (_, i) => project(squareCoordinates(i))));
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
	}
	function drag(event: PointerEvent) {
		if (!gesture || gesture.id !== event.pointerId) return;
		if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.moved = true;
		if (gesture.moved) {
			yaw += (event.clientX - gesture.lastX) * 0.009;
			pitch = Math.max(-1.35, Math.min(1.35, pitch + (event.clientY - gesture.lastY) * 0.009));
		}
		gesture.lastX = event.clientX;
		gesture.lastY = event.clientY;
	}
	function up(event: PointerEvent) {
		if (!gesture || gesture.id !== event.pointerId) return;
		const previous = gesture;
		gesture = null;
		const svg = event.currentTarget as SVGSVGElement;
		if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
		if (!previous.moved && previous.square !== null) onselect(previous.square);
	}
	function key(event: KeyboardEvent) {
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
		<span>Tesseract projection</span><button onclick={reset}>Reset view</button>
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (This SVG is a keyboard-operable orbit control. Native board buttons provide keyboard access to every move.) -->
	<svg
		class="space-svg"
		viewBox="0 0 440 440"
		role="application"
		tabindex="0"
		aria-label="Rotatable tesseract. Drag or use arrow keys to rotate. Home resets the view."
		onpointerdown={down}
		onpointermove={drag}
		onpointerup={up}
		onpointercancel={() => {
			gesture = null;
		}}
		onlostpointercapture={() => {
			gesture = null;
		}}
		onkeydown={key}
	>
		<title>Four-dimensional chess position projected into 3D</title>
		{#each faces as face (face.w * 2 + face.z)}
			<polygon
				points={face.ids.map((i) => `${points[i].x},${points[i].y}`).join(' ')}
				fill="#e1e7dc"
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
					stroke="#a4b09c"
					stroke-width={n === 0 || n === 3 ? 1.3 : 0.7}
				/>
				<line
					x1={c.x}
					y1={c.y}
					x2={d.x}
					y2={d.y}
					stroke="#a4b09c"
					stroke-width={n === 0 || n === 3 ? 1.3 : 0.7}
				/>
			{/each}
		{/each}
		{#each [0, 3] as x (x)}{#each [0, 3] as y (y)}{#each [0, 1] as layer (layer)}
					{@const a = project([x, y, 0, layer])}{@const b = project([x, y, 1, layer])}
					{@const c = project([x, y, layer, 0])}{@const d = project([x, y, layer, 1])}
					<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#889c80" stroke-width="1.2" />
					<line
						x1={c.x}
						y1={c.y}
						x2={d.x}
						y2={d.y}
						stroke="#b27b4f"
						stroke-width="1.2"
						stroke-dasharray="4 4"
					/>
				{/each}{/each}{/each}
		{#if selected !== null}
			{#each moves as move (move.to)}<line
					x1={points[selected].x}
					y1={points[selected].y}
					x2={points[move.to].x}
					y2={points[move.to].y}
					stroke="#427444"
					stroke-width="1.3"
					stroke-dasharray="3 4"
					opacity=".65"
				/>{/each}
		{:else if lastMove}<line
				x1={points[lastMove.from].x}
				y1={points[lastMove.from].y}
				x2={points[lastMove.to].x}
				y2={points[lastMove.to].y}
				stroke="#ad7837"
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
				{#if selected === i}<circle
						cx={point.x}
						cy={point.y}
						r="15"
						fill="#f4dda8"
						stroke="#a57029"
					/>{/if}
				{#if legal}<circle
						cx={point.x}
						cy={point.y}
						r={p ? 14 : 5}
						fill={p ? 'none' : '#427444'}
						stroke={p ? '#ac4e2e' : '#315c46'}
						stroke-width="2"
					/>{/if}
				{#if p}<use
						class:white={p.c === 'w'}
						class:black={p.c === 'b'}
						href={`/pieces.svg#piece-${p.t}`}
						x={point.x - size / 2}
						y={point.y - size / 2}
						width={size}
						height={size}
						pointer-events="none"
					/>
				{:else if !legal}<circle
						cx={point.x}
						cy={point.y}
						r="2"
						fill="#86977c"
						pointer-events="none"
					/>{/if}
			</g>
		{/each}
	</svg>
	<p class="muted caption">W = 0 is the inner cube. W = 1 is the outer cube.</p>
</section>

<style>
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
	.space-svg:active {
		cursor: grabbing;
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
	.caption {
		font-size: 12px;
		text-align: center;
	}
</style>
