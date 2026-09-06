<script lang="ts">
	import mark from '$lib/assets/logo.svg';
	let { wordmark = true }: { wordmark?: boolean } = $props();
</script>

<div class="brand" aria-label="4D chess">
	<img src={mark} width="36" height="36" alt="" />
	{#if wordmark}<span>4D chess</span>{/if}
</div>

<style>
	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text);
		font-size: 16px;
		font-weight: 600;
		letter-spacing: -0.025em;
	}
	img {
		display: block;
		flex-shrink: 0;
	}
</style>
