<script lang="ts">
	import { onMount, setContext, type Snippet } from 'svelte';
	import { matchNavigationKey, type MatchNavigation } from '$lib/match-navigation';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	let {
		children,
		navigation,
		onresult,
		label = 'Game options',
		waiting = false,
		notice = ''
	}: {
		children: Snippet;
		navigation?: MatchNavigation;
		onresult?: () => void;
		label?: string;
		waiting?: boolean;
		notice?: string;
	} = $props();
	const registered = $state<MatchNavigation>({
		previous: null,
		next: null,
		live: null,
		label: 'Live'
	});
	setContext(matchNavigationKey, registered);
	const nav = $derived(navigation ?? registered);
	let open = $state(false),
		mobile = $state(false);
	let trigger: HTMLButtonElement, closeButton: HTMLButtonElement;
	const id = $props.id();
	$effect(() => {
		if (mobile) open = waiting;
	});
	$effect(() => {
		if (onresult) open = false;
	});
	onMount(() => {
		const media = matchMedia('(max-width: 850px)');
		const update = () => {
			mobile = media.matches;
			if (!mobile) open = false;
		};
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});
	function close() {
		open = false;
		trigger?.focus();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}}
/>
{#if open && mobile}<button class="options-backdrop" aria-label="Close game options" onclick={close}
	></button>{/if}
<aside class="game-info match-sidebar" class:open {id} aria-label={label} inert={mobile && !open}>
	<div class="sheet-heading">
		<h2>{label}</h2>
		<button bind:this={closeButton} aria-label="Close options" onclick={close}
			><XIcon size={22} /></button
		>
	</div>
	{@render children()}
</aside>
{#if notice && !open}<button
		class="mobile-notice"
		onclick={() => {
			open = true;
		}}
		aria-live="polite">{notice}</button
	>{/if}
<nav class="mobile-game-controls" aria-label="Game controls">
	<button
		bind:this={trigger}
		aria-expanded={open}
		aria-controls={id}
		onclick={() => {
			open = !open;
			if (open) requestAnimationFrame(() => closeButton?.focus());
		}}><SlidersHorizontalIcon size={22} /><span>Options</span></button
	>
	{#if onresult}<button onclick={onresult}>Result</button>{/if}
	<button aria-label="Previous move" disabled={!nav.previous} onclick={() => nav.previous?.()}
		><CaretLeftIcon size={24} /><span>Back</span></button
	>
	<button onclick={() => nav.live?.()} disabled={!nav.live} aria-label="Return to live game"
		>{nav.label}</button
	>
	<button aria-label="Next move" disabled={!nav.next} onclick={() => nav.next?.()}
		><CaretRightIcon size={24} /><span>Forward</span></button
	>
</nav>

<style>
	.sheet-heading,
	.mobile-notice,
	.mobile-game-controls {
		display: none;
	}
	@media (max-width: 850px) {
		.mobile-notice {
			display: block;
			position: fixed;
			left: 8px;
			right: 8px;
			bottom: calc(72px + env(safe-area-inset-bottom));
			z-index: 43;
			padding: 8px 12px;
			border-radius: 8px;
			background: var(--surface-raised);
			color: var(--danger);
			font-size: 13px;
		}
		.match-sidebar {
			position: fixed;
			inset: auto 8px calc(76px + env(safe-area-inset-bottom));
			width: auto;
			max-height: calc(100dvh - 160px);
			overflow: auto;
			z-index: 41;
			padding: 20px;
			background: var(--surface);
			border: 1px solid var(--line);
			border-radius: var(--radius-panel);
			visibility: hidden;
			pointer-events: none;
		}
		.match-sidebar.open {
			visibility: visible;
			pointer-events: auto;
		}
		.sheet-heading {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.sheet-heading h2 {
			font-size: 18px;
		}
		.sheet-heading button {
			padding: 8px;
			cursor: pointer;
		}
		.options-backdrop {
			position: fixed;
			inset: 0;
			background: var(--overlay);
			z-index: 40;
		}
		.mobile-game-controls {
			display: flex;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 42;
			justify-content: space-evenly;
			padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
			background: var(--surface);
			border-top: 1px solid var(--line);
			gap: 4px;
		}
		.mobile-game-controls button {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-width: 48px;
			min-height: 48px;
			gap: 2px;
			padding: 4px 8px;
			border-radius: 8px;
			font-size: 12px;
			cursor: pointer;
		}
		.mobile-game-controls button:disabled {
			opacity: 0.4;
			cursor: default;
		}
		.mobile-game-controls button:hover:not(:disabled) {
			background: var(--surface-raised);
		}
	}
</style>
