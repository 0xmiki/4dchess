<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		children,
		onclose,
		dismissOnBackdrop = false
	}: {
		title: string;
		children: Snippet;
		onclose?: () => void;
		dismissOnBackdrop?: boolean;
	} = $props();
	let dialog: HTMLDialogElement;
	let beganOutside = false;
	function outside(event: PointerEvent) {
		const r = dialog.getBoundingClientRect();
		return (
			event.target === dialog &&
			(event.clientX < r.left ||
				event.clientX > r.right ||
				event.clientY < r.top ||
				event.clientY > r.bottom)
		);
	}
	export function showModal() {
		dialog.showModal();
	}
	export function close() {
		dialog.close();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	{onclose}
	onpointerdown={(event) => {
		beganOutside = outside(event);
	}}
	onpointerup={(event) => {
		if (dismissOnBackdrop && beganOutside && outside(event)) close();
		beganOutside = false;
	}}
>
	<h2>{title}</h2>
	{@render children()}
</dialog>

<style>
	dialog {
		margin: auto;
		max-width: min(620px, calc(100% - 32px));
		max-height: calc(100dvh - 48px);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
		color: var(--text);
		padding: var(--space-5);
	}
	dialog::backdrop {
		background: var(--overlay);
	}
	h2 {
		margin-bottom: 16px;
	}
	dialog :global(p) {
		margin-bottom: 16px;
	}
</style>
