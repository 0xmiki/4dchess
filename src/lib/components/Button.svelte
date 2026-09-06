<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	let {
		children,
		variant = 'default',
		...attributes
	}: HTMLButtonAttributes & { variant?: 'default' | 'primary' } = $props();
</script>

<button {...attributes} type={attributes.type ?? 'button'} class:primary={variant === 'primary'}
	>{@render children?.()}</button
>

<style>
	button {
		min-height: 42px;
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		padding: 9px 14px;
		background: #fff;
		color: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #edf1e8;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	button.primary {
		background: #315b40;
		color: #fff;
		border-color: #315b40;
	}
	button.primary:hover:not(:disabled) {
		background: #244630;
	}
</style>
