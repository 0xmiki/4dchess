<script lang="ts">
	import type { ThreatInspection } from '$lib/chess/threats';
	import { squareAddress } from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	import Button from './Button.svelte';
	let { inspection, onclear }: { inspection: ThreatInspection; onclear: () => void } = $props();
	const enemies = $derived(
		inspection.attackers.filter((i) => inspection.position[i]?.c !== inspection.color)
	);
	const defenders = $derived(
		inspection.attackers.filter((i) => inspection.position[i]?.c === inspection.color)
	);
	const describe = (squares: number[]) =>
		squares
			.map((i) => {
				const p = inspection.position[i]!;
				return `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]} at ${squareAddress(i)}`;
			})
			.join('; ');
</script>

<section class="threat-summary" aria-label="Threat inspection" aria-live="polite">
	<div class="row">
		<strong>Attackers and defenders · {squareAddress(inspection.target)}</strong><Button
			onclick={onclear}>Clear inspection</Button
		>
	</div>
	{#if inspection.preview}<p>
			{squareAddress(inspection.from!)} → {squareAddress(inspection.target)}{inspection.legalMove
				? ''
				: ' · Leaves your king in check'}
		</p>{/if}
	<p>{enemies.length ? `Attacked by: ${describe(enemies)}` : 'No enemy attackers.'}</p>
	{#if defenders.length}<p>Defended by: {describe(defenders)}</p>{/if}
</section>

<style>
	.threat-summary {
		margin-top: 16px;
		border-top: 1px solid var(--line);
		padding-top: 12px;
		font-size: 13px;
		display: grid;
		gap: 8px;
	}
	.row {
		justify-content: space-between;
	}
</style>
