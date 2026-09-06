<script lang="ts">
	let { size = 30 }: { size?: number } = $props();
	const vertices = Array.from({ length: 16 }, (_, i) => {
		const x = i & 1 ? 1 : -1,
			y = i & 2 ? 1 : -1,
			z = i & 4 ? 1 : -1,
			w = i & 8 ? 1 : 0.48;
		return {
			x: 16 + (x * 0.85 + z * 0.5) * w * 9,
			y: 16 + (y * 0.88 - z * 0.35 + x * 0.15) * w * 9
		};
	});
	const edges = vertices.flatMap((a, i) =>
		[1, 2, 4, 8]
			.filter((axis) => !(i & axis))
			.map((axis) => ({ a, b: vertices[i | axis], w: axis === 8, id: `${i}:${axis}` }))
	);
</script>

<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"
	>{#each edges as edge (edge.id)}<line
			x1={edge.a.x}
			y1={edge.a.y}
			x2={edge.b.x}
			y2={edge.b.y}
			stroke={edge.w ? 'var(--axis-w)' : 'currentColor'}
			stroke-width={edge.w ? 0.8 : 1.1}
			opacity={edge.w ? 0.75 : 1}
		/>{/each}</svg
>
