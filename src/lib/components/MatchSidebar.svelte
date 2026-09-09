<script lang="ts">
	import { onMount, tick, setContext, type Snippet } from 'svelte';
	import { matchNavigationKey, type MatchNavigation } from '$lib/match-navigation';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
	import SkipForwardIcon from 'phosphor-svelte/lib/SkipForwardIcon';
	let {
		children,
		navigation,
		chat,
		chatOpen = $bindable(false),
		chatUnread = false,
		label = 'Game options',
		waiting = false,
		finished = false,
		fullHeight = false,
		onchatvisibilitychange,
		notice = ''
	}: {
		children: Snippet;
		navigation?: MatchNavigation;
		chat?: Snippet<[(() => void)?]>;
		chatOpen?: boolean;
		chatUnread?: boolean;
		label?: string;
		waiting?: boolean;
		finished?: boolean;
		fullHeight?: boolean;
		onchatvisibilitychange?: (visible: boolean) => void;
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
	let chatTrigger = $state<HTMLButtonElement>();
	let chatDialog = $state<HTMLDialogElement>();
	let mobileChatOpen = $state(false),
		viewportHeight = $state(0),
		viewportTop = $state(0);
	async function showChat() {
		open = false;
		mobileChatOpen = true;
		await tick();
		chatDialog?.showModal();
		chatDialog?.querySelector<HTMLButtonElement>('[aria-label="Close chat"]')?.focus();
	}
	$effect(() => {
		if (!mobileChatOpen) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
	const id = $props.id();
	$effect(() => {
		onchatvisibilitychange?.(mobile ? mobileChatOpen : chatOpen);
	});
	$effect(() => {
		if (mobile) open = waiting;
	});
	$effect(() => {
		if (finished) open = false;
	});

	onMount(() => {
		const media = matchMedia('(max-width: 850px)');
		const update = () => {
			mobile = media.matches;
			if (!mobile) {
				open = false;
				chatDialog?.close();
			} else chatOpen = false;
		};
		const viewport = window.visualViewport;
		const resizeChat = () => {
			viewportHeight = viewport?.height ?? innerHeight;
			viewportTop = viewport?.offsetTop ?? 0;
		};
		resizeChat();
		viewport?.addEventListener('resize', resizeChat);
		viewport?.addEventListener('scroll', resizeChat);
		update();
		media.addEventListener('change', update);
		return () => {
			media.removeEventListener('change', update);
			viewport?.removeEventListener('resize', resizeChat);
			viewport?.removeEventListener('scroll', resizeChat);
		};
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
<aside
	class="game-info match-sidebar"
	class:open
	class:full-height={fullHeight && !mobile}
	{id}
	aria-label={label}
	inert={mobile && !open}
>
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
	{#if chat}<button
			bind:this={chatTrigger}
			class="mobile-chat-trigger"
			aria-label={chatUnread ? 'Open chat, unread messages' : 'Open chat'}
			aria-expanded={mobileChatOpen}
			aria-controls={id + '-chat'}
			onclick={showChat}
			><span class="chat-icon"
				><ChatCircleIcon size={22} />{#if chatUnread}<span class="unread-dot" aria-hidden="true"
					></span>{/if}</span
			><span>Chat</span></button
		>{/if}
	<button aria-label="Previous move" disabled={!nav.previous} onclick={() => nav.previous?.()}
		><CaretLeftIcon size={24} /><span>Back</span></button
	>
	{#if nav.live}<button
			onclick={() => nav.live?.()}
			aria-label="Return to live game"
			title="Return to current position"><SkipForwardIcon size={22} /></button
		>{/if}
	<button aria-label="Next move" disabled={!nav.next} onclick={() => nav.next?.()}
		><CaretRightIcon size={24} /><span>Forward</span></button
	>
</nav>

{#if chat}<dialog
		bind:this={chatDialog}
		id={id + '-chat'}
		class="mobile-chat"
		aria-label="Player chat"
		style:height={viewportHeight ? viewportHeight + 'px' : undefined}
		style:top={viewportTop + 'px'}
		onclose={() => {
			mobileChatOpen = false;
			chatTrigger?.focus();
		}}
	>
		<div class="mobile-chat-content">
			{#if mobileChatOpen}{@render chat(() => chatDialog?.close())}{/if}
		</div>
	</dialog>{/if}

<style>
	.mobile-chat {
		position: fixed;
		margin: 0;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100dvh;
		max-height: none;
		padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
		border: 0;
		border-radius: 0;
		background: var(--page);
		color: var(--text);
		overflow: hidden;
	}
	.mobile-chat[open] {
		display: flex;
		flex-direction: column;
	}
	.mobile-chat-content {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.chat-icon {
		position: relative;
		display: flex;
	}
	.unread-dot {
		position: absolute;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ef5350;
		top: -2px;
		right: -3px;
		box-shadow: 0 0 0 2px var(--surface);
	}

	.match-sidebar.full-height {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - max(var(--play-space), 72px) - var(--match-bottom-space));
		min-height: 0;
	}
	.full-height > :global(*) {
		flex-shrink: 0;
	}
	.full-height > :global(.chat-panel) {
		flex: 1;
		min-height: 0;
	}

	.sheet-heading,
	.mobile-notice,
	.mobile-game-controls {
		display: none;
	}
	@media (max-width: 850px) {
		.match-sidebar.full-height {
			height: calc(100dvh - 84px - env(safe-area-inset-bottom));
			max-height: calc(100dvh - 84px - env(safe-area-inset-bottom));
		}

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
