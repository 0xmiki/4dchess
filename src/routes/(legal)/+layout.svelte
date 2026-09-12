<script lang="ts">
	import { openPrivacySettings } from '$lib/privacy';
	import { resolve } from '$app/paths';
	import HomeLink from '$lib/components/HomeLink.svelte';
	let { children } = $props();
</script>

<main class="shell legal">
	<header><HomeLink /></header>
	<article class="stack">{@render children()}</article>
	<footer>
		<nav class="row" aria-label="Legal">
			<a href={resolve('/')}>Play 4D chess</a>
			<a href={resolve('/privacy')}>Privacy policy</a>
			<a href={resolve('/terms')}>Terms of service</a>
			<a href={resolve('/privacy#privacy-settings')} onclick={openPrivacySettings}
				>Privacy settings</a
			>
		</nav>
	</footer>
</main>

<style>
	.legal {
		max-width: 800px;
		padding-top: var(--space-6);
		padding-bottom: var(--space-8);
	}
	header {
		margin-bottom: var(--space-5);
	}
	article :global(h1) {
		font-size: 32px;
	}
	article :global(h2) {
		margin-top: var(--space-5);
	}
	article :global(ul) {
		list-style: disc;
		padding-left: 24px;
	}
	article :global(li + li) {
		margin-top: var(--space-2);
	}
	footer {
		margin-top: var(--space-8);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
		color: var(--muted);
	}
	footer a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.legal :global(a:focus-visible) {
		text-decoration: underline;
		text-decoration-thickness: 3px;
	}
</style>
