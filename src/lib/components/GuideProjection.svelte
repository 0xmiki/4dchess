<script lang="ts">
	import type { Coordinates, PieceType } from '$lib/chess';
	import Piece from './Piece.svelte';
	import AxisGizmo from './AxisGizmo.svelte';
	let {
		four = true,
		from,
		to,
		piece = 'r',
		capture = false,
		invalid = false,
		progress = 0,
		yaw = $bindable(-0.48),
		pitch = $bindable(0.26),
		label = '4D move example'
	}: {
		four?: boolean;
		from: Coordinates;
		to: Coordinates;
		piece?: PieceType;
		capture?: boolean;
		invalid?: boolean;
		progress?: number;
		yaw?: number;
		pitch?: number;
		label?: string;
	} = $props();
	const axes = [0, 1, 2, 3];
	function project([x, y, z, w]: Coordinates) {
		const scale = four ? 2.05 / (2.7 - (w * 2 - 1)) : 1.1;
		const px = (x / 1.5 - 1) * scale,
			py = (y / 1.5 - 1) * scale,
			pz = (z * 2 - 1) * scale;
		const rx = px * Math.cos(yaw) + pz * Math.sin(yaw),
			rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
		const ry = py * Math.cos(pitch) - rz * Math.sin(pitch),
			depth = py * Math.sin(pitch) + rz * Math.cos(pitch),
			perspective = 5.5 / (5.5 - depth);
		return { x: 180 + rx * 65 * perspective, y: 150 - ry * 65 * perspective, depth };
	}
	const layers = $derived(
		(four ? [0, 1] : [0])
			.flatMap((w) =>
				[0, 1].map((z) => ({
					w,
					z,
					key: `${z}:${w}`,
					corners: [
						[0, 0, z, w],
						[3, 0, z, w],
						[3, 3, z, w],
						[0, 3, z, w]
					] as Coordinates[]
				}))
			)
			.sort(
				(a, b) =>
					a.corners.reduce((sum, c) => sum + project(c).depth, 0) -
					b.corners.reduce((sum, c) => sum + project(c).depth, 0)
			)
	);
	const start = $derived(project(from)),
		end = $derived(project(to));
	const orientation = $derived.by(() => {
		const w = four ? 1 : 0,
			origin = project([1.5, 1.5, 0.5, w]);
		const tips: Coordinates[] = [
			[2.15, 1.5, 0.5, w],
			[1.5, 2.15, 0.5, w],
			[1.5, 1.5, 0.825, w]
		];
		return tips.map((coordinate, i) => {
			const tip = project(coordinate);
			return { label: 'XYZ'[i], dx: (tip.x - origin.x) * 0.8, dy: (tip.y - origin.y) * 0.8 };
		});
	});
	const mover = $derived.by(() => {
		const t = invalid ? 0 : progress;
		const c: Coordinates = [
			from[0] + (to[0] - from[0]) * t,
			from[1] + (to[1] - from[1]) * t,
			from[2] + (to[2] - from[2]) * t,
			from[3] + (to[3] - from[3]) * t
		];
		const p = project(c);
		if (piece === 'n') p.y -= Math.sin(Math.PI * t) * 20;
		return p;
	});
	let gesture: { id: number; x: number; y: number } | null = null;
	function down(event: PointerEvent) {
		if (event.button !== 0 || gesture) return;
		gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
		(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
	}
	function drag(event: PointerEvent) {
		if (!gesture || gesture.id !== event.pointerId) return;
		yaw += (event.clientX - gesture.x) * 0.009;
		pitch = Math.max(-1.2, Math.min(1.2, pitch + (event.clientY - gesture.y) * 0.009));
		gesture.x = event.clientX;
		gesture.y = event.clientY;
	}
	function up(event: PointerEvent) {
		if (gesture?.id !== event.pointerId) return;
		gesture = null;
		const svg = event.currentTarget as SVGSVGElement;
		if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
	}
	function key(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
		event.preventDefault();
		if (event.key === 'Home') {
			yaw = -0.48;
			pitch = 0.26;
		}
		if (event.key === 'ArrowLeft') yaw -= 0.12;
		if (event.key === 'ArrowRight') yaw += 0.12;
		if (event.key === 'ArrowUp') pitch = Math.max(-1.2, pitch - 0.12);
		if (event.key === 'ArrowDown') pitch = Math.min(1.2, pitch + 0.12);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Keyboard arrows rotate this diagram; Home resets its view.) -->
<svg
	class="projection"
	viewBox="0 0 360 300"
	role="application"
	tabindex="0"
	aria-label={`${label}. Drag or use arrow keys to rotate; Home resets.`}
	onpointerdown={down}
	onpointermove={drag}
	onpointerup={up}
	onpointercancel={up}
	onlostpointercapture={() => {
		gesture = null;
	}}
	onkeydown={key}
>
	<title>{label}</title>
	{#each layers as layer (layer.key)}
		<polygon
			points={layer.corners
				.map((c) => {
					const p = project(c);
					return `${p.x},${p.y}`;
				})
				.join(' ')}
			fill="var(--plane)"
			fill-opacity=".07"
		/>
		{#each axes as n (n)}
			{@const a = project([n, 0, layer.z, layer.w])}{@const b = project([
				n,
				3,
				layer.z,
				layer.w
			])}{@const c = project([0, n, layer.z, layer.w])}{@const d = project([
				3,
				n,
				layer.z,
				layer.w
			])}
			<line
				x1={a.x}
				y1={a.y}
				x2={b.x}
				y2={b.y}
				stroke="var(--grid)"
				stroke-width={n === 0 || n === 3 ? 1.3 : 0.6}
			/>
			<line
				x1={c.x}
				y1={c.y}
				x2={d.x}
				y2={d.y}
				stroke="var(--grid)"
				stroke-width={n === 0 || n === 3 ? 1.3 : 0.6}
			/>
		{/each}
	{/each}
	{#each [0, 3] as x (x)}{#each [0, 3] as y (y)}
			{#each four ? [0, 1] : [0] as w (w)}{@const a = project([x, y, 0, w])}{@const b = project([
					x,
					y,
					1,
					w
				])}<line
					x1={a.x}
					y1={a.y}
					x2={b.x}
					y2={b.y}
					stroke="var(--grid)"
					stroke-width="1.3"
				/>{/each}
			{#if four}{#each [0, 1] as z (z)}{@const a = project([x, y, z, 0])}{@const b = project([
						x,
						y,
						z,
						1
					])}<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke="var(--axis-w)"
						stroke-width="1.2"
						stroke-dasharray="4 5"
						opacity=".8"
					/>{/each}{/if}
		{/each}{/each}
	<path
		d={piece === 'n'
			? `M${start.x},${start.y} Q${(start.x + end.x) / 2},${(start.y + end.y) / 2 - 40} ${end.x},${end.y}`
			: `M${start.x},${start.y} L${end.x},${end.y}`}
		stroke={invalid ? 'var(--danger)' : 'var(--accent)'}
		stroke-width="2.5"
		stroke-dasharray={invalid ? '3 4' : undefined}
		fill="none"
	/>
	<circle
		cx={start.x}
		cy={start.y}
		r="6"
		fill="var(--page)"
		stroke="var(--accent)"
		stroke-width="1.5"
	/>
	<circle
		cx={end.x}
		cy={end.y}
		r="17"
		fill="var(--surface)"
		stroke={invalid ? 'var(--danger)' : 'var(--accent)'}
		stroke-width="1.5"
	/>
	{#if capture && progress < 1}<Piece
			onDark
			piece={{ t: 'r', c: 'b' }}
			x={end.x - 17}
			y={end.y - 17}
			size={34}
			opacity={1 - Math.max(0, (progress - 0.8) / 0.2)}
		/>{/if}
	{#if invalid}<path
			d={`M${end.x - 5},${end.y - 5}l10,10m0,-10l-10,10`}
			stroke="var(--danger)"
			stroke-width="2"
		/>{/if}
	<g data-guide-piece
		><Piece onDark piece={{ t: piece, c: 'w' }} x={mover.x - 17} y={mover.y - 20} size={34} /></g
	>
	{#if four}{@const outer = project([3, 3, 0, 1])}{@const inner = project([3, 3, 0, 0])}<text
			x={outer.x + 9}
			y={outer.y - 9}
			fill="var(--axis-w)">W=1</text
		><text x={inner.x + 9} y={inner.y - 9} fill="var(--muted)">W=0</text>{/if}
	<AxisGizmo axes={orientation} />
</svg>

<style>
	.projection:focus {
		outline: none;
		box-shadow: none;
	}
	.projection:focus-visible {
		background: var(--surface-raised);
	}
	.projection {
		display: block;
		width: 100%;
		touch-action: none;
		user-select: none;
		cursor: grab;
		overflow: visible;
		border-radius: var(--radius-control);
	}
	.projection:active {
		cursor: grabbing;
	}
	text {
		font: 10px var(--font-data);
	}
</style>
