<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import { errorMessage } from '$lib/multiplayer';
	import PaperPlaneTiltIcon from 'phosphor-svelte/lib/PaperPlaneTiltIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	let {
		roomId,
		opponentName,
		online,
		chat,
		onclose
	}: {
		roomId: Id<'games'>;
		opponentName: string;
		online: boolean;
		onclose?: () => void;
		chat: { data?: FunctionReturnType<typeof api.chat.list>; error?: unknown };
	} = $props();
	let menu: HTMLDetailsElement;
	let composerInput: HTMLTextAreaElement;
	const client = useConvexClient();
	let draft = $state(''),
		sending = $state(false),
		error = $state(''),
		muting = $state(false);
	let now = $state(Date.now()),
		log: HTMLDivElement,
		stick = $state(true);
	let retry: { text: string; requestId: string } | null = null;
	const canSend = $derived(
		chat.data?.canSend && (chat.data.closesAt === null || chat.data.closesAt > now)
	);
	const visible = $derived(chat.data?.messages.filter((m) => m.expiresAt > now) ?? []);
	onMount(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		const count = visible.length;
		if (count && stick)
			void tick().then(() => {
				if (log) log.scrollTop = log.scrollHeight;
			});
	});
	$effect(() => {
		void draft;
		void tick().then(() => {
			if (composerInput) {
				composerInput.style.height = 'auto';
				composerInput.style.height = Math.min(120, composerInput.scrollHeight) + 'px';
			}
		});
	});
	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (sending || !draft.trim() || !online || chat.data?.paused || !canSend) return;
		const text = draft.trim();
		if (!retry || retry.text !== text) retry = { text, requestId: crypto.randomUUID() };
		sending = true;
		error = '';
		try {
			await client.mutation(api.chat.send, { roomId, ...retry });
			if (draft.trim() === text) draft = '';
			retry = null;
			stick = true;
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			sending = false;
		}
	}
	function dismissMenu(event: KeyboardEvent) {
		if (event.key === 'Escape' && menu?.open) {
			event.preventDefault();
			event.stopPropagation();
			menu.open = false;
			menu.querySelector('summary')?.focus();
		}
	}
	async function mute() {
		if (menu) menu.open = false;
		muting = true;
		error = '';
		try {
			await client.mutation(api.chat.setMuted, { roomId, muted: !chat.data?.muted });
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			muting = false;
		}
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (menu?.open && !event.composedPath().includes(menu)) menu.open = false;
	}}
/>
<section class="room-chat" class:standalone={!!onclose} aria-label="Player chat">
	<header>
		<span class="recipient" title={opponentName}>{opponentName}</span>
		<div class="chat-header-actions">
			<details
				class="chat-options"
				bind:this={menu}
				onfocusout={(event) => {
					if (!menu.contains(event.relatedTarget as Node)) menu.open = false;
				}}
			>
				<summary onkeydown={dismissMenu} aria-label="Chat options" title="Chat options"
					><DotsThreeIcon size={22} /></summary
				>
				<div class="options-menu">
					<button
						onkeydown={dismissMenu}
						type="button"
						onclick={mute}
						disabled={!chat.data || muting || !online}
						>{chat.data?.muted ? 'Unmute chat' : 'Mute chat'}</button
					>
				</div>
			</details>
			{#if onclose}<button class="close-chat" aria-label="Close chat" onclick={onclose}
					><XIcon size={22} /></button
				>{/if}
		</div>
	</header>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable history must be keyboard accessible.) -->
	<div
		class="chat-log"
		bind:this={log}
		role="log"
		aria-label="Chat messages"
		aria-live="polite"
		aria-relevant="additions"
		tabindex="0"
		onscroll={() => {
			stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
		}}
	>
		{#if chat.error}<p class="chat-note" role="alert">{errorMessage(chat.error)}</p>
		{:else if !chat.data}<p class="chat-note" role="status">Loading chat…</p>
		{:else if !chat.data.muted}
			{#each visible as message, i (message.id)}
				<div
					class="message"
					class:mine={message.mine}
					class:group-start={i === 0 || visible[i - 1].mine !== message.mine}
				>
					<span class="sr-only">{message.mine ? 'You' : opponentName}: </span>
					<p>{message.text}</p>
				</div>
			{/each}
		{/if}
	</div>
	{#if chat.data?.muted}<div class="chat-state">
			<span>Chat muted</span><button type="button" onclick={mute} disabled={muting || !online}
				>Unmute</button
			>
		</div>
	{:else if chat.data?.paused}<p class="chat-note" role="status">Your opponent muted chat.</p>
	{:else if !online}<p class="chat-note" role="status">Reconnecting…</p>
	{:else if chat.data && !canSend}<p class="chat-note" role="status">
			{chat.data.closesAt === null ? 'Waiting for your opponent' : 'Chat closed'}
		</p>{/if}
	<form onsubmit={send}>
		<div class="composer">
			<textarea
				bind:this={composerInput}
				aria-label="Chat message"
				placeholder="Message"
				bind:value={draft}
				maxlength={500}
				rows="1"
				disabled={!canSend || chat.data?.paused || !online}
				onkeydown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
						event.preventDefault();
						event.currentTarget.form?.requestSubmit();
					}
				}}></textarea>
			<button
				class="send-chat"
				type="submit"
				aria-label={sending ? 'Sending message' : 'Send message'}
				title="Send message"
				disabled={sending || !draft.trim() || !canSend || chat.data?.paused || !online}
			>
				{#if sending}<CircleNotchIcon size={19} />{:else}<PaperPlaneTiltIcon size={19} />{/if}
			</button>
		</div>
		{#if draft.length >= 450}<span class="character-count">{draft.length}/500</span>{/if}
	</form>
	{#if error}<p class="chat-error" role="alert">{error}</p>{/if}
</section>

<style>
	.room-chat {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		border-top: 1px solid var(--line);
		gap: 8px;
		font-size: 13px;
	}
	.room-chat.standalone {
		border-top: 0;
	}
	.standalone header {
		padding-top: 0;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-top: 8px;
	}
	.recipient {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
	}
	button,
	summary {
		cursor: pointer;
		color: var(--muted);
		border-radius: 6px;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	button:hover:not(:disabled),
	summary:hover {
		color: var(--text);
		background: var(--surface-raised);
	}
	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--focus) !important;
		outline-offset: 2px;
	}
	.chat-options {
		position: relative;
		flex-shrink: 0;
	}
	summary {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.options-menu {
		position: absolute;
		right: 0;
		top: 100%;
		min-width: 140px;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		z-index: 2;
	}
	.options-menu button {
		width: 100%;
		min-height: 40px;
		padding: 8px 12px;
		text-align: left;
		font-size: 13px;
	}
	.chat-log {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
	}
	.chat-log:focus-visible {
		outline: 1px solid var(--line-strong) !important;
		outline-offset: 2px;
	}
	.message {
		width: fit-content;
		max-width: 88%;
		padding: 6px 9px;
		margin: 3px auto 0 0;
		border: 1px solid var(--line);
		border-radius: 10px 10px 10px 3px;
		background: var(--surface);
		overflow-wrap: anywhere;
	}
	.message.mine {
		margin-left: auto;
		margin-right: 0;
		border-color: transparent;
		border-radius: 10px 10px 3px 10px;
		background: var(--surface-raised);
	}
	.message.group-start:not(:first-child) {
		margin-top: 8px;
	}
	.chat-header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.close-chat {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
	}

	.message p {
		margin: 0;
		line-height: 1.6;
		white-space: pre-wrap;
	}
	form {
		flex-shrink: 0;
	}
	.composer {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--surface);
	}
	.composer:focus-within {
		border-color: var(--line-strong);
	}
	textarea {
		min-height: calc(1.5em + 14px);
		flex: 1;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		resize: none;
		border: 0;
		border-radius: 0;
		padding: 7px;
		background: transparent;
		color: var(--text);
		font: inherit;
		line-height: 1.5;
		box-shadow: none;
	}
	textarea::placeholder {
		color: var(--muted);
	}
	textarea:focus {
		outline: none;
		box-shadow: none;
	}
	.send-chat {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		background: var(--surface-raised);
	}
	.character-count {
		display: block;
		margin-top: 4px;
		text-align: right;
		color: var(--muted);
		font-size: 11px;
	}
	.chat-note,
	.chat-state {
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}
	.chat-state {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.chat-state button {
		padding: 8px;
		min-height: 36px;
	}
	.chat-error {
		font-size: 12px;
		color: var(--danger);
	}
	@media (max-width: 850px) {
		summary,
		.send-chat {
			width: 44px;
			height: 44px;
		}
		textarea {
			font-size: 16px;
		}
	}
</style>
