<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import { resolve } from '$app/paths';
	let { onclose }: { onclose?: () => void } = $props();
	let modal: ReturnType<typeof Modal>;
	export function showModal() {
		modal.showModal();
	}
	export function close() {
		modal.close();
	}
</script>

<Modal bind:this={modal} title="4D chess rules" {onclose}>
	<div class="stack">
		<a href={resolve('/how-to-play')}>Open the interactive guide</a>
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
		<Button onclick={() => modal.close()}>Close rules</Button>
	</div>
</Modal>

<style>
	dt {
		font-weight: 650;
		margin-top: 10px;
	}
	dd {
		margin: 2px 0 10px;
	}
</style>
