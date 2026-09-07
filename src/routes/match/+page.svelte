<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useAuth, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { FunctionReturnType } from 'convex/server';
	import { guestClient, errorMessage } from '$lib/multiplayer';
	import { rememberMatch } from '$lib/active-match';
	import { timeControls, type TimedControl } from '$lib/online/time-controls';
	import Button from '$lib/components/Button.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	const auth = useAuth();
	const current = useQuery(api.matchmaking.current, () => (auth.isAuthenticated ? {} : 'skip'));
	type Search = FunctionReturnType<typeof api.matchmaking.join>;
	let search = $state<Search | null>(null),
		control = $state<TimedControl>('10+5'),
		error = $state(''),
		cancelling = $state(false);
	let client: Awaited<ReturnType<typeof guestClient>> | null = null,
		requestId = '',
		alive = true,
		leaving = false,
		heartbeatBusy = false;
	function clearSaved() {
		try {
			localStorage.removeItem('fourfold-search');
		} catch {
			/* Storage is optional. */
		}
	}
	function receive(value: Search) {
		if (!alive || leaving) return;
		search = value;
		if (value.status === 'matched' && value.gameId) {
			leaving = true;
			clearSaved();
			rememberMatch({ kind: 'friend', gameId: value.gameId });
			void goto(resolve('/room/[roomId]', { roomId: value.gameId }), { replaceState: true });
		} else if (value.status === 'cancelled') {
			leaving = true;
			clearSaved();
			void goto(resolve('/'), { replaceState: true });
		}
	}
	async function start() {
		error = '';
		try {
			client ??= await guestClient();
			receive(await client.mutation(api.matchmaking.join, { requestId, timeControl: control }));
		} catch (cause) {
			if (alive) error = errorMessage(cause);
		}
	}
	async function cancelSearch() {
		if (cancelling || leaving) return;
		cancelling = true;
		error = '';
		try {
			client ??= await guestClient();
			receive(
				await client.mutation(api.matchmaking.cancel, {
					id: search?.id,
					requestId,
					timeControl: control
				})
			);
		} catch (cause) {
			if (alive) error = errorMessage(cause);
		} finally {
			cancelling = false;
		}
	}
	beforeNavigate(({ to, cancel }) => {
		if (to && !leaving) {
			cancel();
			void cancelSearch();
		}
	});
	onMount(() => {
		const selected = new URL(location.href).searchParams.get('time');
		if (selected && Object.hasOwn(timeControls, selected)) control = selected as TimedControl;
		try {
			const saved = JSON.parse(localStorage.getItem('fourfold-search') ?? 'null');
			if (
				saved &&
				/^[a-f0-9-]{36}$/i.test(saved.requestId) &&
				Object.hasOwn(timeControls, saved.timeControl)
			) {
				requestId = saved.requestId;
				control = saved.timeControl;
			}
		} catch {
			/* Ignore malformed local state. */
		}
		requestId ||= crypto.randomUUID();
		try {
			localStorage.setItem('fourfold-search', JSON.stringify({ requestId, timeControl: control }));
		} catch {
			/* Storage is optional. */
		}
		void start();
		const heartbeat = setInterval(async () => {
			if (
				!client ||
				search?.status !== 'waiting' ||
				heartbeatBusy ||
				cancelling ||
				leaving ||
				document.hidden
			)
				return;
			heartbeatBusy = true;
			try {
				receive(await client.mutation(api.matchmaking.heartbeat, { id: search.id }));
			} catch (cause) {
				if (alive) error = errorMessage(cause);
			} finally {
				heartbeatBusy = false;
			}
		}, 8000);
		return () => {
			alive = false;
			clearInterval(heartbeat);
		};
	});
	$effect(() => {
		const update = current.data;
		if (update)
			untrack(() => {
				if (search?.id === update.id) receive(update);
			});
	});
</script>

<svelte:head><title>Find opponent · 4D chess</title></svelte:head>
<main class="search-page">
	<section aria-label="Find opponent">
		<Spinner label="Finding opponent" />
		<h1>Finding an opponent</h1>
		<p>{timeControls[search?.timeControl ?? control].label} · Unrated · Random side</p>
		{#if error}<p class="error" role="alert">{error}</p>
			<Button onclick={start} disabled={cancelling}>Retry</Button>{/if}
		<Button onclick={cancelSearch} disabled={cancelling}
			>{#if cancelling}<Spinner label="Cancelling search" />{/if}Cancel search</Button
		>
	</section>
</main>

<style>
	.search-page {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: var(--space-5);
	}
	section {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		text-align: center;
		width: min(100%, 360px);
	}
	h1 {
		font-size: 24px;
	}
	p {
		color: var(--muted);
	}
</style>
