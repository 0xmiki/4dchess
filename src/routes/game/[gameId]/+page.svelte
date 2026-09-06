<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { useAuth, useQuery, useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { inCheck, type Move } from '$lib/chess';
	import { errorMessage } from '$lib/multiplayer';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import MoveHistory from '$lib/components/MoveHistory.svelte';
	const auth = useAuth(),
		client = useConvexClient();
	const gameId = $derived(page.params.gameId as Id<'games'>);
	const match = useQuery(api.games.get, () => (auth.isAuthenticated ? { gameId } : 'skip'));
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
	let rulesDialog: HTMLDialogElement,
		historyDialog: HTMLDialogElement,
		resignDialog: HTMLDialogElement;
	let showHistory = $state(false);
	let optionsMenu: HTMLDetailsElement;
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
	const game = $derived(match.data?.game);
	const ownTurn = $derived(!!game && game.turn === (match.data?.seat === 'white' ? 'w' : 'b'));
	const invitationUrl = $derived(invitation.data ? `${origin}/join#${invitation.data}` : '');
	const status = $derived.by(() => {
		if (!game) return '';
		if (game.status === 'waiting') return 'Waiting for your friend';
		if (game.result) {
			if (game.result.reason === 'cancellation')
				return game.result.detail === 'inviteExpired' ? 'Invitation expired' : 'Match cancelled';
			if (game.result.reason === 'draw') return 'Game drawn';
			return `${game.result.winner === 'white' ? 'White' : 'Black'} wins`;
		}
		return `${game.turn === 'w' ? 'White' : 'Black'} ${inCheck(game.board, game.turn) ? 'in check' : 'to move'}`;
	});
	const resultDetail = $derived.by(() => {
		if (!game?.result) return '';
		const result = game.result;
		if (result.reason === 'draw')
			return {
				stalemate: 'Stalemate.',
				repetition: 'Third repetition of the position.',
				fiftyMove: '100 halfmoves without a pawn move or capture.',
				bareKings: 'Only the two kings remain.'
			}[result.detail];
		if (result.reason === 'checkmate') return 'Checkmate.';
		if (result.reason === 'resignation')
			return `${result.winner === 'white' ? 'Black' : 'White'} resigned.`;
		return '';
	});
	onMount(() => {
		mounted = true;
		origin = location.origin;
		online = navigator.onLine && client.connectionState().isWebSocketConnected;
		const stopConnection = client.subscribeToConnectionState((state) => {
			online = state.isWebSocketConnected && navigator.onLine;
		});
		try {
			const stored = sessionStorage.getItem(`fourfold-pending-${gameId}`);
			if (stored) pending = JSON.parse(stored);
			localStorage.setItem('fourfold-last-game', gameId);
		} catch {
			/* Storage is optional. */
		}
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
			untrack(() => void submitPending());
		}
	});
	function clearPending() {
		pending = null;
		try {
			sessionStorage.removeItem(`fourfold-pending-${gameId}`);
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
			clearPending();
		} catch (cause) {
			error = errorMessage(cause);
			if (cause instanceof ConvexError) clearPending();
		} finally {
			sending = false;
		}
	}
	function move(move: Move) {
		if (!game || !match.data || pending || sending || !online) return;
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
		try {
			sessionStorage.setItem(`fourfold-pending-${gameId}`, JSON.stringify(pending));
		} catch {
			/* The live request still has a stable ID. */
		}
		void submitPending();
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

<svelte:head><title>{status || 'Match'} · 4D chess</title></svelte:head>
<main class="shell">
	<header class="site-header">
		<a href={resolve('/')}>4D chess</a>
		<details class="game-menu" bind:this={optionsMenu}>
			<summary aria-label="Game options">⋯</summary>
			<div class="menu-items">
				<button
					disabled={!mounted}
					onclick={() => {
						optionsMenu.open = false;
						rulesDialog.showModal();
					}}>Rules</button
				>
				{#if game && game.ply > 0}<button
						onclick={() => {
							optionsMenu.open = false;
							showHistory = true;
							historyDialog.showModal();
						}}>Move history</button
					>{/if}
				{#if game?.status === 'active'}<button
						disabled={sending || !!pending}
						onclick={() => {
							optionsMenu.open = false;
							resignRequest = null;
							resignDialog.showModal();
						}}>Resign</button
					>{/if}
			</div>
		</details>
	</header>
	{#if !mounted || auth.isLoading || (auth.isAuthenticated && match.isLoading)}<p role="status">
			Loading match…
		</p>
	{:else if !auth.isAuthenticated}<section class="flow">
			<p>
				This browser has no active guest session. Reopen the match in the browser where you joined.
			</p>
			<a href={resolve('/')}>Create another match</a>
		</section>
	{:else if match.error}<section class="flow">
			<p class="error" role="alert">{errorMessage(match.error)}</p>
			<a href={resolve('/')}>Return home</a>
		</section>
	{:else if game && match.data}
		<div class="match-topbar">
			<div aria-live="polite" aria-atomic="true">
				<h1>{status}</h1>
				<p class="muted">
					{game.result
						? resultDetail
						: `You are ${match.data.seat}. ${game.status === 'active' ? (ownTurn ? 'Your turn.' : 'Your friend’s turn.') : 'Untimed.'}`}
				</p>
			</div>
			{#if game.status === 'finished'}<a class="button" href={resolve('/')}>New match</a>{/if}
		</div>
		{#if game.status === 'waiting'}<div class="invite-panel stack">
				{#if invitationUrl}<div class="row">
						<button class="primary" onclick={copy}
							>{copied ? 'Link copied' : 'Copy invitation'}</button
						><button onclick={cancel} disabled={sending}>Cancel match</button>
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
				Connection lost. Your match is saved. Reconnecting…
			</p>{/if}
		{#if sending}<p class="notice" role="status">Waiting for server confirmation…</p>{/if}
		{#if error}<div class="notice row" role="alert">
				<p class="error">{error}</p>
				{#if pending && !sending}<button onclick={submitPending}>Retry move</button>{/if}
			</div>{/if}
		<ChessBoard
			board={game.board}
			turn={game.turn}
			seat={match.data.seat}
			enabled={game.status === 'active' && ownTurn && !sending && !pending && online}
			lastMove={latest.data ?? null}
			onmove={move}
		/>
	{/if}
</main>

<dialog
	bind:this={rulesDialog}
	aria-labelledby="rules-title"
	onclose={() => optionsMenu.querySelector('summary')?.focus()}
>
	<h2 id="rules-title">4D chess rules</h2>
	<div class="stack">
		<p>
			Win by checkmate. White moves first. The board has four coordinates: X and Y have four
			positions; Z and W each have two.
		</p>
		<dl>
			<dt>Rook</dt>
			<dd>Change exactly one coordinate by any distance.</dd>
			<dt>Bishop</dt>
			<dd>Change exactly two coordinates by equal distances.</dd>
			<dt>Knight</dt>
			<dd>Jump two steps along one coordinate and one along another.</dd>
			<dt>Queen</dt>
			<dd>Change any nonempty combination of coordinates by equal distances.</dd>
			<dt>King</dt>
			<dd>Change any combination of coordinates by one step, without entering check.</dd>
			<dt>Pawn</dt>
			<dd>
				Advance one empty square along Y. Capture one Y step forward plus one step along exactly one
				of X, Z, or W. White advances to rank 4, Black to rank 1. Promotion is automatically to a
				queen.
			</dd>
		</dl>
		<p>
			Sliders cannot pass through pieces. There is no castling, en passant, or opening pawn double
			move. Stalemate, third repetition, 100 halfmoves without a pawn move or capture, and bare
			kings are draws.
		</p>
		<button onclick={() => rulesDialog.close()}>Close rules</button>
	</div>
</dialog>
<dialog
	bind:this={historyDialog}
	aria-labelledby="history-title"
	onclose={() => {
		showHistory = false;
		optionsMenu.querySelector('summary')?.focus();
	}}
>
	<h2 id="history-title">Move history</h2>
	{#if showHistory}<MoveHistory {gameId} />{/if}<button
		class="close-dialog"
		onclick={() => historyDialog.close()}>Close history</button
	>
</dialog>
<dialog
	bind:this={resignDialog}
	aria-labelledby="resign-title"
	onclose={() => optionsMenu.querySelector('summary')?.focus()}
>
	<h2 id="resign-title">Resign this match?</h2>
	<p>Your opponent will win. This cannot be undone.</p>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="row">
		<button onclick={() => resignDialog.close()} disabled={sending}>Keep playing</button><button
			onclick={resign}
			disabled={sending}>{sending ? 'Confirming…' : 'Resign match'}</button
		>
	</div>
</dialog>

<style>
	.game-menu {
		position: relative;
	}
	.game-menu summary {
		cursor: pointer;
		list-style: none;
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		background: white;
		min-width: 42px;
		min-height: 42px;
		display: grid;
		place-items: center;
		font-size: 24px;
	}
	.game-menu summary::-webkit-details-marker {
		display: none;
	}
	.menu-items {
		position: absolute;
		right: 0;
		top: 48px;
		display: grid;
		min-width: 170px;
		padding: 6px;
		background: #fafbf9;
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		z-index: 10;
	}
	.menu-items button {
		border: 0;
		text-align: left;
	}
	.match-topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 24px;
	}
	.invite-panel {
		max-width: 640px;
		margin-bottom: 24px;
	}
	.invite-panel input {
		width: 100%;
		border: 1px solid #ccd3c8;
		border-radius: 5px;
		background: white;
		padding: 10px;
		font-size: 12px;
	}
	.notice {
		margin-bottom: 16px;
		padding: 12px 0;
	}
	dt {
		font-weight: 650;
		margin-top: 10px;
	}
	dd {
		margin: 2px 0 10px;
	}
	.close-dialog {
		margin-top: 20px;
	}
</style>
