<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, children, onclose }: { title: string; children: Snippet; onclose?: () => void } =
		$props();
	let dialog: HTMLDialogElement;
	export function showModal() {
		dialog.showModal();
	}
	export function close() {
		dialog.close();
	}
</script>

<dialog bind:this={dialog} aria-label={title} {onclose}>
	<h2>{title}</h2>
	{@render children()}
</dialog>

<style>
	dialog {
		margin: auto;
		max-width: min(620px, calc(100% - 32px));
		max-height: calc(100dvh - 48px);
		border: 1px solid #ccd3c8;
		border-radius: 8px;
		background: #fafbf9;
		color: #24342b;
		padding: 24px;
	}
	dialog::backdrop {
		background: #14251b66;
	}
	h2 {
		margin-bottom: 16px;
	}
	dialog :global(p) {
		margin-bottom: 16px;
	}
</style>
