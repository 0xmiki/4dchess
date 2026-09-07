<script lang="ts">
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import GameClock from './GameClock.svelte';
	let {
		name,
		side,
		own = false,
		active = false,
		score,
		remaining
	}: {
		name: string;
		side: 'white' | 'black';
		own?: boolean;
		active?: boolean;
		score?: number;
		remaining?: number;
	} = $props();
</script>

<div class="player-profile" class:active aria-label={`${name}, ${side}${own ? ', you' : ''}`}>
	<div class="player-mark" class:scored={score !== undefined}>
		{#if score !== undefined}<span
				class="series-score"
				aria-label={`Rematch score: ${score}`}
				title="Rematch score">{score.toFixed(1)}</span
			>{/if}
		<span class="avatar" class:black={side === 'black'}><UserIcon size={24} weight="fill" /></span>
	</div>
	<div class="identity">
		<strong>{name}</strong>
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
	.player-mark {
		display: flex;
		flex-shrink: 0;
		border-radius: 8px;
		overflow: hidden;
	}
	.scored .avatar {
		border-radius: 0;
	}
	.series-score {
		display: grid;
		place-items: center;
		min-width: 44px;
		padding-inline: var(--space-2);
		background: var(--surface-raised);
		color: var(--text);
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
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
</style>
