<script lang="ts">
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import GameClock from './GameClock.svelte';
	let {
		name,
		side,
		own = false,
		active = false,
		remaining
	}: {
		name: string;
		side: 'white' | 'black';
		own?: boolean;
		active?: boolean;
		remaining?: number;
	} = $props();
</script>

<div class="player-profile" class:active aria-label={`${name}, ${side}${own ? ', you' : ''}`}>
	<span class="avatar" class:black={side === 'black'}><UserIcon size={24} weight="fill" /></span>
	<div class="identity">
		<strong>{name}</strong><span>{own ? 'You · ' : ''}{side === 'white' ? 'White' : 'Black'}</span>
	</div>
	{#if remaining !== undefined}<GameClock {remaining} running={active} {side} />{/if}
</div>

<style>
	.player-profile {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 44px;
		min-width: 0;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 8px;
		background: var(--piece-white);
		color: #333;
	}
	.avatar.black {
		background: #303030;
		color: #d1d1d1;
	}
	.identity {
		display: grid;
		gap: 3px;
		min-width: 0;
	}
	strong {
		font-size: 14px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.identity > span {
		color: var(--muted);
		font-size: 12px;
	}
	.active .identity > span {
		color: var(--text);
	}
</style>
