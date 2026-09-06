<script lang="ts">
	import Spinner from './Spinner.svelte';
	let { label = 'Loading' }: { label?: string } = $props();
</script>

<div class="loading-screen" aria-busy="true"><Spinner {label} /></div>

<style>
	.loading-screen {
		position: fixed;
		inset: 0;
		z-index: 20;
		min-height: 100svh;
		background: var(--page);
		width: 100%;
		display: grid;
		place-items: center;
	}
	.loading-screen :global(.spinner) {
		width: 32px;
		height: 32px;
	}
</style>
