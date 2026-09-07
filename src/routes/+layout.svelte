<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { historyMotionKey, createHistoryMotion } from '$lib/history-motion';
	setContext(historyMotionKey, createHistoryMotion());
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

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="4D chess" />
	<meta property="og:title" content="4D chess" />
	<meta property="og:description" content="Play with your friends." />
	<meta property="og:url" content="https://4dchess.lol/" />
	<meta property="og:image" content="https://4dchess.lol/social-preview.png" />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="4D chess. Play with your friends. A tesseract on a dark background."
	/>
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="4D chess" />
	<meta name="twitter:description" content="Play with your friends." />
	<meta name="twitter:image" content="https://4dchess.lol/social-preview.png" />
	<meta
		name="twitter:image:alt"
		content="4D chess. Play with your friends. A tesseract on a dark background."
	/>
</svelte:head>
<HomeLink corner />
{#if page.route.id?.startsWith('/game/') || page.route.id?.startsWith('/room/') || page.route.id === '/join' || page.route.id === '/match'}<AuthProvider
		>{@render children()}</AuthProvider
	>{:else}{@render children()}{/if}
