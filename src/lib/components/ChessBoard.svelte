<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		legalMoves,
		canReach,
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
		practice = false,
		goalSquare = null,
		board,
		turn,
		seat,
		enabled,
		lastMove = null,
		onmove
	}: {
		practice?: boolean;
		goalSquare?: number | null;
		board: Board;
		turn: 'w' | 'b';
		seat: 'white' | 'black';
		enabled: boolean;
		lastMove?: PresentedMove | null;
		onmove: (move: Move) => void;
	} = $props();
	let interactiveReady = $state(false);
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
		interactiveReady = true;
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
	const moves = $derived(
		selected !== null && enabled
			? practice
				? Array.from({ length: 64 }, (_, to) => ({ from: selected!, to })).filter((move) =>
						canReach(board, move.from, move.to)
					)
				: legalMoves(board, turn, selected)
			: []
	);
	const check = $derived(!practice && inCheck(board, turn));
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
		selected = selected === i ? null : board[i] && (practice || board[i]?.c === turn) ? i : null;
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
											disabled={!interactiveReady}
											class:lesson-target={goalSquare === i}
											class:dark={(x + y) % 2 === 0}
											class:selected={selected === i}
											class:legal
											class:capture={legal && !!p}
											class:last={lastMove?.from === i || lastMove?.to === i}
											class:checked={p?.t === 'k' && p.c === turn && check}
											class:threat-target={inspection?.target === i}
											class:threat-attacker={inspection?.attackers.includes(i)}
											class:threat-defender={inspection?.attackers.includes(i) &&
												p?.c === inspection.color}
											data-square={i}
											aria-label={`${squareAddress(i)}, ${p ? `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]}` : 'empty'}${legal ? ', legal destination' : ''}${goalSquare === i ? ', lesson destination' : ''}`}
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
	.cell.lesson-target {
		outline: 3px dashed var(--piece-black);
		outline-offset: -5px;
	}
	.z-label,
	.axis-w,
	.ranks,
	.files {
		font-family: var(--font-data);
		font-variant-numeric: tabular-nums;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
		align-items: start;
		gap: var(--space-6);
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
		color: var(--muted);
	}
	.axis-w {
		font-family: var(--font-data);
		color: var(--axis-w);
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		text-align: center;
		font-size: 12px;
		color: var(--axis-w);
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
		font-size: 12px;
		color: var(--muted);
	}
	.board {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		aspect-ratio: 1;
		border: 1px solid var(--line-strong);
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
		background: var(--board-light);
	}
	.cell.dark {
		background: var(--board-dark);
	}
	.cell.last {
		background: var(--board-last-light);
	}
	.cell.last.dark {
		background: var(--board-last-dark);
	}
	.cell:hover {
		background: var(--board-hover);
	}
	.cell.selected {
		background: var(--board-selected);
		box-shadow: inset 0 0 0 3px var(--legal-ink);
	}
	.cell.checked {
		background: var(--board-check);
	}
	.cell.threat-target {
		background: var(--board-target);
		outline: 2px solid var(--piece-black);
		outline-offset: -2px;
	}
	.cell.threat-attacker {
		background: var(--board-threat);
	}
	.cell.threat-defender {
		background: var(--board-target);
	}
	.cell.legal::after {
		content: '';
		position: absolute;
		width: 20%;
		height: 20%;
		border-radius: 50%;
		background: var(--legal-ink);
		box-shadow: 0 0 0 2px var(--legal);
		pointer-events: none;
	}
	.cell.capture::after {
		width: 87%;
		height: 87%;
		background: none;
		border: 3px solid var(--danger-ink);
		box-shadow: 0 0 0 2px var(--piece-white);
	}
	.cell:focus-visible {
		outline: 3px solid var(--piece-black);
		outline-offset: -3px;
		box-shadow: inset 0 0 0 5px var(--focus);
		z-index: 1;
	}
	.files {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 4px 0 0 13px;
		text-align: center;
		font-size: 12px;
		color: var(--muted);
	}
	.inspection {
		margin-top: 12px;
		color: var(--muted);
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
