<script lang="ts">
	import GameOutcome from '$lib/components/GameOutcome.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import BackToPlay from '$lib/components/BackToPlay.svelte';
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
	import Button from '$lib/components/Button.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import GameMenu from '$lib/components/GameMenu.svelte';
	import GameStatus from '$lib/components/GameStatus.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import RulesDialog from '$lib/components/RulesDialog.svelte';
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
	let menu = $state<ReturnType<typeof GameMenu>>();
	let rules: ReturnType<typeof RulesDialog>,
		newDialog: ReturnType<typeof Modal>,
		historyDialog: ReturnType<typeof Modal>,
		exportDialog: ReturnType<typeof Modal>;
	const sideOptions = [
		{ value: 'w', label: 'White' },
		{ value: 'b', label: 'Black' }
	] as const;
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
				player = saved.player;
				difficulty = saved.difficulty;
				setupSide = player;
				setupDifficulty = difficulty;
				history = restored;
				startedAt = Number.isFinite(saved.startedAt) ? saved.startedAt : Date.now();
				game = state;
			}
		} catch {
			error = 'The saved computer game could not be restored. Start a new game.';
		}
		if (!game) {
			const requested = new URL(location.href).searchParams.get('side');
			setupSide = requested === 'b' ? 'b' : 'w';
			start();
		}
		const visibility = () => {
			hidden = document.hidden;
		};
		document.addEventListener('visibilitychange', visibility);
		return () => document.removeEventListener('visibilitychange', visibility);
	});
	function save() {
		try {
			localStorage.setItem(
				'fourfold-computer-v1',
				JSON.stringify({
					version: 1,
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
		player = setupSide;
		difficulty = setupDifficulty;
		history = [];
		startedAt = Date.now();
		error = '';
		game = createInitialState();
		save();
	}
	function move(move: Move) {
		if (!game) return;
		const before = game;
		const applied = applyMove(before, move);
		if (!applied.ok) {
			error = 'That move could not be played.';
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
	}
	$effect(() => {
		const position = game,
			side = player,
			level = difficulty,
			isHidden = hidden,
			isReady = ready;
		void retry;
		if (!position || position.result || position.turn === side || isHidden || !isReady) return;
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
					Math.max(0, 380 - (performance.now() - startTime))
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
	function newGame() {
		setupSide = player;
		setupDifficulty = difficulty;
		menu?.close();
		newDialog.showModal();
	}
	function exportSnapshot() {
		if (!game) throw Error('No game');
		return {
			moves: history,
			result: game.result,
			date: startedAt,
			white: player === 'w' ? 'You' : `Computer (${difficulties[difficulty].label})`,
			black: player === 'b' ? 'You' : `Computer (${difficulties[difficulty].label})`
		};
	}
</script>

<svelte:head><title>Play computer · 4D chess</title></svelte:head>
<main class="shell match-shell">
	{#if !ready}<LoadingScreen label="Loading computer game" />
	{:else if !game}<section class="flow" aria-label="Computer game settings">
			<h1>Play computer</h1>
			<SelectField label="Your side" bind:value={setupSide} options={sideOptions} /><SelectField
				label="Difficulty"
				bind:value={setupDifficulty}
				options={levelOptions}
			/><Button variant="primary" onclick={start}>Start game</Button>{#if error}<p
					class="error"
					role="alert"
				>
					{error}
				</p>{/if}
		</section>
	{:else}<div class="match-layout">
			<div class="match-position">
				<ChessBoard
					board={game.board}
					turn={game.turn}
					seat={player === 'w' ? 'white' : 'black'}
					enabled={!thinking && game.turn === player && !game.result}
					lastMove={history.at(-1) ?? null}
					onmove={move}
				/>
			</div>
			<aside class="game-info">
				<div class="computer-status row">
					<GameStatus
						board={game.board}
						turn={game.turn}
						result={game.result}
						{thinking}
						subtitle={`You are ${player === 'w' ? 'White' : 'Black'} · ${difficulties[difficulty].label}`}
					/>
				</div>
				{#if error}<div class="notice row" role="alert">
						<p class="error">{error}</p>
						{#if game.turn !== player && !game.result && !thinking}<Button
								onclick={() => {
									retry++;
								}}>Retry computer</Button
							>{/if}
					</div>{/if}
				<GameOutcome result={game.result} side={player === 'w' ? 'white' : 'black'} />
				<footer class="game-tools">
					<BackToPlay />{#if game}<Button onclick={newGame}>New game</Button
						>{/if}{#if game}<GameMenu bind:this={menu}
							><Button
								onclick={() => {
									menu?.close();
									rules.showModal();
								}}>Rules</Button
							>{#if history.length}<Button
									onclick={() => {
										menu?.close();
										historyDialog.showModal();
									}}>Move history</Button
								>{/if}<Button
								onclick={() => {
									menu?.close();
									showExport = true;
									exportDialog.showModal();
								}}>Export game</Button
							></GameMenu
						>{/if}
				</footer>
				{#if history.length}<section class="side-moves" aria-label="Recent moves">
						<h2>Moves</h2>
						<MoveList moves={[...history].reverse().slice(0, 8)} />
					</section>{/if}
			</aside>
		</div>
	{/if}
</main>
<RulesDialog bind:this={rules} onclose={() => menu?.focus()} />
<Modal bind:this={newDialog} title="Start a new computer game?"
	><div class="stack">
		<p>The current game will be replaced.</p>
		<SelectField label="Your side" bind:value={setupSide} options={sideOptions} /><SelectField
			label="Difficulty"
			bind:value={setupDifficulty}
			options={levelOptions}
		/>
		<div class="row">
			<Button onclick={() => newDialog.close()}>Keep playing</Button><Button
				variant="primary"
				onclick={() => {
					newDialog.close();
					start();
				}}>Start new game</Button
			>
		</div>
	</div></Modal
>
<Modal bind:this={historyDialog} title="Move history" onclose={() => menu?.focus()}
	><MoveList moves={[...history].reverse()} /><Button onclick={() => historyDialog.close()}
		>Close history</Button
	></Modal
>
<Modal
	bind:this={exportDialog}
	title="Export game"
	onclose={() => {
		showExport = false;
		menu?.focus();
	}}
	>{#if showExport}<ExportGame load={exportSnapshot} />{/if}<Button
		onclick={() => exportDialog.close()}>Close export</Button
	></Modal
>

<style>
	.computer-status {
		justify-content: space-between;
		margin-bottom: 24px;
	}
	.notice {
		margin-bottom: 16px;
	}
</style>
