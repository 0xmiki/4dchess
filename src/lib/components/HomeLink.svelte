<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getContext } from 'svelte';
	import { homeRoomKey, type HomeRoomState } from '$lib/home-room';
	const homeRoom = getContext<HomeRoomState>(homeRoomKey);
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import { activeMatch, leaveMatch } from '$lib/active-match';
	import { existingGuestClient, errorMessage } from '$lib/multiplayer';
	import Logo from './Logo.svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';
	let { corner = false }: { corner?: boolean } = $props();
	let checking = $state(false);
	let busy = $state(false),
		error = $state('');
	let room = $state<FunctionReturnType<typeof api.games.get> | null>(null);
	let dialog: ReturnType<typeof Modal>;
	let client: Awaited<ReturnType<typeof existingGuestClient>> = null;
	let resignRequest: string | null = null;
	const waiting = $derived(room?.game.status === 'waiting');

	function goHome() {
		leaveMatch();
		void goto(resolve('/'));
		if (room?.game.rematchRequestedBy) {
			const gameId = room.game._id;
			void existingGuestClient()
				.then((client) => client?.mutation(api.games.dismissRematch, { gameId }))
				.catch(() => {
					error = 'You left the room, but the rematch request could not be cancelled.';
					dialog.showModal();
				});
		}
	}
	async function home(event: MouseEvent) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		if (busy || checking) return;
		error = '';
		resignRequest = null;
		const active = activeMatch();
		const roomId =
			page.params.roomId ??
			page.params.gameId ??
			(active?.kind === 'friend' ? active.gameId : null);
		room = roomId && homeRoom.roomId === roomId ? homeRoom.room : null;
		if (!roomId || room?.game.status === 'finished') {
			goHome();
			return;
		}
		if (room) {
			dialog.showModal();
			return;
		}
		// Only a direct entry before the room subscription resolves needs a lookup.
		checking = true;
		dialog.showModal();
		try {
			client = await existingGuestClient();
			if (!client) throw new Error('Session unavailable');
			room = await client.query(api.games.get, { gameId: roomId as Id<'games'> });
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			checking = false;
		}
	}

	async function confirm() {
		if (!room || busy) return;
		busy = true;
		error = '';
		try {
			client = await existingGuestClient();
			if (!client) throw new Error('Session unavailable');
			if (waiting) {
				await client.mutation(api.games.cancel, {
					gameId: room.game._id,
					expectedRevision: room.game.revision
				});
			} else {
				resignRequest ??= crypto.randomUUID();
				await client.mutation(api.games.resign, {
					gameId: room.game._id,
					expectedRevision: room.game.revision,
					requestId: resignRequest
				});
			}
			leaveMatch();
			dialog.close();
			await goto(resolve('/'));
		} catch (cause) {
			error = errorMessage(cause);
			// A friend may join or move while the dialog is open. Refresh before another attempt.
			try {
				if (client) room = await client.query(api.games.get, { gameId: room.game._id });
				resignRequest = null;
			} catch {
				/* Keep the original failure visible. */
			}
		} finally {
			busy = false;
		}
	}
</script>

<a
	href={resolve('/')}
	class:corner
	class="home-link"
	aria-label="4D chess home"
	aria-busy={busy}
	onclick={home}><Logo wordmark={!corner} /></a
>
<Modal
	bind:this={dialog}
	title={room
		? waiting
			? 'Delete this challenge?'
			: room.game.status === 'active'
				? 'Resign and go home?'
				: 'Game finished'
		: checking
			? 'Checking your room…'
			: 'Could not open home'}
	dismissOnBackdrop
>
	{#if checking}<Spinner label="Checking room" />{/if}
	{#if room}<p>
			{waiting
				? 'Going home deletes your pending challenge. The invitation will stop working.'
				: room.game.status === 'active'
					? 'Your opponent will win this game.'
					: 'Your game has already ended.'}
		</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="row">
		<Button onclick={() => dialog.close()} disabled={busy}
			>{room ? (waiting ? 'Keep challenge' : 'Stay here') : 'Dismiss'}</Button
		>
		{#if room && room.game.status !== 'finished'}<Button onclick={confirm} disabled={busy}
				>{#if busy}<Spinner label="Confirming" />{/if}{waiting
					? 'Delete challenge'
					: 'Resign and go home'}</Button
			>{:else if room}<Button
				onclick={async () => {
					leaveMatch();
					dialog.close();
					await goto(resolve('/'));
				}}>Go home</Button
			>{/if}
	</div>
</Modal>

<style>
	.home-link {
		display: inline-flex;
		width: fit-content;
		text-decoration: none;
		border-radius: var(--radius-control);
	}
	.home-link:hover {
		opacity: 0.8;
	}
	.home-link:focus-visible {
		background: var(--surface-raised);
	}
	.corner {
		position: absolute;
		z-index: 10;
		top: var(--space-4);
		left: max(var(--space-4), calc((100vw - 1800px) / 2 + var(--space-5)));
	}
</style>
