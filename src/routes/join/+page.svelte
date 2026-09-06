<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import { guestClient, errorMessage } from '$lib/multiplayer';
	let token = $state(''),
		ready = $state(false),
		busy = $state(false),
		error = $state('');
	const preview = useQuery(api.games.previewInvite, () => (token ? { token } : 'skip'));
	onMount(() => {
		const fragment = location.hash.slice(1);
		if (/^[a-f0-9]{64}$/.test(fragment)) token = fragment;
		ready = true;
	});
	async function join() {
		busy = true;
		error = '';
		try {
			const client = await guestClient();
			const joined = await client.mutation(api.games.join, { token });
			await goto(resolve('/game/[gameId]', { gameId: joined.gameId }));
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head
	><title>Join a friend · 4D chess</title><meta
		name="referrer"
		content="no-referrer"
	/></svelte:head
>
<main class="shell">
	<GameHeader />
	<section class="flow" aria-label="Join friend match">
		{#if !ready || (token && preview.isLoading)}<p role="status">Loading invitation…</p>
		{:else if !token}<p class="error" role="alert">This invitation is invalid.</p>
			<a href={resolve('/')}>Create a match</a>
		{:else if preview.error}<p class="error" role="alert">{errorMessage(preview.error)}</p>
			<a href={resolve('/')}>Create a match</a>
		{:else if preview.data}
			<h1>{preview.data.availableSeat ? 'Join your friend' : 'Match invitation'}</h1>
			{#if preview.data.availableSeat}<p>
					You’ll play {preview.data.availableSeat}. Untimed.
				</p>{:else}<p>
					This invitation has no open seat. If you already joined, you can return to the match.
				</p>{/if}
			<Button variant="primary" onclick={join} disabled={busy}
				>{busy ? 'Joining…' : preview.data.availableSeat ? 'Join match' : 'Return to match'}</Button
			>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</section>
</main>
