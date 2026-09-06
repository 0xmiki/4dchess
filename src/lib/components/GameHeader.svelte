<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import TesseractMark from './TesseractMark.svelte';
	let { children, heading = false }: { children?: Snippet; heading?: boolean } = $props();
</script>

<header class="site-header">
	{#if heading}<h1 class="brand"><TesseractMark />4D chess</h1>{:else}<a
			class="brand"
			href={resolve('/')}><TesseractMark />4D chess</a
		>{/if}
	<div class="header-actions">
		<a class="guide-link" href={resolve('/how-to-play')}>How to play</a
		>{#if children}{@render children()}{/if}
	</div>
</header>

<style>
	.brand {
		min-height: var(--control-height);
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		letter-spacing: -0.035em;
	}
	.header-actions {
		display: flex;
		gap: var(--space-5);
		align-items: center;
	}
	.guide-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--control-height);
		font-size: 13px;
		color: var(--muted);
		text-decoration: none;
	}
	.guide-link:hover {
		color: var(--text);
	}
	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		border-bottom: 1px solid var(--line);
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
