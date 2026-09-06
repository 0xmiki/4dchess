<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	let { children, heading = false }: { children?: Snippet; heading?: boolean } = $props();
</script>

<header class="site-header">
	{#if heading}<h1>4D chess</h1>{:else}<a href={resolve('/')}>4D chess</a
		>{/if}{#if children}{@render children()}{/if}
</header>

<style>
	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid #dce0d8;
		padding-bottom: 16px;
		margin-bottom: 24px;
	}
	.site-header > a {
		font-size: 18px;
		font-weight: 650;
		text-decoration: none;
	}
	@media (max-width: 700px) {
		.site-header {
			margin-bottom: 18px;
		}
	}
</style>
