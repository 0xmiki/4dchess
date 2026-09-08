<script lang="ts">
	import { type Snippet } from 'svelte';
	import type { ExportResult } from '$lib/chess/export';
	import GameOutcome from './GameOutcome.svelte';
	import WinFireworks from './WinFireworks.svelte';
	import { motionAllowed } from '$lib/motion-preferences';
	import { isUnscoredResult } from '$lib/online/outcomes';
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
	let celebrating = $state(false);
	let previous: { gameKey: string; finished: boolean } | null = null;
	$effect(() => {
		const key = result && result.reason !== 'cancellation' ? gameKey : null;
		const wasActive = previous?.gameKey === gameKey && !previous.finished;
		previous = { gameKey, finished: !!result };
		if (!$motionAllowed || spectator || isUnscoredResult(result) || result?.winner !== side)
			celebrating = false;
		if (!key) {
			dialog?.close();
			shown = null;
			celebrating = false;
		} else if (key !== shown && dialog) {
			shown = key;
			if (dialog.open) dialog.close();
			dialog.showModal();
			celebrating =
				$motionAllowed &&
				wasActive &&
				!spectator &&
				!isUnscoredResult(result) &&
				result?.winner === side;
		}
	});
	export function show() {
		if (result && !dialog.open) dialog.showModal();
	}
</script>

<dialog
	bind:this={dialog}
	class="result-dialog"
	class:motion-off={!$motionAllowed}
	aria-label="Game result"
	onclose={() => {
		if (!dialog.open) celebrating = false;
	}}
>
	<button class="close-result" aria-label="Close result" onclick={() => dialog.close()}
		><XIcon size={22} /></button
	>
	<GameOutcome {result} {side} {spectator} />
	<div class="result-actions">{@render children?.()}</div>
</dialog>
{#if celebrating}<WinFireworks
		exclusion={() => dialog?.getBoundingClientRect()}
		ondone={() => {
			celebrating = false;
		}}
	/>{/if}

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
	.result-dialog[open] {
		animation: result-enter 480ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.result-dialog[open]::backdrop {
		animation: result-backdrop 280ms ease-out;
	}
	@keyframes result-enter {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes result-backdrop {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.result-dialog[open],
		.result-dialog[open]::backdrop {
			animation: none;
		}
	}
	.result-dialog.motion-off[open],
	.result-dialog.motion-off[open]::backdrop {
		animation: none;
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
