<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import type { ExportResult } from '$lib/chess/export';
	import { playEndSound } from '$lib/end-sound';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
	let { result, side }: { result: ExportResult; side: 'white' | 'black' } = $props();
	const finished = $derived(result && result.reason !== 'cancellation');
	const won = $derived(result?.winner === side);
	let confetti = $state(false),
		seen: string | null | undefined = undefined,
		timer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const key = result ? JSON.stringify(result) : null;
		if (seen === undefined) {
			seen = key;
			return;
		}
		if (seen === key) return;
		seen = key;
		if (!finished) {
			confetti = false;
			clearTimeout(timer);
			return;
		}
		untrack(() => {
			if (result?.reason === 'checkmate') playEndSound(won);
			if (won && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
				confetti = true;
				clearTimeout(timer);
				timer = setTimeout(() => (confetti = false), 2200);
			}
		});
	});
	onDestroy(() => clearTimeout(timer));
</script>

{#if finished}<section class="game-outcome" aria-label="Game over" aria-live="polite">
		{#if won}<TrophyIcon size={36} weight="duotone" aria-hidden="true" />{:else}<FlagIcon
				size={32}
				aria-hidden="true"
			/>{/if}
		<h2>{result?.winner ? (won ? 'You won!' : 'You lost') : 'Draw'}</h2>
		<p>
			{result?.reason === 'checkmate'
				? 'Checkmate.'
				: result?.reason === 'resignation'
					? 'Game ended by resignation.'
					: 'Game drawn.'}
		</p>
	</section>{/if}
{#if confetti}<div class="confetti" aria-hidden="true">
		{#each Array.from({ length: 40 }, (_, i) => i) as i (i)}<i
				style={`--x:${(i * 37) % 100}%;--delay:${(i % 7) * 0.05}s;--turn:${i % 2 ? 450 : -450}deg;--color:${['#e3dbb3', '#e5e5e5', '#a2b9c7', '#aebfa9'][i % 4]}`}
			></i>{/each}
	</div>{/if}

<style>
	.game-outcome {
		padding: var(--space-5);
		background: var(--surface-raised);
		border-radius: var(--radius-panel);
		display: grid;
		gap: var(--space-2);
	}
	.game-outcome h2 {
		font-size: 32px;
		line-height: 1.1;
		font-weight: 800;
	}
	.game-outcome p {
		color: var(--muted);
		font-size: 14px;
	}
	.confetti {
		position: fixed;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 30;
	}
	.confetti i {
		position: absolute;
		left: var(--x);
		top: -20px;
		width: 7px;
		height: 12px;
		background: var(--color);
		animation: fall 1.9s var(--delay) ease-out both;
	}
	@keyframes fall {
		from {
			transform: translateY(-20px) rotate(0);
			opacity: 1;
		}
		to {
			transform: translateY(100vh) rotate(var(--turn));
			opacity: 0;
		}
	}
</style>
