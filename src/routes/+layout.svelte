<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { homeRoomKey, type HomeRoomState } from '$lib/home-room';
	const homeRoom = $state<HomeRoomState>({ roomId: null, room: null });
	setContext(homeRoomKey, homeRoom);
	import { prepareEndSound } from '$lib/end-sound';
	onMount(prepareEndSound);
	import './layout.css';
	import '$lib/design.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import AuthProvider from '$lib/components/AuthProvider.svelte';
	import HomeLink from '$lib/components/HomeLink.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<HomeLink corner />
{#if page.route.id?.startsWith('/game/') || page.route.id?.startsWith('/room/') || page.route.id === '/join'}<AuthProvider
		>{@render children()}</AuthProvider
	>{:else}{@render children()}{/if}
