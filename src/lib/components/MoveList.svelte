<script lang="ts">
	import { squareAddress, squareCoordinates, type Piece } from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	let {
		moves
	}: {
		moves: readonly {
			ply: number;
			from: number;
			to: number;
			piece: Piece;
			captured: Piece | null;
		}[];
	} = $props();
</script>

<ol class="moves">
	{#each moves as move (move.ply)}<li>
			<span>{move.ply}.</span>
			<div>
				<strong
					>{move.piece.c === 'w' ? 'White' : 'Black'}
					{pieceNames[move.piece.t]}{move.captured ? ` × ${pieceNames[move.captured.t]}` : ''}{move
						.piece.t === 'p' && squareCoordinates(move.to)[1] === (move.piece.c === 'w' ? 3 : 0)
						? ' → queen'
						: ''}</strong
				><small>{squareAddress(move.from)} → {squareAddress(move.to)}</small>
			</div>
		</li>{/each}
</ol>

<style>
	.moves {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 12px;
	}
	.moves li {
		display: flex;
		gap: 14px;
		border-bottom: 1px solid var(--line);
		padding-bottom: 12px;
	}
	.moves small {
		display: block;
		color: var(--muted);
	}
</style>
