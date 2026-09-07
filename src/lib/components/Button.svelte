<script lang="ts">
	import { onMount } from 'svelte';
	import Spinner from './Spinner.svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	let {
		children,
		variant = 'default',
		loading = false,
		...attributes
	}: HTMLButtonAttributes & { variant?: 'default' | 'primary'; loading?: boolean } = $props();
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<button
	{...attributes}
	disabled={attributes.disabled || loading || !hydrated}
	aria-busy={loading || attributes['aria-busy']}
	type={attributes.type ?? 'button'}
	class:primary={variant === 'primary'}
	>{#if loading}<span class="loading-icon" aria-hidden="true"><Spinner label="Loading" /></span
		>{/if}{@render children?.()}</button
>

<style>
	.loading-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	button {
		min-height: var(--control-height);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-weight: 750;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-5);
		background: var(--surface-raised);
		color: var(--text);
		cursor: pointer;
		box-shadow: none;
		transition:
			transform var(--motion-press),
			box-shadow var(--motion-press),
			background var(--motion-press);
	}
	button:hover:not(:disabled) {
		background: var(--line);
	}
	button:active:not(:disabled) {
		background: var(--surface);
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	button.primary {
		background: var(--primary-fill);
		color: var(--on-accent);
		border-color: var(--primary-fill);
		box-shadow:
			0 var(--press-depth) 0 var(--accent-base),
			0 5px 8px #00000045,
			inset 0 1px 0 #ffffff80;
	}
	button.primary:hover:not(:disabled) {
		background: var(--primary-hover);
	}
	button.primary:active:not(:disabled) {
		transform: translateY(var(--press-depth));
		box-shadow: 0 0 0 var(--accent-base);
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
