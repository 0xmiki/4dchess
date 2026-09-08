<script lang="ts">
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import InspectionHint from './InspectionHint.svelte';
	import SoundControls from './SoundControls.svelte';
	import MotionControls from './MotionControls.svelte';
	const id = $props.id();
	let popup: HTMLDivElement, trigger: HTMLButtonElement;
	let open = $state(false),
		left = $state(0),
		top = $state(0);
	function toggle() {
		if (open) {
			popup.hidePopover();
			return;
		}
		const bounds = trigger.getBoundingClientRect();
		left = Math.max(12, Math.min(innerWidth - 292, bounds.right - 280));
		top = Math.max(12, Math.min(innerHeight - 360, bounds.bottom + 8));
		popup.showPopover();
	}
</script>

<button
	bind:this={trigger}
	class="controls-info"
	aria-label="Board controls"
	title="Board controls"
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls={id}
	onclick={toggle}><InfoIcon size={20} /></button
>
<div
	bind:this={popup}
	{id}
	popover
	role="dialog"
	aria-label="Board controls"
	ontoggle={(event) => {
		open = event.newState === 'open';
	}}
	style:left={`${left}px`}
	style:top={`${top}px`}
>
	<strong>Board controls</strong>
	<InspectionHint />
	<p>Drag the tesseract or use W A S D to rotate it. Home resets its view.</p>
	<p>Use ← and → to review moves.</p>
	<SoundControls />
	<MotionControls />
</div>

<style>
	.controls-info {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 6px;
		color: var(--muted);
		cursor: pointer;
	}
	.controls-info:hover,
	.controls-info:focus-visible {
		color: var(--text);
		background: var(--surface-raised);
	}
	[popover] {
		position: fixed;
		margin: 0;
		width: min(280px, calc(100vw - 24px));
		padding: var(--space-4);
		background: var(--surface-raised);
		color: var(--text);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		box-shadow: 0 8px 28px #0006;
		max-height: calc(100svh - 24px);
		overflow-y: auto;
		font-size: 13px;
	}
	p,
	[popover] :global(.inspection-hint) {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.5;
		margin-top: var(--space-3);
	}
</style>
