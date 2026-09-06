<script lang="ts">
	let {
		value = $bindable('white'),
		label = 'Your side',
		disabled = false,
		onchange
	}: {
		value?: 'white' | 'black';
		label?: string;
		disabled?: boolean;
		onchange?: () => void;
	} = $props();
	const group = $props.id();
</script>

<fieldset {disabled} class="side-toggle">
	<legend>{label}</legend>
	<div>
		{#each ['white', 'black'] as side (side)}<label
				><input
					type="radio"
					name={group}
					value={side}
					checked={value === side}
					onchange={() => {
						value = side as 'white' | 'black';
						onchange?.();
					}}
				/><span class:black={side === 'black'}></span>{side === 'white' ? 'White' : 'Black'}</label
			>{/each}
	</div>
</fieldset>

<style>
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
		display: flex;
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
	label:has(:checked) {
		background: var(--line);
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
	fieldset:disabled {
		opacity: 0.5;
	}
</style>
