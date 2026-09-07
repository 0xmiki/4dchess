<script lang="ts" generics="T extends string">
	import { onMount } from 'svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	let {
		label,
		hideLabel = false,
		value = $bindable(),
		options,
		disabled = false,
		onchange
	}: {
		label: string;
		hideLabel?: boolean;
		value: T;
		options: readonly { value: T; label: string }[];
		disabled?: boolean;
		onchange?: () => void;
	} = $props();
	const id = $props.id();
	let trigger: HTMLButtonElement, popup: HTMLDivElement;
	let ready = $state(false),
		open = $state(false),
		active = $state(0),
		left = $state(0),
		top = $state(0),
		width = $state(0),
		maxHeight = $state(260);
	let typed = '',
		typedAt = 0;
	onMount(() => {
		ready = true;
	});
	function close() {
		popup?.hidePopover();
		open = false;
	}
	function reveal() {
		if (disabled || !ready) return;
		const r = trigger.getBoundingClientRect();
		left = r.left;
		width = r.width;
		const below = innerHeight - r.bottom - 12;
		maxHeight = Math.min(260, Math.max(below, r.top - 12));
		top =
			below >= Math.min(260, options.length * 40 + 8)
				? r.bottom + 6
				: Math.max(6, r.top - Math.min(maxHeight, options.length * 40 + 8) - 6);
		active = Math.max(
			0,
			options.findIndex((o) => o.value === value)
		);
		popup.showPopover();
		open = true;
	}
	function choose(index: number) {
		const option = options[index];
		if (!option) return;
		value = option.value;
		onchange?.();
		close();
		trigger.focus();
	}
	function key(event: KeyboardEvent) {
		if (event.key === 'Tab') {
			close();
			return;
		}
		if (event.key === 'Escape') {
			close();
			return;
		}
		if (['Enter', ' '].includes(event.key)) {
			event.preventDefault();
			if (open) choose(active);
			else reveal();
			return;
		}
		if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
			event.preventDefault();
			if (!open) {
				reveal();
				return;
			}
			active =
				event.key === 'Home'
					? 0
					: event.key === 'End'
						? options.length - 1
						: (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
			popup
				.querySelector(`#${CSS.escape(id + '-' + active)}`)
				?.scrollIntoView({ block: 'nearest' });
			return;
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
			if (!open) reveal();
			const now = Date.now();
			typed = now - typedAt < 600 ? typed + event.key : event.key;
			typedAt = now;
			const index = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.toLowerCase()));
			if (index >= 0) active = index;
		}
	}
</script>

<svelte:window onresize={close} onscroll={close} />
<div class="select-field">
	<span id={id + '-label'} class:sr-only={hideLabel}>{label}</span><button
		bind:this={trigger}
		role="combobox"
		aria-labelledby={id + '-label'}
		aria-controls={id + '-list'}
		aria-expanded={open}
		aria-haspopup="listbox"
		aria-activedescendant={open ? id + '-' + active : undefined}
		disabled={disabled || !ready}
		onclick={() => (open ? close() : reveal())}
		onkeydown={key}
		><span>{options.find((o) => o.value === value)?.label ?? ''}</span><CaretDownIcon
			size={16}
			aria-hidden="true"
		/></button
	>
</div>
<div
	bind:this={popup}
	id={id + '-list'}
	class="select-options"
	role="listbox"
	aria-labelledby={id + '-label'}
	popover="auto"
	ontoggle={() => {
		open = popup.matches(':popover-open');
	}}
	style={`left:${left}px;top:${top}px;width:${width}px;max-height:${maxHeight}px`}
>
	{#each options as option, i (option.value)}<button
			id={id + '-' + i}
			type="button"
			role="option"
			aria-selected={option.value === value}
			class:active={active === i}
			tabindex="-1"
			onclick={() => choose(i)}
			>{option.label}{#if option.value === value}<CheckIcon
					size={16}
					aria-hidden="true"
				/>{/if}</button
		>{/each}
</div>

<style>
	.select-field {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.select-field > span {
		font-size: 14px;
	}
	.select-field > button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: var(--control-height);
		padding: 10px 14px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}
	.select-field > button:hover,
	.select-field > button[aria-expanded='true'] {
		background: var(--surface-raised);
	}
	.select-field > button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.select-options {
		position: fixed;
		margin: 0;
		padding: 4px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		box-shadow: 0 8px 24px #0005;
		overflow: auto;
		color: var(--text);
	}
	.select-options > button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 40px;
		padding: 8px 10px;
		gap: 12px;
		border-radius: 7px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		font-size: 14px;
	}
	.select-options > button:hover,
	.select-options > button.active {
		background: var(--surface-raised);
	}
</style>
