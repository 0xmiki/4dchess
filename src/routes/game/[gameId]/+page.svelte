<script lang="ts">
	import { goto } from '$app/navigation';
	import { rememberMatch, leaveMatch } from '$lib/active-match';
	import type { HistoryMove } from '$lib/chess/history';
	import MovesPanel from '$lib/components/MovesPanel.svelte';
	import GameOutcome from '$lib/components/GameOutcome.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { useAuth, useQuery, useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { applyMove, inCheck, type GameState, type Board, type Move } from '$lib/chess';
	import { errorMessage } from '$lib/multiplayer';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import Button from '$lib/components/Button.svelte';
	import TurnIndicator from '$lib/components/TurnIndicator.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ExportGame from '$lib/components/ExportGame.svelte';
	import MoveHistory from '$lib/components/MoveHistory.svelte';
	const auth = useAuth(),
		client = useConvexClient();
	const roomId = $derived((page.params.roomId ?? page.params.gameId) as Id<'games'>);
	const match = useQuery(api.games.get, () => (auth.isAuthenticated ? { gameId: roomId } : 'skip'));
	const gameId = $derived(match.data?.game._id ?? roomId);
	const invitation = useQuery(api.games.getInvitation, () =>
		match.data?.game.status === 'waiting' &&
		match.data.game.creatorParticipantId ===
			(match.data.seat === 'white'
				? match.data.game.whiteParticipantId
				: match.data.game.blackParticipantId)
			? { gameId }
			: 'skip'
	);
	const latest = useQuery(api.moves.latest, () => (match.data ? { gameId } : 'skip'));
	let mounted = $state(false),
		online = $state(true),
		sending = $state(false),
		error = $state(''),
		copied = $state(false),
		origin = $state('');
	let resignDialog: ReturnType<typeof Modal>;
	let exportDialog: ReturnType<typeof Modal>,
		showExport = $state(false);
	async function exportSnapshot() {
		const snapshot = game;
		if (!snapshot) throw new Error('Room unavailable');
		let cursor: string | null = null;
		const moves: { from: number; to: number; ply: number }[] = [];
		do {
			const page: FunctionReturnType<typeof api.moves.list> = await client.query(api.moves.list, {
				gameId: snapshot._id,
				paginationOpts: { numItems: 50, cursor }
			});
			moves.push(...page.page.filter((move) => move.ply <= snapshot.ply));
			if (page.isDone || moves.length >= snapshot.ply) break;
			cursor = page.continueCursor;
		} while (cursor);
		moves.sort((a, b) => a.ply - b.ply);
		if (moves.length !== snapshot.ply || moves.some((move, index) => move.ply !== index + 1))
			throw new Error('Incomplete history');
		return { moves, result: snapshot.result, date: snapshot._creationTime };
	}
	type Pending = {
		gameId: Id<'games'>;
		participantId: Id<'participants'>;
		requestId: string;
		expectedRevision: number;
		move: Move;
	};
	let pending = $state<Pending | null>(null),
		resumeAttempted = false;
	let resignRequest: { gameId: Id<'games'>; expectedRevision: number; requestId: string } | null =
		null;
	let leaving = $state(false);
	const game = $derived(match.data?.game);
	let optimistic = $state<{
		gameId: Id<'games'>;
		baseRevision: number;
		state: GameState;
		move: HistoryMove;
	} | null>(null);
	let review = $state<{ board: Board; ply: number; move: HistoryMove | null } | null>(null);
	const provisional = $derived(
		game && optimistic && game.status === 'active' && game.revision === optimistic.baseRevision
			? optimistic
			: null
	);
	const liveBoard = $derived(provisional?.state.board ?? game?.board);
	const livePly = $derived(provisional?.state.ply ?? game?.ply ?? 0);
	$effect(() => {
		if (
			game &&
			optimistic &&
			(game._id !== optimistic.gameId ||
				game.revision !== optimistic.baseRevision ||
				game.status !== 'active')
		)
			optimistic = null;
	});
	function previewMove(request: Pending) {
		if (!game || game.revision !== request.expectedRevision || game.status !== 'active') return;
		const applied = applyMove({ ...game, result: null }, request.move);
		if (applied.ok)
			optimistic = {
				gameId: game._id,
				baseRevision: game.revision,
				state: applied.state,
				move: {
					...request.move,
					ply: applied.state.ply,
					piece: game.board[request.move.from]!,
					captured: game.board[request.move.to]
				}
			};
	}
	function leave() {
		if (game?.status === 'active') return;
		leaving = true;
		leaveMatch();
		void goto(resolve('/'));
	}

	const ownTurn = $derived(!!game && game.turn === (match.data?.seat === 'white' ? 'w' : 'b'));
	const invitationUrl = $derived(invitation.data ? `${origin}/join#${invitation.data}` : '');
	const status = $derived.by(() => {
		if (!game) return '';
		if (review) return `Reviewing move ${review.ply}`;
		if (provisional) return 'Confirming move…';
		if (game.status === 'waiting') return 'Waiting for your friend';
		if (game.result) {
			if (game.result.reason === 'cancellation')
				return game.result.detail === 'inviteExpired' ? 'Invitation expired' : 'Room closed';
			if (game.result.reason === 'draw') return 'Game drawn';
			return `${game.result.winner === 'white' ? 'White' : 'Black'} wins`;
		}
		return `${game.turn === 'w' ? 'White' : 'Black'} ${inCheck(game.board, game.turn) ? 'in check' : 'to move'}`;
	});
	onMount(() => {
		mounted = true;
		origin = location.origin;
		online = navigator.onLine && client.connectionState().isWebSocketConnected;
		const stopConnection = client.subscribeToConnectionState((state) => {
			online = state.isWebSocketConnected && navigator.onLine;
		});
		const connected = () => {
			online = true;
		};
		const disconnected = () => {
			online = false;
		};
		window.addEventListener('online', connected);
		window.addEventListener('offline', disconnected);
		return () => {
			stopConnection();
			window.removeEventListener('online', connected);
			window.removeEventListener('offline', disconnected);
		};
	});
	$effect(() => {
		if (mounted && game && !leaving) {
			if (game.status === 'finished') leaveMatch();
			else rememberMatch({ kind: 'friend', gameId: roomId });
		}
	});
	let restoredGame = $state<Id<'games'> | null>(null);
	$effect(() => {
		const current = match.data;
		if (mounted && current && restoredGame !== current.game._id) {
			restoredGame = current.game._id;
			untrack(() => {
				review = null;
				error = '';
				copied = false;
				resignRequest = null;
				optimistic = null;
				pending = null;
				resumeAttempted = false;
				try {
					const saved = sessionStorage.getItem(`fourfold-pending-${current.game._id}`);
					if (saved) pending = JSON.parse(saved);
				} catch {
					/* Storage is optional. */
				}
			});
		}
	});
	$effect(() => {
		const current = match.data;
		if (mounted && current && pending && !resumeAttempted) {
			resumeAttempted = true;
			const owner =
				current.seat === 'white'
					? current.game.whiteParticipantId
					: current.game.blackParticipantId;
			if (pending.gameId !== gameId || pending.participantId !== owner) {
				clearPending();
				return;
			}
			untrack(() => {
				if (pending) previewMove(pending);
				void submitPending();
			});
		}
	});
	function clearPending(request = pending) {
		if (!request) return;
		if (pending?.requestId === request.requestId && pending.gameId === request.gameId)
			pending = null;
		try {
			sessionStorage.removeItem(`fourfold-pending-${request.gameId}`);
		} catch {
			/* Storage is optional. */
		}
	}
	async function submitPending() {
		if (!pending || sending) return;
		const request = pending;
		sending = true;
		error = '';
		try {
			await client.mutation(api.moves.submit, {
				gameId: request.gameId,
				requestId: request.requestId,
				expectedRevision: request.expectedRevision,
				move: request.move
			});
			clearPending(request);
		} catch (cause) {
			if (gameId === request.gameId) error = errorMessage(cause);
			if (cause instanceof ConvexError) {
				if (optimistic?.gameId === request.gameId) optimistic = null;
				clearPending();
			}
		} finally {
			if (gameId === request.gameId) sending = false;
		}
	}
	function move(move: Move) {
		if (
			!game ||
			!match.data ||
			pending ||
			sending ||
			provisional ||
			review ||
			!online ||
			game.status !== 'active' ||
			!ownTurn
		)
			return;
		const participantId =
			match.data.seat === 'white' ? game.whiteParticipantId : game.blackParticipantId;
		if (!participantId) return;
		pending = {
			gameId,
			participantId,
			move,
			expectedRevision: game.revision,
			requestId: crypto.randomUUID()
		};
		resumeAttempted = true;
		previewMove(pending);
		try {
			sessionStorage.setItem(`fourfold-pending-${gameId}`, JSON.stringify(pending));
		} catch {
			/* The live request still has a stable ID. */
		}
		void submitPending();
	}
	let roundStarting = $state(false);
	async function newRound() {
		if (!game || game.status !== 'finished' || roundStarting) return;
		roundStarting = true;
		error = '';
		try {
			await client.mutation(api.games.rematch, { roomId, expectedGameId: game._id });
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			roundStarting = false;
		}
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(invitationUrl);
			copied = true;
		} catch {
			error = 'Select and copy the invitation link below.';
		}
	}
	async function cancel() {
		if (!game) return;
		sending = true;
		error = '';
		try {
			await client.mutation(api.games.cancel, { gameId, expectedRevision: game.revision });
			leave();
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			sending = false;
		}
	}
	async function resign() {
		if (!game) return;
		sending = true;
		error = '';
		resignRequest ??= { gameId, expectedRevision: game.revision, requestId: crypto.randomUUID() };
		try {
			await client.mutation(api.games.resign, resignRequest);
			resignRequest = null;
			resignDialog.close();
		} catch (cause) {
			error = errorMessage(cause);
			if (cause instanceof ConvexError) resignRequest = null;
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head><title>{status || 'Room'} · 4D chess</title></svelte:head>
<main class="shell match-shell">
	{#if !mounted || auth.isLoading || (auth.isAuthenticated && match.isLoading)}<LoadingScreen
			label="Loading room"
		/>
	{:else if !auth.isAuthenticated}<section class="flow">
			<p>
				This browser has no active guest session. Reopen the room in the browser where you joined.
			</p>
			<a href={resolve('/')}>Create another room</a>
		</section>
	{:else if match.error}<section class="flow">
			<p class="error" role="alert">{errorMessage(match.error)}</p>
			<a href={resolve('/')}>Return home</a>
		</section>
	{:else if game && match.data}
		<div class="match-layout">
			<div class="match-position">
				<ChessBoard
					gameKey={gameId}
					board={review?.board ?? liveBoard!}
					turn={review
						? review.ply % 2 === 0
							? 'w'
							: 'b'
						: (provisional?.state.turn ?? game.turn)}
					seat={match.data.seat}
					enabled={!review &&
						!provisional &&
						game.status === 'active' &&
						ownTurn &&
						!sending &&
						!pending &&
						online}
					lastMove={review ? review.move : (provisional?.move ?? latest.data ?? null)}
					onmove={move}
				/>
			</div>
			<aside class="game-info">
				{#if game.status === 'waiting'}<div class="invite-panel stack">
						{#if invitationUrl}<div class="row">
								<Button variant="primary" onclick={copy}
									>{copied ? 'Link copied' : 'Copy invitation'}</Button
								><Button onclick={cancel} disabled={sending}>Close room</Button>
							</div>
							<input
								aria-label="Invitation link"
								readonly
								value={invitationUrl}
								onclick={(e) => e.currentTarget.select()}
							/>
							<p class="muted">Invitation expires {new Date(game.expiresAt).toLocaleString()}.</p>
						{:else if invitation.error}<p class="error" role="alert">
								{errorMessage(invitation.error)}
							</p>{/if}
					</div>{/if}
				{#if !online}<p class="notice" role="status">
						Connection lost. Your room is saved. Reconnecting…
					</p>{/if}
				{#if sending}<p class="notice" role="status">Waiting for server confirmation…</p>{/if}
				{#if error}<div class="notice row" role="alert">
						<p class="error">{error}</p>
						{#if pending && !sending}<Button onclick={submitPending}>Retry move</Button>{/if}
					</div>{/if}
				<GameOutcome result={game.result} side={match.data.seat} />
				{#if game.status === 'active'}<Button
						disabled={sending || !!pending}
						onclick={() => {
							resignRequest = null;
							resignDialog.showModal();
						}}>Resign</Button
					>{:else if game.status === 'finished' && game.result?.reason !== 'cancellation'}<Button
						variant="primary"
						onclick={newRound}
						disabled={roundStarting}
						>{#if roundStarting}<Spinner label="Starting game" />{:else}New game{/if}</Button
					>{/if}
				<MovesPanel
					onexport={() => {
						showExport = true;
						exportDialog.showModal();
					}}
					>{#snippet indicator()}<TurnIndicator
							label={status}
							turn={game.turn}
							text={review
								? `Move ${review.ply}`
								: provisional
									? 'Confirming…'
									: game.status === 'waiting'
										? 'Waiting for friend'
										: game.status === 'finished'
											? 'Game over'
											: ownTurn
												? 'Your turn'
												: 'Friend’s turn'}
						/>{/snippet}<MoveHistory
						{gameId}
						board={liveBoard!}
						ply={livePly}
						selectedPly={review?.ply ?? livePly}
						pendingMove={provisional?.move ?? null}
						onreview={(value) => {
							review = value;
						}}
					/></MovesPanel
				>
				{#if game.status !== 'active'}<button class="leave-match" onclick={leave}>Leave room</button
					>{/if}
			</aside>
		</div>
	{/if}
</main>

<Modal
	bind:this={exportDialog}
	title="Export game"
	dismissOnBackdrop
	onclose={() => {
		showExport = false;
	}}
	>{#if showExport}<ExportGame load={exportSnapshot} />{/if}</Modal
>
<Modal bind:this={resignDialog} title="Resign this game?">
	<p>Your opponent will win. This cannot be undone.</p>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="row">
		<Button onclick={() => resignDialog.close()} disabled={sending}>Keep playing</Button><Button
			onclick={resign}
			disabled={sending}>{sending ? 'Confirming…' : 'Resign game'}</Button
		>
	</div>
</Modal>

<style>
	.invite-panel {
		max-width: 640px;
		margin-bottom: 24px;
	}
	.invite-panel input {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--surface);
		padding: 10px;
		font-size: 12px;
	}
	.notice {
		margin-bottom: 16px;
		padding: 12px 0;
	}
	:global(.close-dialog) {
		margin-top: 20px;
	}
</style>
