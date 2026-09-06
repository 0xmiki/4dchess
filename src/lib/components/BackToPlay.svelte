<script lang="ts">
	import { resolve } from '$app/paths';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
</script>

<a href={resolve('/')}><CaretLeftIcon size={16} aria-hidden="true" />Back to play</a>

<style>
	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 40px;
		color: var(--muted);
		font-size: 14px;
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
</style>
