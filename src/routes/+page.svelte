<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createInitialState } from '$lib/chess';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import PlayOption from '$lib/components/PlayOption.svelte';
	import SpatialBoard from '$lib/components/SpatialBoard.svelte';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	const position = createInitialState();
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

<svelte:head
	><title>4D chess · Play</title><meta
		name="description"
		content="Play four-dimensional chess with a friend or the computer."
	/></svelte:head
>
<main class="shell">
	<GameHeader heading />

	<div class="home-play">
		<section class="play-options" aria-label="Choose how to play">
			<PlayOption mode="friend" disabled={!ready} onclick={() => goto(resolve('/friend'))} />
			<PlayOption mode="computer" disabled={!ready} onclick={() => goto(resolve('/computer'))} />
			<a class="learn" href={resolve('/how-to-play')}
				><BookOpenIcon size={20} aria-hidden="true" />Learn how to play</a
			>
			{#if recent && /^[a-z0-9]+$/.test(recent)}<a
					class="resume"
					href={resolve('/game/[gameId]', { gameId: recent })}>Return to your last friend match →</a
				>{/if}
		</section>
		<SpatialBoard
			board={position.board}
			selected={null}
			moves={[]}
			lastMove={null}
			motion={null}
			inspection={null}
			onselect={() => {}}
			oninspect={() => {}}
		/>
	</div>
</main>

<style>
	.home-play {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		gap: var(--space-8);
		align-items: center;
		min-height: calc(100svh - 150px);
	}
	.play-options {
		display: grid;
		gap: var(--space-5);
		width: 100%;
		max-width: 480px;
		justify-self: center;
	}
	.learn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--control-height);
		text-decoration: none;
		color: var(--text);
	}
	.learn:hover {
		text-decoration: underline;
	}
	.resume {
		text-align: center;
		font-size: 14px;
		color: var(--muted);
	}
	@media (max-width: 800px) {
		.home-play {
			grid-template-columns: 1fr;
			gap: var(--space-5);
			min-height: 0;
			padding-top: var(--space-5);
		}
		.play-options {
			gap: var(--space-4);
		}
	}
</style>
