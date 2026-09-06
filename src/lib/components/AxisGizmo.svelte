<script lang="ts">
	let {
		axes,
		x = 30,
		y = 270
	}: {
		axes: readonly { label: string; dx: number; dy: number }[];
		x?: number;
		y?: number;
	} = $props();
</script>

<g aria-hidden="true"
	><circle cx={x} cy={y} r="2" fill="var(--muted)" />{#each axes as axis (axis.label)}<line
			x1={x}
			y1={y}
			x2={x + axis.dx}
			y2={y + axis.dy}
			stroke="var(--grid)"
			stroke-width="1.2"
		/><text x={x + axis.dx + (axis.dx < 0 ? -8 : 4)} y={y + axis.dy + (axis.dy < 0 ? -4 : 11)}
			>{axis.label}</text
		>{/each}</g
>

<style>
	text {
		font: 10px var(--font-data);
		fill: var(--muted);
	}
</style>
