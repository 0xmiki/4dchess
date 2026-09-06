<script lang="ts">
	import { usePaginatedQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import MoveList from './MoveList.svelte';
	import Button from './Button.svelte';
	import { errorMessage } from '$lib/multiplayer';
	let { gameId }: { gameId: Id<'games'> } = $props();
	const history = usePaginatedQuery(api.moves.list, () => ({ gameId }), { initialNumItems: 20 });
</script>

<div class="stack">
	{#if history.error}<p class="error" role="alert">{errorMessage(history.error)}</p>
	{:else if history.status === 'LoadingFirstPage'}<p role="status">Loading moves…</p>
	{:else if !history.results.length}<p>No moves yet.</p>
	{:else}
		<MoveList moves={history.results} />
		{#if history.status === 'CanLoadMore'}<Button onclick={() => history.loadMore(20)}
				>Older moves</Button
			>{:else if history.status === 'LoadingMore'}<p role="status">Loading…</p>{/if}
	{/if}
</div>
