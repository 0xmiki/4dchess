<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '../convex/_generated/api';
	import { guestClient, errorMessage } from '$lib/multiplayer';
	let seat = $state<'white' | 'black'>('white');
	let busy = $state(false),
		error = $state(''),
		recent = $state('');
	let requestId: string | null = null;
	let ready = $state(false);
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

<svelte:head><title>4D chess · Play a friend</title></svelte:head>
<main class="shell">
	<header class="site-header"><h1>4D chess</h1></header>
	<section class="flow" aria-label="Create friend match">
		<label
			>Your side<select
				bind:value={seat}
				disabled={busy || !ready}
				onchange={() => {
					requestId = null;
				}}><option value="white">White</option><option value="black">Black</option></select
			></label
		>
		<button class="primary" onclick={create} disabled={busy || !ready}
			>{busy ? 'Creating match…' : 'Create friend match'}</button
		>
		<p class="muted">Untimed · Guest match</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if recent && /^[a-z0-9]+$/.test(recent)}<a
				href={resolve('/game/[gameId]', { gameId: recent })}>Return to your last match</a
			>{/if}
	</section>
</main>
