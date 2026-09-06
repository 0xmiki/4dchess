<script lang="ts">
	import { onMount } from 'svelte';
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	import SideToggle from './SideToggle.svelte';
	import Piece from './Piece.svelte';
	import {
		createInitialState,
		squareIndex,
		simulateMove,
		type Board,
		type Move,
		type Piece as ChessPiece,
		type PieceType
	} from '$lib/chess';
	import { lessons, lessonOrder, type Lesson } from '$lib/guide/lessons';
	import ChessBoard from './ChessBoard.svelte';
	import Button from './Button.svelte';
	import SelectField from './SelectField.svelte';
	let placing = $state(false),
		placementSide = $state<'white' | 'black'>('white');
	let step = $state(0),
		free = $state(false),
		piece = $state<PieceType>('r');
	const lesson = $derived(lessons[lessonOrder[step]]);
	const descriptions: Record<PieceType, string> = {
		r: 'A rook can move straight onto another board. Try the same square in the board above.',
		b: 'A bishop moves diagonally. Try moving one square sideways while switching boards.',
		n: 'A knight jumps two squares one way and one another. Its short step can take it to another board.',
		q: 'A queen moves straight or diagonally, including between boards.',
		k: 'A king can move one step in any direction, including onto another board.',
		p: 'A pawn moves toward the far edge. It can switch boards as it advances, and captures diagonally.'
	};
	function example(type: PieceType): Board {
		const entry: Lesson = lessons[type];
		const board: (ChessPiece | null)[] = Array(64).fill(null);
		board[squareIndex(entry.from)] = { t: type, c: 'w' };
		if (entry.capture) board[squareIndex(entry.four)] = { t: 'r', c: 'b' };
		return board;
	}
	let board = $state<Board>(example('r')),
		history = $state<Board[]>([]),
		lastMove = $state<Move | null>(null),
		feedback = $state('');
	const target = $derived(squareIndex(lesson.four));
	const complete = $derived(!free && !!board[target] && board[target]?.c === 'w');
	function reset(full = false) {
		placing = false;
		board = full ? createInitialState().board : example(free ? piece : lessonOrder[step]);
		history = [];
		lastMove = null;
		feedback = '';
	}
	function chooseStep(next: number) {
		step = next;
		reset();
	}
	function move(move: Move) {
		history = [...history, board];
		board = simulateMove(board, move);
		lastMove = move;
		feedback = free
			? 'Move played.'
			: move.to === target
				? 'That’s it. The piece moved between boards.'
				: 'Move played. Can you reach the outlined square?';
	}
	function undo() {
		const before = history.at(-1);
		if (before) {
			board = before;
			history = history.slice(0, -1);
			lastMove = null;
			feedback = '';
		}
	}
	function place(square: number) {
		history = [...history, board];
		const next = board.slice();
		next[square] = { t: piece, c: placementSide === 'white' ? 'w' : 'b' };
		board = next;
		lastMove = null;
		feedback = 'Piece placed.';
	}
	function startingSquare() {
		const color = placementSide === 'white' ? 'w' : 'b';
		const start = createInitialState().board.findIndex(
			(p, i) => p?.t === piece && p.c === color && !board[i]
		);
		if (start < 0) {
			feedback =
				'The starting squares for that piece are occupied. Choose any square on the board.';
			return;
		}
		place(start);
	}
</script>

<section class="guide match-layout" aria-label="Learn and practice">
	<aside class="game-info learning-tools">
		<div class="mode-switch" aria-label="Learning mode">
			<button
				disabled={!ready}
				class:chosen={!free}
				aria-pressed={!free}
				onclick={() => {
					free = false;
					reset();
				}}>Lessons</button
			><button
				disabled={!ready}
				class:chosen={free}
				aria-pressed={free}
				onclick={() => {
					free = true;
					reset();
				}}>Free practice</button
			>
		</div>
		{#if free}
			<h1>Free practice</h1>
			<div class="mode-switch" aria-label="Practice tool">
				<button
					class:chosen={!placing}
					aria-pressed={!placing}
					onclick={() => {
						placing = false;
						feedback = '';
					}}>Move pieces</button
				><button
					class:chosen={placing}
					aria-pressed={placing}
					onclick={() => {
						placing = true;
						feedback = '';
					}}>Place pieces</button
				>
			</div>
			{#if placing}
				<SideToggle label="Color" bind:value={placementSide} />
				<div class="piece-palette" aria-label="Piece to place">
					{#each lessonOrder as type (type)}<button
							title={lessons[type].name}
							aria-label={lessons[type].name}
							aria-pressed={piece === type}
							class:chosen={piece === type}
							onclick={() => {
								piece = type;
								feedback = '';
							}}
							><Piece
								onDark
								piece={{ t: type, c: placementSide === 'white' ? 'w' : 'b' }}
								size={32}
							/><span>{lessons[type].name}</span></button
						>{/each}
				</div>
				<p role="status">{feedback || 'Click any square to place the selected piece.'}</p>
				<button class="tool-action" onclick={startingSquare}>Starting square</button>
			{:else}<p role="status">{feedback || 'Move either color. Turns and king safety are off.'}</p>
				<button class="tool-action" onclick={() => reset(true)}>Full position</button>{/if}
		{:else}
			<SelectField
				label="Piece"
				options={lessonOrder.map((value) => ({ value, label: lessons[value].name }))}
				bind:value={() => lessonOrder[step], (value) => chooseStep(lessonOrder.indexOf(value))}
			/>
			<h1>{lesson.name}: try a move</h1>
			<p>{descriptions[lessonOrder[step]]}</p>
			<p role="status">{feedback || 'Move to the outlined square.'}</p>
			<button
				class="tool-action"
				onclick={() => {
					reset();
					move({ from: squareIndex(lesson.from), to: target });
				}}>Show move</button
			>
			{#if complete && step < lessonOrder.length - 1}<Button onclick={() => chooseStep(step + 1)}
					>Next lesson</Button
				>{/if}
		{/if}
		{#if history.length}<div class="edit-actions">
				<button class="tool-action" onclick={undo}>Undo</button><button
					class="tool-action"
					onclick={() => reset()}>Reset</button
				>
			</div>{/if}
	</aside>
	<div class="match-position">
		<ChessBoard
			{board}
			turn="w"
			seat="white"
			enabled
			practice
			onplace={free && placing ? place : undefined}
			goalSquare={free ? null : target}
			{lastMove}
			onmove={move}
		/>
	</div>
</section>

<style>
	.guide .game-info {
		grid-column: 2;
		grid-row: 1;
		align-self: start;
		gap: var(--space-4);
	}
	.guide .match-position {
		grid-column: 1;
		grid-row: 1;
	}
	h1 {
		font-size: 22px;
		line-height: 1.2;
	}
	p {
		font-size: 14px;
		color: var(--muted);
		margin: 0;
	}
	.mode-switch {
		display: flex;
		padding: 4px;
		background: var(--surface);
		border-radius: var(--radius-control);
	}
	.mode-switch button {
		flex: 1;
		min-height: 36px;
		padding: 6px;
		color: var(--muted);
		border-radius: 8px;
		cursor: pointer;
		font-size: 13px;
	}
	.mode-switch .chosen {
		background: var(--line);
		color: var(--text);
	}
	.learning-tools :global(.side-toggle) {
		display: block;
	}
	.learning-tools :global(legend) {
		float: none;
		margin-bottom: 8px;
	}
	.piece-palette {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-1);
	}
	.piece-palette button {
		display: grid;
		place-items: center;
		gap: 4px;
		min-height: 62px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 11px;
		color: var(--muted);
	}
	.piece-palette .chosen {
		background: var(--line);
		color: var(--text);
	}
	.tool-action {
		min-height: 36px;
		padding: 8px 12px;
		background: var(--surface);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text);
	}
	.tool-action:hover,
	.piece-palette button:hover {
		background: var(--surface-raised);
	}
	.edit-actions {
		display: flex;
		gap: 8px;
	}
	.edit-actions button {
		flex: 1;
	}
	@media (max-width: 850px) {
		.learning-tools {
			max-width: 420px;
		}
		.piece-palette {
			grid-template-columns: repeat(6, 1fr);
		}
	}
</style>
