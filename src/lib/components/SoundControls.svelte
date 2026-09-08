<script lang="ts">
	import { onMount } from 'svelte';
	import { gameSounds, soundSettings } from '$lib/audio/game-sounds';
	const id = $props.id();
	onMount(() => gameSounds.init());
	function toggle() {
		soundSettings.update((s) => ({ ...s, enabled: !s.enabled }));
		if ($soundSettings.enabled) {
			void gameSounds.unlock();
			gameSounds.prepare();
		}
	}
</script>

<div class="sound-controls">
	<button
		type="button"
		onclick={toggle}
		aria-pressed={$soundSettings.enabled}
		aria-label={$soundSettings.enabled ? 'Mute game sounds' : 'Enable game sounds'}
		>Sound {$soundSettings.enabled ? 'on' : 'off'}</button
	>
	<label for={id}>Volume</label><input
		{id}
		type="range"
		min="0"
		max="100"
		step="5"
		value={$soundSettings.volume * 100}
		oninput={(e) =>
			soundSettings.update((s) => ({ ...s, volume: Number(e.currentTarget.value) / 100 }))}
	/>
</div>

<style>
	.sound-controls {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 12px;
	}
	button {
		padding: 6px 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}
	label {
		font-size: 12px;
		color: var(--muted);
	}
	input {
		width: 90px;
		accent-color: var(--game-primary);
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
</style>
