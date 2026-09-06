<script lang="ts">
	import { usePaginatedQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import type { Board } from '$lib/chess';
	import { historyPositions, type HistoryMove } from '$lib/chess/history';
	import MoveList from './MoveList.svelte';
	import Button from './Button.svelte';
	import { errorMessage } from '$lib/multiplayer';
	let {
		gameId,
		board,
		ply,
		selectedPly,
		onreview,
		pendingMove = null
	}: {
		gameId: Id<'games'>;
		board: Board;
		ply: number;
		selectedPly: number;
		pendingMove?: HistoryMove | null;
		onreview: (view: { board: Board; ply: number; move: HistoryMove | null } | null) => void;
	} = $props();
	const history = usePaginatedQuery(api.moves.list, () => ({ gameId }), { initialNumItems: 20 });
	const entries = $derived([
		...history.results.filter((m) => m.ply <= ply),
		...(pendingMove && !history.results.some((m) => m.ply === pendingMove.ply) ? [pendingMove] : [])
	]);
	const positions = $derived(historyPositions(board, ply, entries));
	function choose(p: number) {
		if (p === ply) {
			onreview(null);
			return;
		}
		const position = positions.get(p);
		if (position)
			onreview({ board: position, ply: p, move: entries.find((m) => m.ply === p) ?? null });
	}
</script>

<div class="stack">
	{#if history.error}<p class="error" role="alert">
			{errorMessage(history.error)}
		</p>{:else if history.status === 'LoadingFirstPage'}<p role="status">Loading moves…</p>{:else}
		{#if entries.length}<MoveList
				moves={entries}
				{positions}
				{selectedPly}
				livePly={ply}
				onselect={choose}
			/>{:else}<p>No moves yet.</p>{/if}
		{#if history.status === 'CanLoadMore'}<Button onclick={() => history.loadMore(20)}
				>Older moves</Button
			>{:else if history.status === 'LoadingMore'}<p role="status">Loading…</p>{/if}
	{/if}
</div>
