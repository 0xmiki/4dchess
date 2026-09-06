<script lang="ts">
	import { usePaginatedQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import { squareAddress } from '$lib/chess';
	import { errorMessage } from '$lib/multiplayer';
	import { pieceNames } from '$lib/pieces';
	let { gameId }: { gameId: Id<'games'> } = $props();
	const history = usePaginatedQuery(api.moves.list, () => ({ gameId }), { initialNumItems: 20 });
</script>

<div class="stack">
	{#if history.error}<p class="error" role="alert">{errorMessage(history.error)}</p>
	{:else if history.status === 'LoadingFirstPage'}<p role="status">Loading moves…</p>
	{:else if !history.results.length}<p>No moves yet.</p>
	{:else}
		<ol class="moves">
			{#each history.results as move (move._id)}
				<li>
					<span>{move.ply}.</span>
					<div>
						<strong
							>{move.piece.c === 'w' ? 'White' : 'Black'}
							{pieceNames[move.piece.t]}{move.captured
								? ` × ${pieceNames[move.captured.t]}`
								: ''}</strong
						><small>{squareAddress(move.from)} → {squareAddress(move.to)}</small>
					</div>
				</li>
			{/each}
		</ol>
		{#if history.status === 'CanLoadMore'}<button onclick={() => history.loadMore(20)}
				>Older moves</button
			>{:else if history.status === 'LoadingMore'}<p role="status">Loading…</p>{/if}
	{/if}
</div>

<style>
	.moves {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 12px;
	}
	.moves li {
		display: flex;
		gap: 14px;
		border-bottom: 1px solid #dce0d8;
		padding-bottom: 12px;
	}
	.moves small {
		display: block;
		color: #5a6958;
	}
</style>
