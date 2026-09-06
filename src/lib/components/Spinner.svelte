<script lang="ts">
	let { label = 'Loading' }: { label?: string } = $props();
</script>

<span class="spinner" role="status" aria-label={label}></span>

<style>
	.spinner {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2s;
		}
	}
</style>
