<script lang="ts">
	import { onMount, untrack, getContext } from 'svelte';
	import { historyMotionKey, type HistoryMotion } from '$lib/history-motion';
	const navigationMotion = getContext<HistoryMotion | undefined>(historyMotionKey);
	import {
		legalMoves,
		canReach,
		inCheck,
		squareIndex,
		squareCoordinates,
		squareAddress,
		type Board,
		type Move
	} from '$lib/chess';
	import { pieceNames } from '$lib/pieces';
	import SpatialBoard from './SpatialBoard.svelte';
	import Piece from './Piece.svelte';
	import { gameSounds } from '$lib/audio/game-sounds';
	import { initMotionPreferences, motionAllowed } from '$lib/motion-preferences';
	import InspectionHint from './InspectionHint.svelte';
	import FlatOverlays from './FlatOverlays.svelte';
	import { analyzeThreats, type ThreatInspection } from '$lib/chess/threats';
	import { boardTransition, motionDuration, type PresentedMove, type PieceMotion } from './motion';
	let {
		gameKey = '',
		showHint = true,
		interruptibleMotion = false,
		practice = false,
		goalSquare = null,
		onplace,
		board,
		turn,
		seat,
		enabled,
		lastMove = null,
		onmove
	}: {
		gameKey?: string;
		showHint?: boolean;
		interruptibleMotion?: boolean;
		practice?: boolean;
		goalSquare?: number | null;
		onplace?: (square: number) => void;
		board: Board;
		turn: 'w' | 'b';
		seat: 'white' | 'black';
		enabled: boolean;
		lastMove?: PresentedMove | null;
		onmove: (move: Move) => void;
	} = $props();
	let landedSquare = $state<number | null>(null);
	let landingTimer: ReturnType<typeof setTimeout> | undefined;
	let previousGameKey = '';
	let interactiveReady = $state(false);
	let selected = $state<number | null>(null);
	let pinned = $state<ThreatInspection[]>([]);
	let inspection = $state<ThreatInspection | null>(null),
		motion = $state<PieceMotion | null>(null);
	let gridRoot = $state<HTMLElement>();
	let animatedPosition: Board | null = null;
	let previous: Board | null = null,
		before: Board | null = null,
		lastAnimation = '',
		frame = 0;
	let previousMove: PresentedMove | null = null,
		beforeMove: PresentedMove | null = null;
	let held = false,
		holdTimer: ReturnType<typeof setTimeout> | undefined,
		holdPoint: { x: number; y: number } | null = null;
	const shown = $derived.by(() => {
		if (motion) {
			const visible = board.slice();
			visible[motion.to] = motion.captured;
			return visible;
		}
		return board;
	});
	onMount(() => {
		interactiveReady = true;
		initMotionPreferences();
		const visibility = () => {
			if (document.hidden) stopMotion();
		};
		document.addEventListener('visibilitychange', visibility);
		return () => {
			stopMotion();
			clearTimeout(holdTimer);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
	function stopMotion() {
		cancelAnimationFrame(frame);
		motion = null;
		landedSquare = null;
		clearTimeout(landingTimer);
	}
	$effect(() => {
		if (!$motionAllowed) untrack(stopMotion);
	});
	$effect(() => {
		if (gameKey !== previousGameKey) {
			previousGameKey = gameKey;
			previous = null;
			before = null;
			previousMove = null;
			beforeMove = null;
			lastAnimation = '';
			untrack(stopMotion);
		}
		const current = board,
			recent = lastMove,
			skip = !$motionAllowed;
		if (current !== previous) {
			untrack(() => {
				if (
					animatedPosition &&
					!current.every(
						(p, i) => p?.t === animatedPosition?.[i]?.t && p?.c === animatedPosition?.[i]?.c
					)
				)
					stopMotion();
			});
			before = previous;
			beforeMove = previousMove;
			previous = current;
		}
		previousMove = recent;
		if (!before) return;
		const transition = boardTransition(before, current, recent, beforeMove);
		if (!transition) {
			lastAnimation = '';
			untrack(stopMotion);
			return;
		}
		const key = `${gameKey}:${transition.ply ?? ''}:${transition.from}:${transition.to}:${transition.reverse}`;
		if (key === lastAnimation) return;
		lastAnimation = key;
		const moving = transition.piece,
			captured = transition.captured;
		untrack(() => {
			stopMotion();
			const duration = Math.min(
				motionDuration(transition, moving),
				navigationMotion?.consume(performance.now()) ?? Infinity
			);
			if (skip || document.hidden || duration === 0) return;
			animatedPosition = current;
			const start = performance.now();
			motion = { ...transition, piece: moving, captured, progress: 0 };
			const tick = (now: number) => {
				const t = Math.min(1, (now - start) / duration);
				if (t >= 1) {
					motion = null;
					landedSquare = transition.to;
					landingTimer = setTimeout(() => (landedSquare = null), 350);
					return;
				}
				motion = { ...transition, piece: moving, captured, progress: t };
				frame = requestAnimationFrame(tick);
			};
			frame = requestAnimationFrame(tick);
		});
	});
	function inspect(i: number) {
		if (motion) return;
		selected = null;
		inspection = analyzeThreats(board, turn, i);
		if (!pinned.some((item) => item.target === i)) pinned = [...pinned, inspection];
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
		selected = null;
		const targets = untrack(() => pinned.map((item) => item.target));
		const next = targets.map((target) => analyzeThreats(board, turn, target));
		pinned = next;
		inspection = next.at(-1) ?? null;
	});
	function select(i: number, source: 'board' | 'spatial' = 'board') {
		if (held) {
			held = false;
			return;
		}
		if (source === 'spatial' && inspection) {
			inspect(i);
			return;
		}
		inspection = null;
		pinned = [];
		if (onplace) {
			onplace(i);
			return;
		}
		if (!enabled) return;
		if (motion) {
			if (!interruptibleMotion) return;
			stopMotion();
		}
		const move = moves.find((m) => m.to === i);
		if (move) {
			selected = null;
			onmove(move);
			return;
		}
		if (
			source === 'spatial' &&
			(selected === i || !board[i] || (!practice && board[i]?.c !== turn))
		)
			return;
		if (selected !== null && i !== selected && (!board[i] || board[i]?.c !== turn))
			void gameSounds.play('illegal');
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
		if (!event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
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

<!-- svelte-ignore a11y_no_static_element_interactions (Blank board clicks dismiss annotations.) -->
<div
	class="workspace"
	class:motion-off={!$motionAllowed}
	onpointerdown={(event) => {
		if (event.button === 0 && !(event.target as Element).closest('button,[data-node],.spatial')) {
			selected = null;
			pinned = [];
			inspection = null;
		}
	}}
>
	<section aria-label="Chess boards">
		<div class="slice-grid" bind:this={gridRoot} aria-busy={!!motion}>
			<div></div>
			{#each flipped ? [1, 0] : [0, 1] as z (z)}<div class="z-label">Z = {z}</div>{/each}
			{#each flipped ? [0, 1] : [1, 0] as w (w)}
				<div class="axis-w">W = {w}</div>
				{#each flipped ? [1, 0] : [0, 1] as z (z)}
					<div class="slice">
						<div class="board-wrap">
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
											class:last={!inspection && (lastMove?.from === i || lastMove?.to === i)}
											class:checked={p?.t === 'k' && p.c === turn && check}
											class:threat-target={pinned.some((item) => item.target === i)}
											class:threat-attacker={pinned.some((item) => item.attackers.includes(i))}
											class:threat-defender={inspection?.attackers.includes(i) &&
												p?.c === inspection.color}
											data-square={i}
											aria-label={`${squareAddress(i)}, ${p ? `${p.c === 'w' ? 'White' : 'Black'} ${pieceNames[p.t]}` : 'empty'}${legal ? ', legal destination' : ''}${goalSquare === i ? ', lesson destination' : ''}`}
											aria-pressed={selected === i}
											aria-disabled={!enabled || (!!motion && !interruptibleMotion)}
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
											{#if x === xs[0]}<span class="coordinate rank-coordinate" aria-hidden="true"
													>{y + 1}</span
												>{/if}
											{#if y === ys[ys.length - 1]}<span
													class="coordinate file-coordinate"
													aria-hidden="true">{'abcd'[x]}</span
												>{/if}
											{#if p}<Piece
													piece={p}
													selected={selected === i}
													landed={landedSquare === i}
													captureProgress={motion?.to === i
														? Math.max(0, (motion.progress - 0.65) / 0.35)
														: 0}
													opacity={motion?.to === i
														? 1 - Math.max(0, (motion.progress - 0.65) / 0.35)
														: inspection?.preview && inspection.target === i
															? 0.65
															: 1}
												/>{/if}
										</button>
									{/each}{/each}
							</div>
						</div>
					</div>
				{/each}
			{/each}
			{#if gridRoot}{#key flipped}<FlatOverlays
						root={gridRoot}
						{board}
						{motion}
						inspections={pinned}
					/>{/key}{/if}
		</div>
		<InspectionHint
			visible={showHint}
			description={pinned
				.map(
					(item) =>
						squareAddress(item.target) +
						': ' +
						(item.attackers.length
							? item.attackers
									.map((from) => {
										const p = item.position[from]!;
										return (
											(p.c === item.color ? 'Defender: ' : 'Attacker: ') +
											(p.c === 'w' ? 'White' : 'Black') +
											' ' +
											pieceNames[p.t] +
											' at ' +
											squareAddress(from)
										);
									})
									.join(', ')
							: 'No attackers or defenders.')
				)
				.join('. ')}
		/>
	</section>
	<SpatialBoard
		board={shown}
		{selected}
		moves={inspection ? [] : moves}
		{lastMove}
		{motion}
		{inspection}
		inspections={pinned}
		oninspect={inspect}
		onselect={(i) => select(i, 'spatial')}
	/>
</div>

<style>
	.cell.lesson-target {
		outline: 3px dashed var(--piece-black);
		outline-offset: -5px;
	}
	.z-label,
	.axis-w {
		font-family: var(--font-data);
	}
	.workspace {
		display: grid;
		grid-template-columns: var(--board-columns);
		align-items: start;
		gap: var(--board-gap);
	}
	.slice-grid {
		--slice-row-gap: 14px;
		position: relative;
		display: grid;
		grid-template-columns: 20px 1fr 1fr;
		gap: var(--slice-row-gap) 18px;
		/* Balance the Z-label gutter above the boards for the player rows. */
		padding-bottom: calc(var(--slice-row-gap) + 19px);
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
	.coordinate {
		position: absolute;
		z-index: 1;
		pointer-events: none;
		font-size: clamp(9px, 1.1vw, 12px);
		font-weight: 750;
		line-height: 1;
		color: #536348;
	}
	.cell.dark .coordinate {
		color: var(--piece-white);
	}
	.rank-coordinate {
		top: 3px;
		left: 3px;
	}
	.file-coordinate {
		bottom: 3px;
		right: 3px;
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
	.cell:active :global(.piece) {
		transform: scale(0.93);
		transition-duration: 55ms;
	}
	@media (prefers-reduced-motion: reduce) {
		.cell:active :global(.piece) {
			transform: none;
		}
	}
	.cell:hover {
		background: var(--board-hover);
	}
	.cell.selected {
		background: var(--board-selected);
		box-shadow: none;
	}
	.cell.checked {
		background: var(--board-check);
	}
	.cell.threat-target {
		outline: none;
	}
	.workspace.motion-off .cell.legal::after {
		animation: none;
	}
	.cell.legal::after {
		animation: destination-in 140ms ease-out;
		content: '';
		position: absolute;
		width: 20%;
		height: 20%;
		border-radius: 50%;
		background: var(--legal-ink);
		opacity: 0.55;
		pointer-events: none;
	}
	.cell.capture::after {
		width: 87%;
		height: 87%;
		background: none;
		border: 3px solid var(--legal-ink);
		box-shadow: none;
	}
	.cell:focus-visible {
		filter: brightness(1.25);
		outline: none;
	}
	@keyframes destination-in {
		from {
			transform: scale(0.3);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cell.legal::after {
			animation: none;
		}
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
			--slice-row-gap: 12px;
			grid-template-columns: 14px 1fr 1fr;
			gap: var(--slice-row-gap) 6px;
		}
	}
</style>
