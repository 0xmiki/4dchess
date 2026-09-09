<script lang="ts">
	let {
		won,
		side,
		x,
		y,
		size = '100%'
	}: { won: boolean; side: 'w' | 'b'; x?: number; y?: number; size?: number | string } = $props();
</script>

<svg
	class="king-result-badge"
	class:won
	{x}
	{y}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	role="img"
	aria-label={`${side === 'w' ? 'White' : 'Black'} ${won ? 'won' : 'lost'}`}
>
	<title>{side === 'w' ? 'White' : 'Black'} {won ? 'won' : 'lost'}</title>
	<circle cx="12" cy="12" r="11.5" fill={won ? '#54823c' : '#b74545'} />
	{#if won}<path d="M5 8L8.5 11L12 5L15.5 11L19 8L17.5 17H6.5Z" fill="white" />
	{:else}<path
			d="M8 8L16 16M16 8L8 16"
			fill="none"
			stroke="white"
			stroke-width="2.5"
			stroke-linecap="round"
		/>{/if}
</svg>

<style>
	.king-result-badge {
		pointer-events: none;
		overflow: visible;
	}
</style>
