<script lang="ts">
	import { onMount } from 'svelte';
	import {
		initMotionPreferences,
		motionEnabled,
		systemReducedMotion
	} from '$lib/motion-preferences';
	const id = $props.id();
	onMount(initMotionPreferences);
</script>

<div class="motion-controls">
	<label
		><input
			type="checkbox"
			checked={$motionEnabled && !$systemReducedMotion}
			disabled={$systemReducedMotion}
			aria-describedby={id}
			onchange={(event) => motionEnabled.set(event.currentTarget.checked)}
		/> Motion effects</label
	>
	<p {id}>
		{$systemReducedMotion
			? 'Off because your system prefers reduced motion.'
			: 'Turn off for instant moves and no decorative motion.'}
	</p>
</div>

<style>
	.motion-controls {
		margin-top: 14px;
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	input {
		appearance: auto;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		accent-color: var(--game-primary);
	}
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.4;
		margin: 6px 0 0;
	}
</style>
