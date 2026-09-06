<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import AuthProvider from '$lib/components/AuthProvider.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if page.route.id?.startsWith('/game/') || page.route.id === '/join'}<AuthProvider
		>{@render children()}</AuthProvider
	>{:else}{@render children()}{/if}
