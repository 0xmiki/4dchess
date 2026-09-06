<script lang="ts">
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import CpuIcon from 'phosphor-svelte/lib/CpuIcon';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	let {
		mode,
		onclick,
		disabled = false,
		busy = false
	}: {
		mode: 'friend' | 'computer';
		onclick: () => void;
		disabled?: boolean;
		busy?: boolean;
	} = $props();
	const friend = $derived(mode === 'friend');
</script>

<div class="play-option" class:friend>
	<Button
		variant={friend ? 'primary' : 'default'}
		{onclick}
		disabled={disabled || busy}
		aria-busy={busy}
		aria-label={friend ? 'Play with friend' : 'Play computer'}
	>
		<span class="mode-icon" aria-hidden="true"
			>{#if friend}<UsersIcon size={30} weight="fill" />{:else}<CpuIcon
					size={30}
					weight="duotone"
				/>{/if}</span
		>
		<span class="copy"
			><strong>{friend ? 'Play with friend' : 'Play computer'}</strong><span
				>{friend ? 'Share a link. No account needed.' : 'Choose from four difficulty levels.'}</span
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
	.friend .copy > span {
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
