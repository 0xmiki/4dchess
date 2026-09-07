<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getContext } from 'svelte';
	import { useAuth, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import { homeRoomKey, type HomeRoomState } from '$lib/home-room';
	import PlayerRoom from './PlayerRoom.svelte';
	import SpectatorRoom from './SpectatorRoom.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	const auth = useAuth();
	const roomId = $derived((page.params.roomId ?? page.params.gameId) as Id<'games'>);
	const role = useQuery(api.watch.role, () => (auth.isLoading ? 'skip' : { roomId }));
	const homeRoom = getContext<HomeRoomState>(homeRoomKey);
	$effect(() => {
		homeRoom.spectatingRoomId = role.data === 'spectator' ? roomId : null;
		return () => {
			homeRoom.spectatingRoomId = null;
		};
	});
</script>

{#if auth.isLoading || role.isLoading}<LoadingScreen label="Opening game" />
{:else if role.error}<main class="shell">
		<p>This game is unavailable.</p>
		<a href={resolve('/')}>Back to play</a>
	</main>
{:else if role.data === 'spectator'}{#key roomId}<SpectatorRoom {roomId} />{/key}
{:else if role.data}<PlayerRoom />{/if}
