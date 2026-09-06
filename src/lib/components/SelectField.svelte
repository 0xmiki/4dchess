<script lang="ts" generics="T extends string">
	let {
		label,
		value = $bindable(),
		options,
		disabled = false,
		onchange
	}: {
		label: string;
		value: T;
		options: readonly { value: T; label: string }[];
		disabled?: boolean;
		onchange?: () => void;
	} = $props();
</script>

<label
	>{label}<select bind:value {disabled} {onchange}
		>{#each options as option (option.value)}<option value={option.value}>{option.label}</option
			>{/each}</select
	></label
>

<style>
	select {
		min-height: var(--control-height);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		padding: var(--space-3) var(--space-4);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}
	label {
		display: grid;
		gap: 6px;
	}
</style>
