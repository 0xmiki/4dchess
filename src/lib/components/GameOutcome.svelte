<script lang="ts">
	import type { ExportResult } from '$lib/chess/export';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
	import { isUnscoredResult } from '$lib/online/outcomes';
	let {
		result,
		side,
		spectator = false
	}: { result: ExportResult; side: 'white' | 'black'; spectator?: boolean } = $props();
	const finished = $derived(result && result.reason !== 'cancellation');
	const aborted = $derived(result?.reason === 'aborted');
	const won = $derived(!isUnscoredResult(result) && result?.winner === side);
</script>

{#if finished}<section class="game-outcome" aria-label="Game over" aria-live="polite">
		{#if won}<TrophyIcon size={36} weight="duotone" aria-hidden="true" />{:else}<FlagIcon
				size={32}
				aria-hidden="true"
			/>{/if}
		<h2>
			{aborted
				? 'Game aborted'
				: result?.winner
					? spectator
						? result.winner === 'white'
							? 'White wins'
							: 'Black wins'
						: won
							? 'You won!'
							: 'You lost'
					: 'Draw'}
		</h2>
		<p>
			{aborted
				? result?.detail === 'firstMoveNoShow'
					? 'A player did not make their first move in time.'
					: 'The game was interrupted. No score was awarded.'
				: result?.reason === 'abandonment'
					? result?.detail === 'disconnect'
						? 'Game abandoned after disconnection.'
						: 'Game ended by abandonment.'
					: result?.reason === 'checkmate'
						? 'Checkmate.'
						: result?.reason === 'timeout'
							? 'Game ended on time.'
							: result?.reason === 'resignation'
								? 'Game ended by resignation.'
								: ((
										{
											stalemate: 'Stalemate.',
											repetition: 'Draw by repetition.',
											fiftyMove: 'Draw by the 50-move rule.',
											bareKings: 'Only kings remain.',
											disconnectNoMaterial: 'No mating material after disconnection.',
											timeoutNoMaterial:
												'Draw on time. The player with time remaining has only a king.'
										} as Record<string, string>
									)[result?.detail ?? ''] ?? 'Game drawn.')}
		</p>
	</section>{/if}

<style>
	.game-outcome {
		padding: var(--space-5);
		background: var(--surface-raised);
		border-radius: var(--radius-panel);
		display: grid;
		gap: var(--space-2);
	}
	.game-outcome h2 {
		font-size: 32px;
		line-height: 1.1;
		font-weight: 800;
	}
	.game-outcome p {
		color: var(--muted);
		font-size: 14px;
	}
</style>
