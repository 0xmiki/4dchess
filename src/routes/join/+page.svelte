<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import PlayerProfile from '$lib/components/PlayerProfile.svelte';
	import HomeLink from '$lib/components/HomeLink.svelte';
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
			await goto(resolve('/room/[roomId]', { roomId: joined.gameId }));
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head
	><title>Accept challenge · 4D chess</title><meta
		name="referrer"
		content="no-referrer"
	/></svelte:head
>
<main class="challenge-page">
	<section class="challenge-card" aria-label="Friend challenge">
		<HomeLink />
		{#if !ready || (token && preview.isLoading)}
			<div class="challenge-loading"><Spinner label="Loading challenge" /></div>
		{:else if !token || preview.error}
			<h1>Challenge unavailable</h1>
			<p class="error" role="alert">
				{!token ? 'This invitation is invalid.' : errorMessage(preview.error)}
			</p>
			<a href={resolve('/')}>Create a challenge</a>
		{:else if preview.data}
			<h1>{preview.data.availableSeat ? 'Accept challenge' : 'Room invitation'}</h1>
			<div class="challenger">
				<p>Challenge from</p>
				<PlayerProfile
					name={preview.data.challengerName}
					side={preview.data.availableSeat === 'white' ? 'black' : 'white'}
				/>
			</div>
			{#if preview.data.availableSeat}
				<dl class="challenge-details">
					<div>
						<dt>You play</dt>
						<dd>{preview.data.availableSeat === 'white' ? 'White' : 'Black'}</dd>
					</div>
					<div>
						<dt>Time control</dt>
						<dd>Untimed</dd>
					</div>
				</dl>
			{:else}<p>
					This challenge has no open seat. Players who already joined can return to their room.
				</p>{/if}
			<Button variant="primary" onclick={join} disabled={busy}
				>{#if busy}<Spinner label="Accepting challenge" />{/if}{preview.data.availableSeat
					? 'Accept challenge'
					: 'Return to room'}</Button
			>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</section>
</main>

<style>
	.challenge-page {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: var(--space-5);
	}
	.challenge-card {
		width: min(100%, 420px);
		display: grid;
		gap: var(--space-5);
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel, 20px);
		box-shadow: 0 12px 32px #0002;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		line-height: 1.2;
	}
	p {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
	.challenger {
		display: grid;
		gap: var(--space-3);
	}
	.challenge-details {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		padding-block: var(--space-4);
		border-block: 1px solid var(--line);
	}
	dt {
		color: var(--muted);
		font-size: 12px;
	}
	dd {
		margin: var(--space-2) 0 0;
		font-size: 14px;
	}
	.challenge-loading {
		min-height: 200px;
		display: grid;
		place-items: center;
	}
	@media (max-width: 480px) {
		.challenge-card {
			padding: var(--space-5);
		}
	}
</style>
