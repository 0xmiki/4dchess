<script lang="ts">
	import { ConvexHttpClient } from 'convex/browser';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { api } from '../../convex/_generated/api';
	import { statisticsAllowed } from '$lib/privacy';
	let reportToken: string | null = null;
	let reported = false;
	let reporting = false;
	async function reportGame() {
		if (reported || reporting || !statisticsAllowed()) return;
		reportToken ??= new Date().toISOString().slice(0, 10) + ':' + crypto.randomUUID();
		const token = reportToken;
		save();
		reporting = true;
		try {
			const accepted = await new ConvexHttpClient(PUBLIC_CONVEX_URL, {
				fetch: (input, init) =>
					fetch(input, { ...init, credentials: 'omit', signal: AbortSignal.timeout(5000) })
			}).mutation(api.stats.reportComputer, { token, consentVersion: 1 });
			if (token === reportToken && accepted) {
				reported = true;
				save();
			}
		} catch {
			/* Reporting never interrupts play or queues offline activity. */
		} finally {
			reporting = false;
		}
	}

	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { rememberMatch, leaveMatch } from '$lib/active-match';
	import { motionDuration } from '$lib/components/motion';
	import { historyPositions } from '$lib/chess/history';
	import SideToggle from '$lib/components/SideToggle.svelte';
	import MovesPanel from '$lib/components/MovesPanel.svelte';
	import GameOverDialog from '$lib/components/GameOverDialog.svelte';
	import MatchSidebar from '$lib/components/MatchSidebar.svelte';
	import PlayerProfile from '$lib/components/PlayerProfile.svelte';
	import BoardControls from '$lib/components/BoardControls.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import { onMount, untrack } from 'svelte';
	import {
		applyMove,
		createInitialState,
		type GameState,
		type Color,
		type Move,
		type Piece
	} from '$lib/chess';
	import { difficulties, type Difficulty, type SearchResult } from '$lib/chess/search';
	import ComputerWorker from '$lib/chess/computer.worker.ts?worker&inline';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import GameAudio from '$lib/components/GameAudio.svelte';
	import { gameSounds } from '$lib/audio/game-sounds';
	import Button from '$lib/components/Button.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import TurnIndicator from '$lib/components/TurnIndicator.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import MoveList from '$lib/components/MoveList.svelte';
	import ExportGame from '$lib/components/ExportGame.svelte';
	let game = $state<GameState | null>(null),
		player = $state<Color>('w'),
		difficulty = $state<Difficulty>('easy');
	let setupSide = $state<Color>('w'),
		setupDifficulty = $state<Difficulty>('easy');
	let ready = $state(false),
		thinking = $state(false),
		hidden = $state(false),
		error = $state(''),
		retry = $state(0);
	type Entry = Move & { ply: number; piece: Piece; captured: Piece | null };
	let history = $state<Entry[]>([]),
		startedAt = $state(Date.now()),
		showExport = $state(false);
	let resigned = $state(false),
		reviewPly = $state<number | null>(null);
	const result = $derived(
		resigned
			? { reason: 'resignation', winner: player === 'w' ? ('black' as const) : ('white' as const) }
			: (game?.result ?? null)
	);
	const positions = $derived(game ? historyPositions(game.board, game.ply, history) : new Map());
	function leave() {
		save();
		leaveMatch();
		void goto(resolve('/'));
	}
	function resign() {
		if (result) return;
		resigned = true;
		reviewPly = null;
		save();
	}
	let exportDialog: ReturnType<typeof Modal>;
	const levelOptions = Object.entries(difficulties).map(([value, level]) => ({
		value: value as Difficulty,
		label: level.label
	}));
	onMount(() => {
		ready = true;
		hidden = document.hidden;
		try {
			const raw = localStorage.getItem('fourfold-computer-v1');
			if (raw) {
				const saved = JSON.parse(raw);
				if (
					saved.version !== 1 ||
					!Array.isArray(saved.moves) ||
					saved.moves.length > 10000 ||
					!['w', 'b'].includes(saved.player) ||
					!Object.hasOwn(difficulties, saved.difficulty)
				)
					throw Error('Invalid save');
				let state = createInitialState();
				const restored: Entry[] = [];
				for (const move of saved.moves) {
					const applied = applyMove(state, move);
					if (!applied.ok) throw Error('Invalid saved move');
					restored.push({
						...move,
						ply: applied.state.ply,
						piece: state.board[move.from]!,
						captured: state.board[move.to]
					});
					state = applied.state;
				}
				reportToken = typeof saved.reportToken === 'string' ? saved.reportToken : null;
				reported = saved.reported === true;
				player = saved.player;
				difficulty = saved.difficulty;
				setupSide = player;
				setupDifficulty = difficulty;
				history = restored;
				startedAt = Number.isFinite(saved.startedAt) ? saved.startedAt : Date.now();
				game = state;
				resigned = saved.resigned === true;
			}
		} catch {
			error = 'The saved computer game could not be restored. Start a new game.';
		}
		if (!game) {
			const requested = new URL(location.href).searchParams.get('side');
			setupSide = requested === 'b' ? 'b' : 'w';
			start();
		}
		if (result) leaveMatch();
		else rememberMatch({ kind: 'computer' });
		const visibility = () => {
			hidden = document.hidden;
		};
		document.addEventListener('visibilitychange', visibility);
		return () => document.removeEventListener('visibilitychange', visibility);
	});
	$effect(() => {
		if (ready && result) leaveMatch();
	});
	function save() {
		try {
			localStorage.setItem(
				'fourfold-computer-v1',
				JSON.stringify({
					version: 1,
					...(reportToken ? { reportToken, reported } : {}),
					resigned,
					player,
					difficulty,
					startedAt,
					moves: history.map(({ from, to }) => ({ from, to }))
				})
			);
		} catch {
			error = 'This browser could not save the game. Keep this tab open or export it.';
		}
	}
	function start() {
		reportToken = null;
		reported = false;
		resigned = false;
		reviewPly = null;
		rememberMatch({ kind: 'computer' });
		player = setupSide;
		difficulty = setupDifficulty;
		history = [];
		startedAt = Date.now();
		error = '';
		game = createInitialState();
		save();
	}
	function move(move: Move) {
		if (!game || resigned) return;
		const before = game;
		const applied = applyMove(before, move);
		if (!applied.ok) {
			error = 'That move could not be played.';
			void gameSounds.play('illegal');
			return;
		}
		history = [
			...history,
			{
				...move,
				ply: applied.state.ply,
				piece: before.board[move.from]!,
				captured: before.board[move.to]
			}
		];
		game = applied.state;
		save();
		if (before.turn === player) void reportGame();
	}
	$effect(() => {
		const position = game,
			side = player,
			level = difficulty,
			isHidden = hidden,
			isReady = ready;
		void retry;
		if (!position || result || position.turn === side || isHidden || !isReady) return;
		return untrack(() => {
			let worker: Worker;
			try {
				worker = new ComputerWorker();
			} catch {
				error = 'The computer could not start. Retry to continue.';
				return;
			}
			let active = true,
				finishTimer: ReturnType<typeof setTimeout> | undefined;
			const startTime = performance.now();
			const last = history.at(-1);
			const replyDelay =
				last?.piece.c === side && !matchMedia('(prefers-reduced-motion: reduce)').matches
					? motionDuration(last, last.piece) + 120
					: 380;
			thinking = true;
			error = '';
			const watchdog = setTimeout(() => {
				if (active) {
					worker.terminate();
					thinking = false;
					error = 'The computer took too long. Retry to continue.';
				}
			}, difficulties[level].budgetMs + 5000);
			worker.onmessage = (event: MessageEvent<SearchResult & { type: string }>) => {
				if (!active) return;
				if (event.data.type === 'error') {
					clearTimeout(watchdog);
					thinking = false;
					error = 'The computer could not finish its move. Retry to continue.';
					return;
				}
				if (event.data.type !== 'result') return;
				clearTimeout(watchdog);
				const reply = event.data.move;
				finishTimer = setTimeout(
					() => {
						if (!active) return;
						thinking = false;
						if (reply) move(reply);
						else error = 'The computer did not return a move. Retry to continue.';
					},
					Math.max(0, replyDelay - (performance.now() - startTime))
				);
			};
			worker.onerror = () => {
				clearTimeout(watchdog);
				thinking = false;
				error = 'The computer could not finish its move. Retry to continue.';
			};
			worker.postMessage({ id: position.ply, state: $state.snapshot(position), difficulty: level });
			return () => {
				active = false;
				worker.terminate();
				clearTimeout(watchdog);
				clearTimeout(finishTimer);
				thinking = false;
			};
		});
	});
	function exportSnapshot() {
		if (!game) throw Error('No game');
		return {
			moves: history,
			result,
			date: startedAt,
			white: player === 'w' ? 'You' : `Computer (${difficulties[difficulty].label})`,
			black: player === 'b' ? 'You' : `Computer (${difficulties[difficulty].label})`
		};
	}
</script>

<svelte:head><title>Play computer · 4D chess</title></svelte:head>
{#snippet computerActions()}{#if result}<div class="computer-settings">
			<SideToggle
				bind:value={
					() => (setupSide === 'w' ? 'white' : 'black'),
					(side) => {
						setupSide = side === 'white' ? 'w' : 'b';
					}
				}
			/><SelectField
				label="Difficulty"
				bind:value={setupDifficulty}
				options={levelOptions}
			/><Button variant="primary" onclick={start}>New game</Button>
		</div>{:else}<Button onclick={resign}>Resign</Button>{/if}{/snippet}
<main class="shell match-shell">
	{#if !ready}<LoadingScreen label="Loading computer game" />
	{:else if game}<GameAudio
			gameKey={String(startedAt)}
			board={game.board}
			turn={game.turn}
			ply={game.ply}
			active={!result}
			{result}
			lastMove={history.at(-1) ?? null}
			seat={player}
			audible={reviewPly === null}
		/>
		<GameOverDialog {result} side={player === 'w' ? 'white' : 'black'} gameKey={String(startedAt)}
			><Button variant="primary" onclick={start}>New game</Button></GameOverDialog
		>
		<div class="match-layout">
			<div class="match-position board-stage">
				<PlayerProfile
					name={'Computer (' + difficulties[difficulty].label + ')'}
					side={player === 'w' ? 'black' : 'white'}
					active={game.turn !== player && !result}
				/>
				<ChessBoard
					winner={reviewPly === null || reviewPly === game.ply ? result?.winner : null}
					showHint={false}
					gameKey={String(startedAt)}
					board={reviewPly === null ? game.board : positions.get(reviewPly)!}
					turn={reviewPly === null ? game.turn : reviewPly % 2 === 0 ? 'w' : 'b'}
					seat={player === 'w' ? 'white' : 'black'}
					enabled={reviewPly === null && !thinking && game.turn === player && !result}
					lastMove={reviewPly === null
						? (history.at(-1) ?? null)
						: (history.find((move) => move.ply === reviewPly) ?? null)}
					onmove={move}
				/>
				<PlayerProfile
					name="You"
					own
					side={player === 'w' ? 'white' : 'black'}
					active={game.turn === player && !result}
				/>
			</div>
			<MatchSidebar finished={!!result} notice={error}>
				{#if error}<div class="notice row" role="alert">
						<p class="error">{error}</p>
						{#if game.turn !== player && !result && !thinking}<Button
								onclick={() => {
									retry++;
								}}>Retry computer</Button
							>{/if}
					</div>{/if}
				<BoardControls />
				{@render computerActions()}
				<MovesPanel
					onexport={() => {
						showExport = true;
						exportDialog.showModal();
					}}
					>{#snippet indicator()}<TurnIndicator
							label={reviewPly !== null
								? 'Reviewing move ' + reviewPly
								: result
									? result.winner
										? (result.winner === 'white' ? 'White' : 'Black') + ' wins'
										: 'Game drawn'
									: (game?.turn === 'w' ? 'White' : 'Black') + ' to move'}
							turn={game?.turn ?? 'w'}
							text={reviewPly !== null
								? `Move ${reviewPly}`
								: result
									? 'Game over'
									: thinking
										? 'Computer is thinking…'
										: game?.turn === player
											? 'Your turn'
											: 'Computer’s turn'}
						/>{/snippet}{#if history.length}<MoveList
							moves={history}
							{positions}
							selectedPly={reviewPly ?? game.ply}
							livePly={game.ply}
							onselect={(ply) => {
								reviewPly = ply === game!.ply ? null : ply;
							}}
						/>{:else}<p class="muted">No moves yet.</p>{/if}</MovesPanel
				><button class="leave-match" onclick={leave}>Leave game</button>
			</MatchSidebar>
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

<style>
	.computer-settings {
		display: grid;
		gap: var(--space-4);
	}
	.computer-settings :global(.side-toggle) {
		display: block;
	}
	.computer-settings :global(legend) {
		float: none;
		margin-bottom: 8px;
	}
	.notice {
		margin-bottom: 16px;
	}
</style>
