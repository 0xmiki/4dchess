<script lang="ts">
	import MatchSidebar from './MatchSidebar.svelte';
	import GameOverDialog from './GameOverDialog.svelte';
	let resultDialog = $state<GameOverDialog>();
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { useQuery, usePaginatedQuery, useConvexClient } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import type { Move } from '$lib/chess';
	import { capturedPieces, materialAdvantage } from '$lib/chess/material';
	import type { HistoryMove } from '$lib/chess/history';
	import {
		createVariationTree,
		mergeLiveMoves,
		addVariation,
		type VariationTree
	} from '$lib/chess/variations';
	import { remainingTime, timeControlLabel } from '$lib/online/time-controls';
	import ChessBoard from './ChessBoard.svelte';
	import GameAudio from './GameAudio.svelte';
	import PlayerProfile from './PlayerProfile.svelte';
	import ReconnectNotice from './ReconnectNotice.svelte';
	import VariationHistory from './VariationHistory.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import BoardControls from './BoardControls.svelte';
	import Button from './Button.svelte';
	import SelectField from './SelectField.svelte';
	import Spinner from './Spinner.svelte';
	import HistoryShortcuts from './HistoryShortcuts.svelte';
	let { roomId }: { roomId: Id<'games'> } = $props();
	type PublicGame = NonNullable<FunctionReturnType<typeof api.watch.game>>;
	type Session = { game: PublicGame; tree: VariationTree; receivedAt: number };
	const client = useConvexClient();
	const live = useQuery(api.watch.game, () => ({ roomId }));
	const scores = useQuery(api.watch.score, () => ({ roomId }));
	const presence = useQuery(api.presence.status, () =>
		live.data ? { gameId: live.data.id } : 'skip'
	);
	const sessions = new SvelteMap<string, Session>();
	let version = $state(0),
		selection = $state<{ gameId: Id<'games'>; nodeId: string } | null>(null);
	let flipped = $state(false),
		error = $state(''),
		now = $state(Date.now()),
		synced = $state(false),
		connected = $state(true);
	const viewedId = $derived(selection?.gameId ?? live.data?.id);
	let chosenRound = $derived(viewedId ?? '');
	const history = usePaginatedQuery(
		api.watch.moves,
		() => (viewedId ? { gameId: viewedId } : 'skip'),
		{ initialNumItems: 50 }
	);
	$effect(() => {
		const game = live.data;
		if (game)
			untrack(() => {
				const existing = sessions.get(game.id);
				sessions.set(game.id, {
					game,
					tree: existing?.tree ?? createVariationTree(),
					receivedAt: now
				});
				version++;
			});
	});
	$effect(() => {
		const moves = history.results,
			id = viewedId;
		if (id)
			untrack(() => {
				const session = sessions.get(id);
				if (!session) return;
				try {
					mergeLiveMoves(
						session.tree,
						moves.filter((move) => move.gameId === id)
					);
					version++;
					error = '';
				} catch {
					error = 'Could not reconstruct the move history.';
				}
			});
	});
	$effect(() => {
		if (history.status === 'CanLoadMore') history.loadMore(50);
	});
	const session = $derived.by(() => {
		void version;
		return viewedId ? sessions.get(viewedId) : undefined;
	});
	const tree = $derived(session?.tree);
	const game = $derived.by(() => {
		void version;
		return viewedId ? sessions.get(viewedId)?.game : undefined;
	});
	const node = $derived.by(() => {
		void version;
		return tree?.nodes.get(selection?.nodeId ?? tree.mainline.at(-1)!);
	});
	const complete = $derived.by(() => {
		void version;
		return !!tree && !!game && tree.mainline.length - 1 === game.ply;
	});
	const hasNext = $derived.by(() => {
		void version;
		return !!node?.children.length;
	});
	const board = $derived(selection ? node?.state.board : game?.board);
	const variation = $derived(!!selection && node?.live === false);
	const turn = $derived(selection ? node?.state.turn : game?.turn);
	const material = $derived(materialAdvantage(board ?? []));
	const captured = $derived.by(() => {
		void version;
		const moves: HistoryMove[] = [];
		let current = node;
		while (current?.move) {
			moves.push(current.move);
			current = current.parent ? tree?.nodes.get(current.parent) : undefined;
		}
		return capturedPieces(moves);
	});
	const rounds = $derived.by(() => {
		void version;
		return [...sessions.values()].map((s) => ({ value: s.game.id, label: `Game ${s.game.round}` }));
	});
	const topSide = $derived(flipped ? 'white' : 'black');
	const bottomSide = $derived(flipped ? 'black' : 'white');
	const sameRound = $derived(viewedId === live.data?.id);
	function choose(id: string) {
		if (viewedId && tree?.nodes.has(id)) selection = { gameId: viewedId, nodeId: id };
	}
	function explore(move: Move) {
		if (!tree || !node || !viewedId || (!selection && !complete)) return;
		try {
			const next = addVariation(tree, node.id, move);
			selection = { gameId: viewedId, nodeId: next.id };
			version++;
			error = '';
		} catch {
			error = 'That move is not legal in this position.';
		}
	}
	function returnLive() {
		selection = null;
		error = '';
	}
	function next() {
		const child =
			node?.children.map((id) => tree!.nodes.get(id)!).find((n) => n.live) ??
			(node?.children[0] ? tree?.nodes.get(node.children[0]) : undefined);
		if (child) {
			if (child.live && sameRound && complete && child.id === tree?.mainline.at(-1)) returnLive();
			else choose(child.id);
		} else if (selection) returnLive();
	}
	function previous() {
		if (node?.parent) choose(node.parent);
	}
	function clock(side: 'white' | 'black') {
		if (!game?.clock) return undefined;
		const at = sameRound ? (synced ? now : (game.clock.turnStartedAt ?? now)) : session!.receivedAt;
		return remainingTime(game.clock, game.turn, side, at);
	}
	onMount(() => {
		let alive = true,
			sampling = false,
			serverAnchor = Date.now(),
			localAnchor = performance.now();
		const sample = async () => {
			if (sampling) return;
			sampling = true;
			const sent = performance.now();
			try {
				const time = await client.query(api.clocks.time, { sample: crypto.randomUUID() });
				if (!alive) return;
				const received = performance.now();
				serverAnchor = time + (received - sent) / 2;
				localAnchor = received;
				now = serverAnchor;
				synced = true;
			} catch {
				/* Preserve the monotonic clock while offline. */
			} finally {
				sampling = false;
			}
		};
		void sample();
		const timer = setInterval(() => {
			now = serverAnchor + performance.now() - localAnchor;
		}, 100);
		const refresh = setInterval(sample, 30000);
		const stop = client.subscribeToConnectionState((state) => {
			connected = state.isWebSocketConnected;
		});
		window.addEventListener('online', sample);
		return () => {
			alive = false;
			clearInterval(timer);
			clearInterval(refresh);
			stop();
			window.removeEventListener('online', sample);
		};
	});
</script>

<svelte:head><title>Watch game · 4D chess</title></svelte:head>
<HistoryShortcuts {previous} {next} />
<main class="shell match-shell" data-spectator="true">
	{#if live.isLoading}<LoadingScreen label="Opening game" />
	{:else if live.error || live.data === null}<p>This game is unavailable.</p>
		<a href={resolve('/')}>Back to play</a>
	{:else if game && board && turn}
		{#if live.data}<GameAudio
				gameKey={live.data.id}
				board={live.data.board}
				turn={live.data.turn}
				ply={live.data.ply}
				active={live.data.status === 'active'}
				result={live.data.result}
				lastMove={complete && !selection ? (node?.move ?? null) : null}
				audible={!selection}
			/>{/if}
		<div class="match-layout">
			<div class="match-position board-stage" class:variation>
				<PlayerProfile
					name={game.players[topSide] ?? 'Waiting for player'}
					side={topSide}
					remaining={clock(topSide)}
					captured={captured[topSide]}
					advantage={material[topSide]}
					active={sameRound &&
						game.status === 'active' &&
						game.turn === (topSide === 'white' ? 'w' : 'b')}
					score={sameRound && scores.data?.games ? scores.data[topSide] : undefined}
					showNotice={!!game.clock}
					>{#snippet notice()}{#if sameRound && presence.data?.enforced}<ReconnectNotice
								{...presence.data[topSide]}
								{now}
							/>{/if}{/snippet}</PlayerProfile
				>
				<ChessBoard
					gameKey={`${roomId}:${viewedId}`}
					showHint={false}
					interruptibleMotion
					{board}
					{turn}
					seat={flipped ? 'black' : 'white'}
					enabled={game.status !== 'waiting' &&
						!!node &&
						!node.state.result &&
						(selection !== null || complete)}
					lastMove={complete || selection ? (node?.move ?? null) : null}
					onmove={explore}
				/>
				<PlayerProfile
					name={game.players[bottomSide] ?? 'Waiting for player'}
					side={bottomSide}
					remaining={clock(bottomSide)}
					captured={captured[bottomSide]}
					advantage={material[bottomSide]}
					noticeAbove
					active={sameRound &&
						game.status === 'active' &&
						game.turn === (bottomSide === 'white' ? 'w' : 'b')}
					score={sameRound && scores.data?.games ? scores.data[bottomSide] : undefined}
					showNotice={!!game.clock}
					>{#snippet notice()}{#if sameRound && presence.data?.enforced}<ReconnectNotice
								{...presence.data[bottomSide]}
								{now}
							/>{/if}{/snippet}</PlayerProfile
				>
			</div>
			<GameOverDialog
				bind:this={resultDialog}
				result={live.data?.result ?? null}
				side="white"
				spectator
				gameKey={live.data?.id ?? ''}
			/>
			<MatchSidebar
				label="Spectator controls"
				onresult={live.data?.result ? () => resultDialog?.show() : undefined}
				navigation={{
					previous: node?.parent ? previous : null,
					next: hasNext || selection ? next : null,
					live: selection ? returnLive : null,
					label: selection ? 'Move ' + (node?.state.ply ?? 0) : 'Live'
				}}
			>
				<div class="watch-heading">
					<span>Watching · Game {game.round}</span><button
						onclick={() => {
							flipped = !flipped;
						}}
						title="Flip board">Flip board</button
					>
				</div>
				<div class="game-heading">
					<p class="muted">{timeControlLabel(game.timeControl)}</p>
					<BoardControls />
				</div>
				{#if !connected}<p role="status" class="muted">Reconnecting to the live game.</p>{/if}
				{#if selection}<div class="analysis-status">
						<p role="status">
							{variation ? 'Local analysis' : 'Reviewing'} · Move {node?.state.ply ?? 0}
						</p>
						{#if variation}<p class="muted">Only you can see these moves.</p>{/if}
						{#if !sameRound}<p role="status">Game {live.data?.round} has started.</p>{/if}
						<Button variant="primary" onclick={returnLive}>Return to live</Button>
						<span class="muted">Live game · Move {live.data?.ply ?? 0}</span>
					</div>{:else}<p class="muted">Try a move to explore a variation.</p>{/if}
				{#if game.status === 'waiting'}<p role="status">Waiting for the other player.</p>{/if}
				{#if game.result}<p role="status">
						{game.result.reason === 'aborted'
							? 'Game aborted'
							: game.result.reason === 'cancellation'
								? 'Challenge closed'
								: game.result.winner
									? `${game.result.winner === 'white' ? 'White' : 'Black'} wins`
									: 'Draw'}
					</p>{/if}
				{#if rounds.length > 1}<SelectField
						label="Game"
						options={rounds}
						bind:value={chosenRound}
						onchange={() => {
							const chosen = sessions.get(chosenRound);
							if (chosen)
								selection = { gameId: chosen.game.id, nodeId: chosen.tree.mainline.at(-1)! };
						}}
					/>{/if}
				{#if error || history.error}<p role="alert" class="error">
						{error || 'Could not load move history.'}
					</p>{/if}
				<section class="move-panel" aria-label="Moves">
					<div class="history-heading">
						<span>{selection ? 'Analysis' : 'Live'}</span>{#if !complete}<Spinner
								label="Loading move history"
							/>{/if}
					</div>
					{#if tree && node}<VariationHistory
							{tree}
							{version}
							selected={node.id}
							onselect={choose}
						/>{/if}
					<div class="history-controls">
						<button
							aria-label="Previous move"
							aria-keyshortcuts="ArrowLeft"
							disabled={!node?.parent}
							onclick={() => {
								if (node?.parent) choose(node.parent);
							}}>‹</button
						>
						<button onclick={returnLive} disabled={!selection}>Live</button>
						<button
							aria-label="Next move"
							aria-keyshortcuts="ArrowRight"
							disabled={!hasNext && !selection}
							onclick={next}>›</button
						>
					</div>
				</section>
				<a class="back-link" href={resolve('/')}>Back to play</a>
			</MatchSidebar>
		</div>
	{/if}
</main>

<style>
	.game-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.board-stage.variation {
		--board-light: color-mix(in srgb, #ded5bf, white 14%);
		--board-dark: color-mix(in srgb, var(--game-primary), white 18%);
	}
	.board-stage {
		display: grid;
		gap: var(--space-5);
		--board-columns: repeat(2, minmax(0, 1fr));
	}
	.board-stage :global(.workspace) {
		align-items: center;
	}
	.board-stage > :global(.player-profile) {
		margin-inline: var(--space-3);
	}
	.watch-heading,
	.history-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.watch-heading,
	.muted {
		color: var(--muted);
		font-size: 12px;
	}
	.watch-heading button {
		padding: var(--space-2);
		border-radius: 6px;
		cursor: pointer;
	}
	.analysis-status {
		display: grid;
		gap: var(--space-3);
	}
	.history-heading {
		border-bottom: 1px solid var(--line);
		min-height: 40px;
		font-size: 13px;
	}
	.history-controls {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.history-controls button {
		min-width: 40px;
		min-height: 40px;
		cursor: pointer;
		border-radius: 6px;
	}
	button:hover:not(:disabled) {
		background: var(--surface-raised);
	}
	button:disabled {
		opacity: 0.4;
	}
	.back-link {
		color: var(--muted);
		font-size: 13px;
		text-align: center;
		padding: var(--space-3);
	}
	@media (max-width: 1000px) {
		.board-stage :global(.workspace) {
			display: contents;
		}
		.board-stage :global(.workspace > section[aria-label='Chess boards']) {
			grid-row: 2;
		}
		.board-stage :global(.player-profile:last-of-type) {
			grid-row: 3;
		}
		.board-stage :global(.workspace > section[aria-label='Tesseract projection']) {
			grid-row: 4;
		}
	}
</style>
