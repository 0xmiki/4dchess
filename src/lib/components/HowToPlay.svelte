<script lang="ts">
	import { onMount } from 'svelte';
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	import BackToPlay from './BackToPlay.svelte';
	import SideToggle from './SideToggle.svelte';
	import {
		createInitialState,
		squareIndex,
		simulateMove,
		type Board,
		type Move,
		type Piece,
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
		const board: (Piece | null)[] = Array(64).fill(null);
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
		feedback = 'Piece placed. Choose another square or finish placing.';
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
	<aside class="game-info">
		<div class="lesson-top">
			<BackToPlay />
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
		</div>
		<div class="lesson-heading">
			<div>
				<p class="muted">
					{free
						? 'Move either side. No turns or check restrictions.'
						: `Lesson ${step + 1} of ${lessonOrder.length}`}
				</p>
				<h1>{free ? 'Free practice' : `${lesson.name}: try a move`}</h1>
				<p>
					{free ? 'Select a piece, then choose a marked square.' : descriptions[lessonOrder[step]]}
				</p>
			</div>
			<div class="lesson-controls">
				{#if free}<Button
						onclick={() => {
							placing = !placing;
							feedback = '';
						}}>Add piece</Button
					><Button onclick={() => reset(true)}>Full position</Button>{:else}<label
						class="lesson-picker"
						>Lesson<select
							aria-label="Lesson"
							value={lessonOrder[step]}
							onchange={(event) =>
								chooseStep(lessonOrder.indexOf(event.currentTarget.value as PieceType))}
							>{#each lessonOrder as type (type)}<option value={type}>{lessons[type].name}</option
								>{/each}</select
						></label
					>{/if}
				{#if history.length}<Button onclick={undo}>Undo</Button><Button onclick={() => reset()}
						>Reset</Button
					>{/if}
			</div>
		</div>
		{#if !free}<div class="lesson-progress">
				<p role="status">{feedback || 'Move the White piece to the outlined square.'}</p>
				<div class="row">
					<Button
						onclick={() => {
							reset();
							move({ from: squareIndex(lesson.from), to: target });
						}}>Show move</Button
					>{#if complete && step < lessonOrder.length - 1}<Button
							variant="primary"
							onclick={() => chooseStep(step + 1)}>Next lesson</Button
						>{/if}
				</div>
			</div>{:else}<p role="status" class="practice-feedback">{feedback}</p>{/if}
		{#if free && placing}<div class="placement-tools">
				<SelectField
					label="Piece"
					bind:value={piece}
					options={lessonOrder.map((value) => ({ value, label: lessons[value].name }))}
				/><SideToggle label="Piece color" bind:value={placementSide} /><Button
					onclick={startingSquare}>Starting square</Button
				><Button
					onclick={() => {
						placing = false;
						feedback = '';
					}}>Done placing</Button
				>
				<p>Click any square to place the piece. Undo restores anything replaced.</p>
			</div>{/if}

		<details class="extra-rules">
			<summary>How do I win? What are the special rules?</summary>
			<p>
				Checkmate the other king: attack it so it has no safe escape. In a match, take turns and
				keep your own king safe.
			</p>
			<p>
				Pawns promote to queens at the far edge. There is no castling, en passant, or opening
				two-square pawn move. Draws include stalemate, three repetitions, 100 halfmoves without a
				pawn move or capture, and only two kings remaining.
			</p>
		</details>
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
		position: sticky;
		top: var(--play-space);
		max-height: calc(100svh - 2 * var(--play-space));
		overflow: auto;
		padding: 2px;
	}
	.guide .match-position {
		grid-column: 1;
		grid-row: 1;
	}
	.lesson-top,
	.lesson-heading,
	.lesson-controls,
	.lesson-progress,
	.placement-tools {
		display: grid;
		gap: var(--space-3);
	}
	.lesson-heading {
		gap: var(--space-5);
	}
	h1 {
		font-size: 24px;
		line-height: 1.2;
		margin: var(--space-2) 0;
	}
	p {
		font-size: 14px;
	}
	.mode-switch {
		display: flex;
		padding: 4px;
		background: var(--surface);
		border-radius: var(--radius-control);
	}
	.mode-switch button {
		flex: 1;
		min-height: 40px;
		padding: 8px;
		color: var(--muted);
		cursor: pointer;
		border-radius: 8px;
	}
	.mode-switch .chosen {
		background: var(--line);
		color: var(--text);
	}
	.lesson-picker {
		display: grid;
		gap: 8px;
		font-size: 14px;
	}
	.lesson-picker select {
		min-height: 44px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		padding: 8px 12px;
		color: var(--text);
	}
	.placement-tools {
		padding: var(--space-3);
		background: var(--surface);
		border-radius: var(--radius-control);
	}
	.placement-tools :global(.side-toggle) {
		display: block;
	}
	.placement-tools :global(legend) {
		float: none;
		margin-bottom: 8px;
	}
	.extra-rules {
		font-size: 14px;
		color: var(--muted);
	}
	.extra-rules summary {
		cursor: pointer;
	}
	.extra-rules p {
		margin-top: var(--space-3);
	}
	@media (max-width: 850px) {
		.guide .game-info {
			position: static;
			max-height: none;
			overflow: visible;
		}
		.lesson-controls {
			display: flex;
			flex-wrap: wrap;
			align-items: end;
		}
		.lesson-heading {
			gap: var(--space-3);
		}
	}
</style>
