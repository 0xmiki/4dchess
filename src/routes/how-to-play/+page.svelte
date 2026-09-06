<script lang="ts">
	import HowToPlay from '$lib/components/HowToPlay.svelte';
</script>

<svelte:head
	><title>How to play · 4D chess</title><meta
		name="description"
		content="Learn the four dimensions and try each chess piece's moves with interactive diagrams."
	/></svelte:head
>
<main class="shell">
	<HowToPlay />
</main>

<style>
	main :global(.guide) {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}
</style>
