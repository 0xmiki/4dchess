<script lang="ts">
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import CpuIcon from 'phosphor-svelte/lib/CpuIcon';
	import ShuffleIcon from 'phosphor-svelte/lib/ShuffleIcon';
	let {
		mode,
		onclick,
		disabled = false,
		busy = false,
		primary,
		description
	}: {
		mode: 'friend' | 'computer' | 'matchmaking';
		primary?: boolean;
		description?: string;
		onclick: () => void;
		disabled?: boolean;
		busy?: boolean;
	} = $props();
	const friend = $derived(mode === 'friend');
	const title = $derived(
		friend ? 'Play with friend' : mode === 'computer' ? 'Play computer' : 'Find opponent'
	);
</script>

<div class="play-option" class:primary={primary ?? friend}>
	<Button
		variant={(primary ?? friend) ? 'primary' : 'default'}
		{onclick}
		disabled={disabled || busy}
		aria-busy={busy}
		aria-label={title}
	>
		<span class="mode-icon" aria-hidden="true"
			>{#if busy}<Spinner label="Loading" />{:else if friend}<UsersIcon
					size={28}
					weight="fill"
				/>{:else if mode === 'matchmaking'}<ShuffleIcon size={28} />{:else}<CpuIcon
					size={28}
					weight="duotone"
				/>{/if}</span
		>
		<span class="copy"
			><strong>{title}</strong><span
				>{description ??
					(friend
						? 'Share a link.'
						: mode === 'computer'
							? 'With four difficulty levels.'
							: 'Play someone online.')}</span
			></span
		>
	</Button>
</div>

<style>
	.play-option :global(button) {
		width: 100%;
		min-height: 84px;
		justify-content: flex-start;
		padding: var(--space-4) var(--space-5);
		gap: var(--space-4);
		border-radius: var(--radius-panel);
		text-align: left;
	}
	.copy {
		display: grid;
		gap: var(--space-1);
	}
	strong {
		font-size: 18px;
		font-weight: 700;
		line-height: 1.35;
		letter-spacing: 0;
	}
	.copy > span {
		font-size: 13px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--muted);
	}
	.primary .copy > span {
		color: var(--on-accent);
	}
	.mode-icon {
		display: flex;
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		align-items: center;
		justify-content: center;
	}
	@media (max-width: 600px) {
		.play-option :global(button) {
			min-height: 80px;
			padding: var(--space-4);
		}
		.copy > span {
			font-size: 13px;
		}
	}
</style>
