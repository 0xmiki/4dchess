<script lang="ts" generics="T extends 'white' | 'black' | 'random'">
	let {
		value = $bindable('white' as T),
		allowRandom = false,
		iconOnly = false,
		label = 'Your side',
		disabled = false,
		onchange
	}: {
		value?: T;
		allowRandom?: boolean;
		iconOnly?: boolean;
		label?: string;
		disabled?: boolean;
		onchange?: () => void;
	} = $props();
	const group = $props.id();
	const sides = $derived(allowRandom ? ['random', 'white', 'black'] : ['white', 'black']);
</script>

<fieldset {disabled} class="side-toggle">
	<legend class:hidden-label={label === 'Your side'}>{label}</legend>
	<div
		class="pill-rail"
		class:with-random={allowRandom}
		class:icon-only={iconOnly}
		style:--pill-count={sides.length}
		style:--pill-index={sides.indexOf(value)}
	>
		{#each sides as side (side)}{@const name =
				side === 'random' ? 'Random' : side === 'white' ? 'White' : 'Black'}<label
				title={iconOnly ? name : undefined}
				><input
					type="radio"
					name={group}
					value={side}
					aria-label={name}
					checked={value === side}
					onchange={() => {
						value = side as T;
						onchange?.();
					}}
				/><span aria-hidden="true" class:black={side === 'black'} class:random={side === 'random'}
				></span>{#if !iconOnly}{name}{/if}</label
			>{/each}
	</div>
</fieldset>

<style>
	.hidden-label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	fieldset {
		border: 0;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-width: 0;
	}
	legend {
		float: left;
		font-size: 14px;
		color: var(--muted);
	}
	fieldset > div {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--pill-count, 2), 1fr);
		width: 184px;
		padding: var(--space-1);
		background: var(--surface);
		border-radius: var(--radius-control);
		border: 1px solid var(--line);
	}
	label {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
	}
	fieldset > div.with-random {
		width: 280px;
	}
	fieldset > div.icon-only {
		width: calc(var(--pill-count) * 40px + 10px);
	}
	.icon-only label {
		justify-content: center;
		min-height: 36px;
		padding: var(--space-2);
	}
	.icon-only span {
		width: 18px;
		height: 18px;
	}
	label:has(:checked) {
		color: var(--text);
	}
	input {
		position: absolute;
		opacity: 0;
		width: 1px;
	}
	label:has(:focus-visible) {
		background: var(--line-strong);
	}
	span {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--piece-white);
		border: 1px solid var(--line-strong);
	}
	span.black {
		background: var(--piece-black);
	}
	span.random {
		background: linear-gradient(90deg, var(--piece-white) 50%, var(--piece-black) 50%);
	}
	fieldset:disabled {
		opacity: 0.5;
	}
</style>
