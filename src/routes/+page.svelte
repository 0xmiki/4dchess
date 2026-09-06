<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { api } from '../convex/_generated/api';
	import { guestClient, errorMessage } from '$lib/multiplayer';
	import SideToggle from '$lib/components/SideToggle.svelte';
	import PlayOption from '$lib/components/PlayOption.svelte';
	import AutoplayTesseract from '$lib/components/AutoplayTesseract.svelte';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';

	let seat = $state<'white' | 'black'>('white'),
		busy = $state(false),
		error = $state('');
	let requestId: string | null = null;
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
	async function create() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			try {
				const stored = sessionStorage.getItem('fourfold-create');
				if (stored && !requestId) {
					const pending = JSON.parse(stored);
					if (
						pending.seat === seat &&
						typeof pending.requestId === 'string' &&
						/^[a-f0-9-]{36}$/i.test(pending.requestId)
					)
						requestId = pending.requestId;
				}
			} catch {
				/* Storage is optional. */
			}
			requestId ??= crypto.randomUUID();
			try {
				sessionStorage.setItem('fourfold-create', JSON.stringify({ requestId, seat }));
			} catch {
				/* The live request still has a stable ID. */
			}
			const client = await guestClient();
			const created = await client.mutation(api.games.create, { seat, requestId });
			try {
				sessionStorage.removeItem('fourfold-create');
			} catch {
				/* Storage is optional. */
			}
			await goto(resolve('/game/[gameId]', { gameId: created.gameId }));
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head
	><title>4D chess · Play</title><meta
		name="description"
		content="Play four-dimensional chess with a friend or the computer."
	/></svelte:head
>
<main class="shell">
	<h1 class="sr-only">4D chess</h1>

	<div class="home-play">
		<section class="play-options" aria-label="Choose how to play">
			<SideToggle
				bind:value={seat}
				disabled={busy || !ready}
				onchange={() => {
					requestId = null;
				}}
			/>
			<PlayOption mode="friend" {busy} disabled={!ready || busy} onclick={create} />

			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<PlayOption
				mode="computer"
				disabled={!ready || busy}
				onclick={() => goto(resolve(seat === 'white' ? '/computer?side=w' : '/computer?side=b'))}
			/>
			<a class="learn" href={resolve('/how-to-play')}
				><BookOpenIcon size={20} aria-hidden="true" />Learn how to play</a
			>
			{#if recent && /^[a-z0-9]+$/.test(recent)}<a
					class="resume"
					href={resolve('/game/[gameId]', { gameId: recent })}>Return to your last friend match →</a
				>{/if}
		</section>
		<AutoplayTesseract />
	</div>
</main>

<style>
	.home-play {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		gap: var(--space-8);
		align-items: center;
		min-height: calc(100svh - 48px);
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
