<script lang="ts">
	import { inCheck, type Board, type Color } from '$lib/chess';
	import type { ExportResult } from '$lib/chess/export';
	let {
		board,
		turn,
		result,
		subtitle = '',
		thinking = false,
		heading
	}: {
		board: Board;
		turn: Color;
		result: ExportResult;
		subtitle?: string;
		thinking?: boolean;
		heading?: string;
	} = $props();
	const title = $derived(
		heading ??
			(result
				? result.winner
					? `${result.winner === 'white' ? 'White' : 'Black'} wins`
					: 'Game drawn'
				: thinking
					? `${turn === 'w' ? 'White' : 'Black'} is thinking…`
					: `${turn === 'w' ? 'White' : 'Black'} ${inCheck(board, turn) ? 'in check' : 'to move'}`)
	);
	const ending = $derived.by(() => {
		if (result?.reason === 'checkmate') return 'Checkmate.';
		if (result?.reason === 'resignation')
			return `${result.winner === 'white' ? 'Black' : 'White'} resigned.`;
		if (result?.reason === 'draw')
			return (
				(
					{
						stalemate: 'Stalemate.',
						repetition: 'Third repetition of the position.',
						fiftyMove: '100 halfmoves without a pawn move or capture.',
						bareKings: 'Only the two kings remain.'
					} as Record<string, string>
				)[result.detail ?? ''] ?? 'Game drawn.'
			);
		return '';
	});
</script>

<div aria-live="polite" aria-atomic="true">
	<h1>{title}</h1>
	{#if ending || subtitle}<p class="muted">{ending || subtitle}</p>{/if}
</div>
