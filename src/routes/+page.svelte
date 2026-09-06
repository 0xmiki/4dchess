<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createInitialState } from '$lib/chess';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import PlayOption from '$lib/components/PlayOption.svelte';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
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
	<section class="play-options" aria-label="Choose how to play">
		<PlayOption mode="friend" disabled={!ready} onclick={() => goto(resolve('/friend'))} />
		<PlayOption mode="computer" disabled={!ready} onclick={() => goto(resolve('/computer'))} />
	</section>
	{#if recent && /^[a-z0-9]+$/.test(recent)}<a
			class="resume"
			href={resolve('/game/[gameId]', { gameId: recent })}>Return to your last friend match →</a
		>{/if}
	<section class="board-preview" aria-label="Starting position">
		<div class="preview-heading">
			<h2>Starting position</h2>
			<a href={resolve('/how-to-play')}>Learn how to play →</a>
		</div>
		<ChessBoard board={position.board} turn="w" seat="white" enabled={false} onmove={() => {}} />
	</section>
</main>

<style>
	.play-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-5);
		max-width: 1000px;
		margin: var(--space-6) auto var(--space-7);
	}
	.resume {
		display: block;
		width: fit-content;
		margin: calc(-1 * var(--space-5)) auto var(--space-6);
		font-size: 14px;
		color: var(--muted);
	}
	.preview-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-4);
		margin-bottom: var(--space-5);
	}
	.preview-heading h2 {
		font-size: 20px;
	}
	.preview-heading a {
		color: var(--accent);
		font-size: 14px;
		text-decoration: none;
	}
	.preview-heading a:hover {
		text-decoration: underline;
	}
	@media (max-width: 700px) {
		.play-options {
			grid-template-columns: 1fr;
			gap: var(--space-4);
			margin: var(--space-5) auto var(--space-6);
		}
		.preview-heading {
			align-items: flex-start;
		}
		.preview-heading h2 {
			font-size: 17px;
		}
		.preview-heading a {
			font-size: 13px;
		}
	}
</style>
