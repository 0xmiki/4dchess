<script lang="ts">
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import CpuIcon from 'phosphor-svelte/lib/CpuIcon';
	import ShuffleIcon from 'phosphor-svelte/lib/ShuffleIcon';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
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
			>{#if friend}<UsersIcon
					size={30}
					weight="fill"
				/>{:else if mode === 'matchmaking'}<ShuffleIcon size={30} />{:else}<CpuIcon
					size={30}
					weight="duotone"
				/>{/if}</span
		>
		<span class="copy"
			><strong>{title}</strong><span
				>{description ??
					(friend
						? 'Share a link. No account needed.'
						: mode === 'computer'
							? 'Four difficulty levels. Untimed.'
							: 'Play someone online. Random side.')}</span
			></span
		>
		<span class="arrow" aria-hidden="true"
			>{#if busy}<Spinner label="Creating invitation" />{:else}<ArrowRightIcon
					size={20}
					weight="bold"
				/>{/if}</span
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
		font-size: 20px;
		line-height: 1.2;
		letter-spacing: -0.025em;
	}
	.copy > span {
		font-size: 14px;
		font-weight: 450;
		color: var(--muted);
	}
	.primary .copy > span {
		color: var(--on-accent);
	}
	.mode-icon {
		display: flex;
		flex-shrink: 0;
	}
	.arrow {
		margin-left: auto;
		font-size: 26px;
	}
	@media (max-width: 600px) {
		.play-option :global(button) {
			min-height: 80px;
			padding: var(--space-4);
		}
		strong {
			font-size: 20px;
		}
		.copy > span {
			font-size: 13px;
		}
	}
</style>
