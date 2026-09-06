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
		min-height: 42px;
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		padding: 9px 14px;
		background: #fff;
		color: inherit;
		cursor: pointer;
	}
	label {
		display: grid;
		gap: 6px;
	}
</style>
