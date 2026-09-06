<script lang="ts">
	import { resolve } from '$app/paths';
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
</script>

<section class="guide" aria-label="Learn and practice">
	<div class="lesson-top">
		<a href={resolve('/')}>Back to play</a>
		<div class="mode-switch" aria-label="Learning mode">
			<button
				class:chosen={!free}
				aria-pressed={!free}
				onclick={() => {
					free = false;
					reset();
				}}>Lessons</button
			><button
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
			{#if free}<SelectField
					label="Piece"
					bind:value={piece}
					options={lessonOrder.map((value) => ({ value, label: lessons[value].name }))}
					onchange={() => reset()}
				/><Button onclick={() => reset(true)}>Full position</Button>{:else}<label
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
	<ChessBoard
		{board}
		turn="w"
		seat="white"
		enabled
		practice
		goalSquare={free ? null : target}
		{lastMove}
		onmove={move}
	/>
	<details class="extra-rules">
		<summary>How do I win? What are the special rules?</summary>
		<p>
			Checkmate the other king: attack it so it has no safe escape. In a match, take turns and keep
			your own king safe.
		</p>
		<p>
			Pawns promote to queens at the far edge. There is no castling, en passant, or opening
			two-square pawn move. Draws include stalemate, three repetitions, 100 halfmoves without a pawn
			move or capture, and only two kings remaining.
		</p>
	</details>
</section>

<style>
	.lesson-progress :global(button) {
		min-height: 36px;
		padding: 8px 12px;
		box-shadow: none;
		white-space: nowrap;
	}
	.lesson-picker {
		display: grid;
		gap: 6px;
		font-size: 14px;
	}
	.lesson-picker select {
		min-height: 48px;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		padding: 8px 32px 8px 12px;
	}
	.lesson-top,
	.lesson-heading,
	.lesson-progress {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		margin-bottom: var(--space-5);
	}
	.lesson-top > a {
		color: var(--muted);
		font-size: 14px;
	}
	.mode-switch {
		display: flex;
		padding: var(--space-1);
		background: var(--surface);
		border-radius: var(--radius-control);
	}
	.mode-switch button {
		padding: var(--space-2) var(--space-4);
		min-height: 40px;
		border-radius: 8px;
		cursor: pointer;
		color: var(--muted);
	}
	.mode-switch .chosen {
		background: var(--line);
		color: var(--text);
	}
	h1 {
		font-size: 26px;
		margin: var(--space-1) 0;
	}
	.lesson-heading p {
		max-width: 580px;
	}
	.lesson-controls {
		display: flex;
		align-items: end;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.lesson-progress {
		padding: var(--space-3) 0;
		border-top: 1px solid var(--line);
	}
	.practice-feedback {
		min-height: 24px;
		margin-bottom: var(--space-3);
	}
	.extra-rules {
		margin-top: var(--space-5);
		max-width: 680px;
		color: var(--muted);
	}
	.extra-rules summary {
		cursor: pointer;
		padding: var(--space-3) 0;
	}
	.extra-rules p {
		margin-bottom: var(--space-3);
	}
	@media (max-width: 800px) {
		.lesson-heading {
			align-items: flex-start;
			flex-direction: column;
		}
		.lesson-top {
			gap: var(--space-2);
		}
		.mode-switch button {
			padding: var(--space-2);
		}
	}
</style>
