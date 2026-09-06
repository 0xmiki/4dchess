<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { authClient } from '$lib/auth-client';

	let { children } = $props();

	createSvelteAuthClient({ authClient, options: { disabled: !browser } });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
