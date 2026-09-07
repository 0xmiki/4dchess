<script lang="ts">
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import GameClock from './GameClock.svelte';
	import PieceIcon from './Piece.svelte';
	import type { Piece } from '$lib/chess';
	import type { Snippet } from 'svelte';
	let {
		name,
		side,
		own = false,
		active = false,
		score,
		captured = [],
		advantage = 0,
		notice,
		showNotice = false,
		noticeAbove = false,
		remaining
	}: {
		name: string;
		side: 'white' | 'black';
		own?: boolean;
		active?: boolean;
		score?: number;
		captured?: readonly Piece[];
		advantage?: number;
		notice?: Snippet;
		showNotice?: boolean;
		noticeAbove?: boolean;
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
		<div
			class="material-row"
			role="group"
			aria-label={`${captured.length} captured pieces${advantage > 0 ? `, material advantage ${advantage}` : ''}`}
		>
			<span class="captured-pieces" aria-hidden="true"
				>{#each captured as piece, i (i)}<PieceIcon {piece} size={20} onDark />{/each}</span
			>
			{#if advantage > 0}<span class="material-advantage">+{advantage}</span>{/if}
		</div>
	</div>
	{#if remaining !== undefined}<GameClock {remaining} running={active} {side} />{/if}
	{#if notice && showNotice}<div class="player-notice" class:above={noticeAbove}>
			{@render notice()}
		</div>{/if}
</div>

<style>
	.player-profile {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
		min-height: 44px;
		min-width: 0;
	}
	.player-notice {
		position: absolute;
		top: calc(100% + var(--space-1));
		right: 0;
		width: 100%;
		height: 20px;
		pointer-events: none;
	}
	.player-notice.above {
		top: auto;
		bottom: calc(100% + var(--space-1));
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
		grid-template-rows: 18px 20px;
		gap: 0;
		min-width: 0;
	}
	strong {
		font: 700 13px/18px var(--font-data);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.material-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		color: var(--muted);
	}
	.captured-pieces {
		display: flex;
		align-items: center;
		opacity: 0.75;
	}
	.captured-pieces :global(svg + svg) {
		margin-left: -7px;
	}
	.material-advantage {
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
</style>
