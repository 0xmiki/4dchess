<script lang="ts">
	import logo from '$lib/assets/logo.svg';
	import mark from '$lib/assets/logo-mark.svg';
	let { wordmark = true }: { wordmark?: boolean } = $props();
</script>

<div class="brand" aria-label="4D chess">
	<img src={wordmark ? logo : mark} width={wordmark ? 152 : 52} height="36" alt="" />
</div>

<style>
	.brand {
		display: flex;
		align-items: center;
	}
	img {
		display: block;
		flex-shrink: 0;
		object-fit: contain;
	}
</style>
