<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, type Snippet } from 'svelte';
	import { closeConvex } from 'convex-svelte';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { authClient } from '$lib/auth-client';
	let { children }: { children: Snippet } = $props();
	createSvelteAuthClient({ authClient, options: { disabled: !browser } });
	onDestroy(() => {
		if (browser) void closeConvex();
	});
</script>

{@render children()}
