<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	let ready = $state(false),
		recent = $state('');
	onMount(() => {
		ready = true;
		try {
			recent = localStorage.getItem('fourfold-last-game') ?? '';
		} catch {
			/* Storage is optional. */
		}
	});
</script>

<svelte:head><title>4D chess</title></svelte:head>
<main class="shell">
	<GameHeader heading />
	<section class="flow" aria-label="Choose how to play">
		<Button variant="primary" disabled={!ready} onclick={() => goto(resolve('/friend'))}
			>Play with friend</Button
		><Button disabled={!ready} onclick={() => goto(resolve('/computer'))}>Play computer</Button
		>{#if recent && /^[a-z0-9]+$/.test(recent)}<a
				href={resolve('/game/[gameId]', { gameId: recent })}>Return to your last friend match</a
			>{/if}
	</section>
</main>
