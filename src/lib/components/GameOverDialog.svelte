<script lang="ts">
	import { type Snippet } from 'svelte';
	import type { ExportResult } from '$lib/chess/export';
	import GameOutcome from './GameOutcome.svelte';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	let {
		result,
		side,
		gameKey,
		children,
		spectator = false
	}: {
		result: ExportResult;
		side: 'white' | 'black';
		gameKey: string;
		children?: Snippet;
		spectator?: boolean;
	} = $props();
	let dialog: HTMLDialogElement;
	let shown: string | null = null;
	$effect(() => {
		const key = result && result.reason !== 'cancellation' ? gameKey : null;
		if (!key) {
			dialog?.close();
			shown = null;
		} else if (key !== shown && dialog) {
			shown = key;
			dialog.showModal();
		}
	});
	export function show() {
		if (result) dialog.showModal();
	}
</script>

<dialog bind:this={dialog} class="result-dialog" aria-label="Game result">
	<button class="close-result" aria-label="Close result" onclick={() => dialog.close()}
		><XIcon size={22} /></button
	>
	<GameOutcome {result} {side} {spectator} />
	<div class="result-actions">{@render children?.()}</div>
</dialog>

<style>
	.result-dialog {
		margin: auto;
		width: min(380px, calc(100% - 32px));
		max-height: calc(100dvh - 40px);
		overflow: auto;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		padding: 32px 24px 20px;
	}
	.result-dialog::backdrop {
		background: var(--overlay);
	}
	.close-result {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 8px;
		cursor: pointer;
		color: var(--muted);
	}
	.result-dialog :global(.game-outcome) {
		background: none;
		padding: 8px 0 24px;
		text-align: center;
		justify-items: center;
	}
	.result-actions {
		display: grid;
		gap: 12px;
	}
</style>
