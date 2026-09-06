<script lang="ts">
	import { onMount } from 'svelte';
	import { prepareEndSound } from '$lib/end-sound';
	onMount(prepareEndSound);
	import './layout.css';
	import '$lib/design.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import AuthProvider from '$lib/components/AuthProvider.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if page.route.id?.startsWith('/game/') || page.route.id?.startsWith('/room/') || page.route.id === '/join'}<AuthProvider
		>{@render children()}</AuthProvider
	>{:else}{@render children()}{/if}
