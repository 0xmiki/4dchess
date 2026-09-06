<script lang="ts">
	import GameHeader from '$lib/components/GameHeader.svelte';
	import HowToPlay from '$lib/components/HowToPlay.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head
	><title>How to play · 4D chess</title><meta
		name="description"
		content="Learn the four dimensions and try each chess piece's moves with interactive diagrams."
	/></svelte:head
>
<main class="shell">
	<GameHeader />
	<HowToPlay />
	<footer><a href={resolve('/')}>Back to play →</a></footer>
</main>

<style>
	main :global(.guide) {
		margin-top: var(--space-6);
		padding-top: 0;
		border-top: 0;
	}
	footer {
		padding: var(--space-7) 0;
		color: var(--accent);
	}
</style>
