<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { gameSounds } from '$lib/audio/game-sounds';
	onMount(() => gameSounds.init());
	import { historyMotionKey, createHistoryMotion } from '$lib/history-motion';
	setContext(historyMotionKey, createHistoryMotion());
	import { homeRoomKey, type HomeRoomState } from '$lib/home-room';
	const homeRoom = $state<HomeRoomState>({ roomId: null, room: null });
	setContext(homeRoomKey, homeRoom);
	import './layout.css';
	import '$lib/design.css';
	import favicon from '$lib/assets/favicon.svg';
	import uiFont from '$lib/assets/fonts/outfit-latin-variable.woff2?url';
	import { page } from '$app/state';
	import AuthProvider from '$lib/components/AuthProvider.svelte';
	import HomeLink from '$lib/components/HomeLink.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preload" href={uiFont} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="icon" href={favicon} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="4D chess" />
	<meta
		property="og:title"
		content={page.route.id === '/stats' ? 'Game stats · 4D chess' : '4D chess'}
	/>
	<meta
		property="og:description"
		content={page.route.id === '/stats'
			? 'Multiplayer game totals and daily activity.'
			: 'Play with your friends.'}
	/>
	<meta
		property="og:url"
		content={page.route.id === '/stats' ? 'https://4dchess.lol/stats' : 'https://4dchess.lol/'}
	/>
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
{#if page.route.id !== '/stats'}<HomeLink corner />{/if}
{#if page.route.id?.startsWith('/game/') || page.route.id?.startsWith('/room/') || page.route.id === '/join' || page.route.id === '/match'}<AuthProvider
		>{@render children()}</AuthProvider
	>{:else}{@render children()}{/if}
