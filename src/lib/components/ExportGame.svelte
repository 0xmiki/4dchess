<script lang="ts">
	import { onMount } from 'svelte';
	import { exportGame, type ExportResult } from '$lib/chess/export';
	import type { Move } from '$lib/chess';
	import Button from './Button.svelte';
	let {
		load
	}: {
		load: () =>
			| Promise<{
					moves: readonly Move[];
					result: ExportResult;
					date?: number;
					white?: string;
					black?: string;
			  }>
			| {
					moves: readonly Move[];
					result: ExportResult;
					date?: number;
					white?: string;
					black?: string;
			  };
	} = $props();
	let text = $state(''),
		busy = $state(true),
		error = $state(''),
		copied = $state(false);
	async function prepare() {
		busy = true;
		error = '';
		try {
			const game = await load();
			text = exportGame(game.moves, { ...game, site: location.origin });
		} catch {
			error = 'Could not export the complete game. Please retry.';
		} finally {
			busy = false;
		}
	}
	onMount(() => {
		void prepare();
	});
	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			error = 'Select and copy the notation below.';
		}
	}
	function download() {
		const url = URL.createObjectURL(
			new Blob([text], { type: 'application/x-chess-pgn;charset=utf-8' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = '4d-chess.pgn';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<div class="stack">
	{#if busy}<p role="status">Preparing game export…</p>
	{:else if text}<div class="row">
			<Button variant="primary" onclick={download}>Download PGN</Button><Button onclick={copy}
				>{copied ? 'Copied' : 'Copy PGN'}</Button
			>
		</div>
		<textarea
			aria-label="4D PGN notation"
			readonly
			value={text}
			rows="8"
			onclick={(e) => e.currentTarget.select()}></textarea>{/if}
	{#if error}<p class="error" role="alert">{error}</p>
		<Button onclick={prepare}>Retry export</Button>{/if}
</div>

<style>
	textarea {
		width: 100%;
		min-width: min(420px, 65vw);
		font:
			12px/1.6 ui-monospace,
			monospace;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--surface);
		color: inherit;
		padding: 12px;
	}
</style>
