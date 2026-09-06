<script lang="ts">
	import {
		legalMoves,
		inCheck,
		squareIndex,
		squareCoordinates,
		squareAddress,
		type Board,
		type Move
	} from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	import SpatialBoard from './SpatialBoard.svelte';
	let {
		board,
		turn,
		seat,
		enabled,
		lastMove = null,
		onmove
	}: {
		board: Board;
		turn: 'w' | 'b';
		seat: 'white' | 'black';
		enabled: boolean;
		lastMove?: Move | null;
		onmove: (move: Move) => void;
	} = $props();
	let selected = $state<number | null>(null);
	const moves = $derived(selected !== null && enabled ? legalMoves(board, turn, selected) : []);
	const check = $derived(inCheck(board, turn));
	const flipped = $derived(seat === 'black');
	const xs = $derived(flipped ? [3, 2, 1, 0] : [0, 1, 2, 3]);
	const ys = $derived(flipped ? [0, 1, 2, 3] : [3, 2, 1, 0]);
	$effect(() => {
		void board;
		void enabled;
		selected = null;
	});
	function select(i: number) {
		if (!enabled) return;
		const move = moves.find((m) => m.to === i);
		if (move) {
			selected = null;
			onmove(move);
			return;
		}
		selected = selected === i ? null : board[i]?.c === turn ? i : null;
	}
	function navigate(event: KeyboardEvent, i: number) {
		if (event.key === 'Escape') {
			selected = null;
			return;
		}
		if (!event.key.startsWith('Arrow')) return;
		const c = [...squareCoordinates(i)];
		const axis = event.altKey ? 2 : 0;
		const step = flipped ? -1 : 1;
		if (event.key === 'ArrowLeft') c[axis] -= step;
		if (event.key === 'ArrowRight') c[axis] += step;
		if (event.key === 'ArrowUp') c[axis + 1] += step;
		if (event.key === 'ArrowDown') c[axis + 1] -= step;
		event.preventDefault();
		if (c.every((v, a) => v >= 0 && v < [4, 4, 2, 2][a])) {
			const index = squareIndex([c[0], c[1], c[2], c[3]]);
			(event.currentTarget as HTMLElement)
				.closest('.slice-grid')
				?.querySelector<HTMLButtonElement>(`[data-square="${index}"]`)
				?.focus();
		}
	}
</script>

<div class="workspace">
	<section aria-label="Chess boards">
		<div class="slice-grid">
			<div></div>
			{#each flipped ? [1, 0] : [0, 1] as z (z)}<div class="z-label">Z = {z}</div>{/each}
			{#each flipped ? [0, 1] : [1, 0] as w (w)}
				<div class="axis-w">W = {w}</div>
				{#each flipped ? [1, 0] : [0, 1] as z (z)}
					<div class="slice">
						<div class="board-wrap">
							<div class="ranks" aria-hidden="true">
								{#each ys as y (y)}<span>{y + 1}</span>{/each}
							</div>
							<div class="board" role="group" aria-label={`Board Z ${z}, W ${w}`}>
								{#each ys as y (y)}{#each xs as x (x)}
										{@const i = squareIndex([x, y, z, w])}{@const p = board[i]}{@const legal =
											moves.some((m) => m.to === i)}
										<button
											type="button"
											class="cell"
											class:dark={(x + y) % 2 === 0}
											class:selected={selected === i}
											class:legal
											class:capture={legal && !!p}
											class:last={lastMove?.from === i || lastMove?.to === i}
											class:checked={p?.t === 'k' && p.c === turn && check}
											data-square={i}
											aria-label={`${squareAddress(i)}, ${p ? `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]}` : 'empty'}${legal ? ', legal destination' : ''}`}
											aria-pressed={selected === i}
											aria-disabled={!enabled}
											onclick={() => select(i)}
											onkeydown={(e) => navigate(e, i)}
										>
											{#if p}<svg
													class="piece"
													class:white={p.c === 'w'}
													class:black={p.c === 'b'}
													viewBox="0 0 64 64"
													aria-hidden="true"><use href={`/pieces.svg#piece-${p.t}`} /></svg
												>{/if}
										</button>
									{/each}{/each}
							</div>
						</div>
						<div class="files" aria-hidden="true">
							{#each xs as x (x)}<span>{'abcd'[x]}</span>{/each}
						</div>
					</div>
				{/each}
			{/each}
		</div>
		{#if selected !== null && board[selected]}<p class="inspection">
				{pieceNames[board[selected]!.t]} · {squareAddress(selected)} · {moves.length} legal moves
			</p>{/if}
	</section>
	<SpatialBoard {board} {selected} {moves} {lastMove} onselect={select} />
</div>

<style>
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
		align-items: start;
		gap: 40px;
	}
	.slice-grid {
		display: grid;
		grid-template-columns: 20px 1fr 1fr;
		gap: 14px 18px;
	}
	.z-label {
		text-align: center;
		font-size: 12px;
		color: #546251;
	}
	.axis-w {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		text-align: center;
		font-size: 12px;
		color: #546251;
	}
	.board-wrap {
		position: relative;
		padding-left: 13px;
	}
	.ranks {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		display: grid;
		grid-template-rows: repeat(4, 1fr);
		align-items: center;
		font-size: 10px;
		color: #62705e;
	}
	.board {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		aspect-ratio: 1;
		border: 1px solid #98a88f;
	}
	.cell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		min-height: 0;
		min-width: 0;
		border: 0;
		border-radius: 0;
		padding: 0;
		background: #e7ebdf;
	}
	.cell.dark {
		background: #a9bda0;
	}
	.cell.last {
		background: #d2d7a5;
	}
	.cell.last.dark {
		background: #b9c48d;
	}
	.cell:hover {
		background: #c7d3ba;
	}
	.cell.selected {
		background: #e8c27d;
	}
	.cell.checked {
		background: #dfa893;
	}
	.cell.legal::after {
		content: '';
		position: absolute;
		width: 20%;
		height: 20%;
		border-radius: 50%;
		background: #2d603ba6;
		pointer-events: none;
	}
	.cell.capture::after {
		width: 87%;
		height: 87%;
		background: none;
		border: 3px solid #ac4e2e;
	}
	.cell:focus-visible {
		outline: 3px solid #b7672c;
		outline-offset: -3px;
		z-index: 1;
	}
	.piece {
		width: 76%;
		height: 76%;
		max-width: 72px;
		overflow: visible;
		pointer-events: none;
	}
	.white {
		color: #fff9e8;
		--stroke: #405344;
		--detail: #405344;
	}
	.black {
		color: #284739;
		--stroke: #1c3228;
		--detail: #bed0b6;
	}
	.files {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 4px 0 0 13px;
		text-align: center;
		font-size: 10px;
		color: #62705e;
	}
	.inspection {
		margin-top: 12px;
		color: #546251;
		font-size: 13px;
		text-transform: capitalize;
	}
	@media (max-width: 1000px) {
		.workspace {
			grid-template-columns: minmax(0, 640px);
			justify-content: center;
			gap: 28px;
		}
	}
	@media (max-width: 500px) {
		.slice-grid {
			grid-template-columns: 14px 1fr 1fr;
			gap: 12px 6px;
		}
	}
</style>
