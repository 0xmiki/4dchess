<script lang="ts">
	import GameOutcome from '$lib/components/GameOutcome.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import BackToPlay from '$lib/components/BackToPlay.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { useAuth, useQuery, useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { inCheck, type Move } from '$lib/chess';
	import { errorMessage } from '$lib/multiplayer';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import Button from '$lib/components/Button.svelte';
	import GameStatus from '$lib/components/GameStatus.svelte';
	import GameMenu from '$lib/components/GameMenu.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import RulesDialog from '$lib/components/RulesDialog.svelte';
	import ExportGame from '$lib/components/ExportGame.svelte';
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
	let rulesDialog: ReturnType<typeof RulesDialog>,
		historyDialog: ReturnType<typeof Modal>,
		resignDialog: ReturnType<typeof Modal>;
	let showHistory = $state(false);
	let exportDialog: ReturnType<typeof Modal>,
		showExport = $state(false);
	async function exportSnapshot() {
		const snapshot = game;
		if (!snapshot) throw new Error('Match unavailable');
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
	let optionsMenu = $state<ReturnType<typeof GameMenu>>();
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
<main class="shell match-shell">
	{#if !mounted || auth.isLoading || (auth.isAuthenticated && match.isLoading)}<LoadingScreen
			label="Loading match"
		/>
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
		<div class="match-layout">
			<div class="match-position">
				<ChessBoard
					board={game.board}
					turn={game.turn}
					seat={match.data.seat}
					enabled={game.status === 'active' && ownTurn && !sending && !pending && online}
					lastMove={latest.data ?? null}
					onmove={move}
				/>
			</div>
			<aside class="game-info">
				<div class="match-topbar">
					<GameStatus
						heading={status}
						board={game.board}
						turn={game.turn}
						result={game.result}
						subtitle={game.result
							? resultDetail
							: `You are ${match.data.seat}. ${game.status === 'active' ? (ownTurn ? 'Your turn.' : 'Your friend’s turn.') : 'Untimed.'}`}
					/>
				</div>
				{#if game.status === 'waiting'}<div class="invite-panel stack">
						{#if invitationUrl}<div class="row">
								<Button variant="primary" onclick={copy}
									>{copied ? 'Link copied' : 'Copy invitation'}</Button
								><Button onclick={cancel} disabled={sending}>Cancel match</Button>
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
						{#if pending && !sending}<Button onclick={submitPending}>Retry move</Button>{/if}
					</div>{/if}
				<GameOutcome result={game.result} side={match.data.seat} />
				<footer class="game-tools">
					<BackToPlay /><a class="button" href={resolve('/')}>New game</a>
					<GameMenu bind:this={optionsMenu}>
						{#if game}<Button
								onclick={() => {
									optionsMenu?.close();
									showExport = true;
									exportDialog.showModal();
								}}>Export game</Button
							>{/if}
						<Button
							disabled={!mounted}
							onclick={() => {
								optionsMenu?.close();
								rulesDialog.showModal();
							}}>Rules</Button
						>
						{#if game && game.ply > 0}<Button
								onclick={() => {
									optionsMenu?.close();
									showHistory = true;
									historyDialog.showModal();
								}}>Move history</Button
							>{/if}
						{#if game?.status === 'active'}<Button
								disabled={sending || !!pending}
								onclick={() => {
									optionsMenu?.close();
									resignRequest = null;
									resignDialog.showModal();
								}}>Resign</Button
							>{/if}
					</GameMenu>
				</footer>
				{#if game.ply > 0}<section class="side-moves" aria-label="Recent moves">
						<h2>Moves</h2>
						<MoveHistory {gameId} />
					</section>{/if}
			</aside>
		</div>
	{/if}
</main>

<RulesDialog bind:this={rulesDialog} onclose={() => optionsMenu?.focus()} />
<Modal
	bind:this={exportDialog}
	title="Export game"
	onclose={() => {
		showExport = false;
		optionsMenu?.focus();
	}}
	>{#if showExport}<ExportGame load={exportSnapshot} />{/if}<Button
		class="close-dialog"
		onclick={() => exportDialog.close()}>Close export</Button
	></Modal
>
<Modal
	bind:this={historyDialog}
	title="Move history"
	onclose={() => {
		showHistory = false;
		optionsMenu?.focus();
	}}
>
	{#if showHistory}<MoveHistory {gameId} />{/if}<Button
		class="close-dialog"
		onclick={() => historyDialog.close()}>Close history</Button
	>
</Modal>
<Modal bind:this={resignDialog} title="Resign this match?" onclose={() => optionsMenu?.focus()}>
	<p>Your opponent will win. This cannot be undone.</p>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="row">
		<Button onclick={() => resignDialog.close()} disabled={sending}>Keep playing</Button><Button
			onclick={resign}
			disabled={sending}>{sending ? 'Confirming…' : 'Resign match'}</Button
		>
	</div>
</Modal>

<style>
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
