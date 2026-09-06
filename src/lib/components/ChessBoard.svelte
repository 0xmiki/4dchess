<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		legalMoves,
		inCheck,
		squareIndex,
		squareCoordinates,
		squareAddress,
		simulateMove,
		type Board,
		type Move
	} from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	import SpatialBoard from './SpatialBoard.svelte';
	import Piece from './Piece.svelte';
	import Button from './Button.svelte';
	import ThreatSummary from './ThreatSummary.svelte';
	import FlatOverlays from './FlatOverlays.svelte';
	import { analyzeThreats, type ThreatInspection } from '$lib/chess/threats';
	import type { PresentedMove, PieceMotion } from './motion';
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
		lastMove?: PresentedMove | null;
		onmove: (move: Move) => void;
	} = $props();
	let selected = $state<number | null>(null);
	let inspection = $state<ThreatInspection | null>(null),
		motion = $state<PieceMotion | null>(null),
		reduced = $state(false);
	let gridRoot = $state<HTMLElement>();
	let previous: Board | null = null,
		before: Board | null = null,
		lastAnimation = '',
		frame = 0;
	let held = false,
		holdTimer: ReturnType<typeof setTimeout> | undefined,
		holdPoint: { x: number; y: number } | null = null;
	const shown = $derived.by(() => {
		if (inspection) return inspection.position;
		if (motion) {
			const visible = board.slice();
			visible[motion.to] = motion.captured;
			return visible;
		}
		return board;
	});
	onMount(() => {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		reduced = preference.matches;
		const changed = () => {
			reduced = preference.matches;
			if (reduced) stopMotion();
		};
		const visibility = () => {
			if (document.hidden) stopMotion();
		};
		preference.addEventListener('change', changed);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			stopMotion();
			clearTimeout(holdTimer);
			preference.removeEventListener('change', changed);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
	function stopMotion() {
		cancelAnimationFrame(frame);
		motion = null;
	}
	$effect(() => {
		const current = board,
			recent = lastMove,
			skip = reduced;
		if (current !== previous) {
			before = previous;
			previous = current;
		}
		if (!recent) {
			lastAnimation = '';
			untrack(stopMotion);
			return;
		}
		if (!before?.[recent.from]) return;
		const key = `${recent.ply ?? ''}:${recent.from}:${recent.to}`;
		if (key === lastAnimation) return;
		const simulated = simulateMove(before, recent);
		if (!simulated.every((p, i) => p?.c === current[i]?.c && p?.t === current[i]?.t)) return;
		lastAnimation = key;
		const moving = before[recent.from]!,
			captured = before[recent.to];
		untrack(() => {
			stopMotion();
			if (skip || document.hidden) return;
			const start = performance.now();
			motion = { ...recent, piece: moving, captured, progress: 0 };
			const tick = (now: number) => {
				const t = Math.min(1, (now - start) / 360);
				if (t >= 1) {
					motion = null;
					return;
				}
				motion = { ...recent, piece: moving, captured, progress: t * t * (3 - 2 * t) };
				frame = requestAnimationFrame(tick);
			};
			frame = requestAnimationFrame(tick);
		});
	});
	function inspect(i: number) {
		if (motion) return;
		inspection = inspection?.target === i ? null : analyzeThreats(board, turn, i, selected);
	}
	function hold(event: PointerEvent, i: number) {
		if (event.pointerType === 'mouse') {
			holdPoint = null;
			held = false;
			return;
		}
		held = false;
		holdPoint = { x: event.clientX, y: event.clientY };
		clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			held = true;
			inspect(i);
		}, 500);
	}
	function moveHold(event: PointerEvent) {
		if (holdPoint && Math.hypot(event.clientX - holdPoint.x, event.clientY - holdPoint.y) > 8)
			clearTimeout(holdTimer);
	}
	const moves = $derived(selected !== null && enabled ? legalMoves(board, turn, selected) : []);
	const check = $derived(inCheck(board, turn));
	const flipped = $derived(seat === 'black');
	const xs = $derived(flipped ? [3, 2, 1, 0] : [0, 1, 2, 3]);
	const ys = $derived(flipped ? [0, 1, 2, 3] : [3, 2, 1, 0]);
	$effect(() => {
		void board;
		void enabled;
		selected = null;
		inspection = null;
	});
	function select(i: number) {
		if (held) {
			held = false;
			return;
		}
		inspection = null;
		if (!enabled || motion) return;
		const move = moves.find((m) => m.to === i);
		if (move) {
			selected = null;
			onmove(move);
			return;
		}
		selected = selected === i ? null : board[i]?.c === turn ? i : null;
	}
	function navigate(event: KeyboardEvent, i: number) {
		if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
			event.preventDefault();
			inspect(i);
			return;
		}
		if (event.key === 'Escape') {
			inspection = null;
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
		<div class="slice-grid" bind:this={gridRoot} aria-busy={!!motion}>
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
										{@const i = squareIndex([x, y, z, w])}{@const p = shown[i]}{@const legal =
											!inspection && moves.some((m) => m.to === i)}
										<button
											type="button"
											class="cell"
											class:dark={(x + y) % 2 === 0}
											class:selected={selected === i}
											class:legal
											class:capture={legal && !!p}
											class:last={lastMove?.from === i || lastMove?.to === i}
											class:checked={p?.t === 'k' && p.c === turn && check}
											class:threat-target={inspection?.target === i}
											class:threat-attacker={inspection?.attackers.includes(i)}
											data-square={i}
											aria-label={`${squareAddress(i)}, ${p ? `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]}` : 'empty'}${legal ? ', legal destination' : ''}`}
											aria-pressed={selected === i}
											aria-disabled={!enabled || !!motion}
											title="Right-click, long-press, or Shift+F10 to inspect threats"
											oncontextmenu={(e) => {
												e.preventDefault();
												clearTimeout(holdTimer);
												if (held) return;
												if (holdPoint) held = true;
												inspect(i);
											}}
											onpointerdown={(e) => hold(e, i)}
											onpointermove={moveHold}
											onpointerup={() => clearTimeout(holdTimer)}
											onpointercancel={() => clearTimeout(holdTimer)}
											onclick={() => select(i)}
											onkeydown={(e) => navigate(e, i)}
										>
											{#if p}<Piece
													piece={p}
													opacity={motion?.to === i
														? 1 - Math.max(0, (motion.progress - 0.8) / 0.2)
														: inspection?.preview && inspection.target === i
															? 0.65
															: 1}
												/>{/if}
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
			{#if gridRoot}{#key flipped}<FlatOverlays root={gridRoot} {motion} {inspection} />{/key}{/if}
		</div>
		{#if inspection}<ThreatSummary
				{inspection}
				onclear={() => {
					inspection = null;
				}}
			/>
		{:else if selected !== null && board[selected]}<div class="inspection row">
				<p>
					{pieceNames[board[selected]!.t]} · {squareAddress(selected)} · {moves.length} legal moves
				</p>
				<Button onclick={() => inspect(selected!)}>Inspect threats</Button>
			</div>{/if}
	</section>
	<SpatialBoard
		board={shown}
		{selected}
		moves={inspection ? [] : moves}
		{lastMove}
		{motion}
		{inspection}
		oninspect={inspect}
		onselect={select}
	/>
</div>

<style>
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
		align-items: start;
		gap: 40px;
	}
	.slice-grid {
		position: relative;
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
		cursor: pointer;
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
	.cell.threat-target {
		background: #c9dce6;
	}
	.cell.threat-attacker {
		background: #e9c6b9;
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
