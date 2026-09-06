<script lang="ts">
	import { onMount } from 'svelte';
	import { cameraForMove, DEFAULT_CAMERA } from '$lib/visuals/projection';
	import { demoFrame } from '$lib/visuals/demo-timeline';
	import {
		createInitialState,
		applyMove,
		legalMoves,
		type Board,
		type Move,
		type GameState,
		type Piece
	} from '$lib/chess';
	import ComputerWorker from '$lib/chess/computer.worker.ts?worker&inline';
	import SpatialBoard from './SpatialBoard.svelte';
	import type { PieceMotion } from './motion';
	import { analyzeThreats, type ThreatInspection } from '$lib/chess/threats';
	import PauseIcon from 'phosphor-svelte/lib/PauseIcon';
	import PlayIcon from 'phosphor-svelte/lib/PlayIcon';
	const initial = createInitialState();
	let ready = $state(false);
	let game = $state(initial),
		shown = $state<Board>(initial.board),
		motion = $state<PieceMotion | null>(null),
		last = $state<Move | null>(null);
	let selected = $state<number | null>(null),
		destinations = $state<Move[]>([]),
		preview = $state<ThreatInspection | null>(null),
		focusMove = $state<(Move & { knight?: boolean }) | null>(null);
	let yaw = $state(DEFAULT_CAMERA.yaw),
		pitch = $state(DEFAULT_CAMERA.pitch),
		paused = $state(false),
		phase = $state('idle'),
		root: HTMLDivElement;
	let resume = () => {},
		stop = () => {};
	onMount(() => {
		ready = true;
		let worker: Worker | null = null,
			timer: ReturnType<typeof setTimeout>,
			frame = 0,
			pending = false,
			request = 0,
			visible = true,
			alive = true;
		type Sequence = {
			move: Move;
			before: Board;
			travel: Board;
			next: GameState;
			piece: Piece;
			captured: Piece | null;
			legal: Move[];
			inspection: ThreatInspection;
			fromYaw: number;
			fromPitch: number;
			camera: typeof DEFAULT_CAMERA;
			start: number;
			elapsed: number;
		};
		let sequence: Sequence | null = null;
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		const canRun = () => alive && !paused && !document.hidden && visible;
		function halt() {
			clearTimeout(timer);
			cancelAnimationFrame(frame);
			worker?.terminate();
			worker = null;
			pending = false;
			request++;
		}
		function schedule(delay = 2400) {
			clearTimeout(timer);
			if (canRun()) timer = setTimeout(think, delay);
		}
		function clearMarkers() {
			selected = null;
			destinations = [];
			preview = null;
			focusMove = null;
			motion = null;
		}
		function animate(now: number) {
			if (!sequence || !canRun()) return;
			const s = sequence;
			s.elapsed = now - s.start;
			const sample = demoFrame(s.elapsed);
			phase = sample.phase;
			yaw = s.fromYaw + (s.camera.yaw - s.fromYaw) * sample.cameraProgress;
			pitch = s.fromPitch + (s.camera.pitch - s.fromPitch) * sample.cameraProgress;
			selected = phase === 'orbit' || phase === 'settle' ? null : s.move.from;
			destinations = phase === 'selection' ? s.legal : [];
			focusMove =
				phase === 'preview' || phase === 'move' || phase === 'settle'
					? { ...s.move, knight: s.piece.t === 'n' }
					: null;
			preview = phase === 'preview' ? s.inspection : null;
			if (phase === 'move') {
				shown = s.travel;
				motion = {
					...s.move,
					piece: s.piece,
					captured: s.captured,
					progress: sample.pieceProgress
				};
			} else {
				shown = phase === 'settle' ? s.next.board : s.before;
				motion = null;
			}
			if (sample.done) {
				game = s.next;
				shown = game.board;
				last = s.move;
				sequence = null;
				clearMarkers();
				phase = 'idle';
				schedule(game.result ? 8000 : 1600);
			} else frame = requestAnimationFrame(animate);
		}
		function restartAnimation() {
			if (sequence) {
				const progress = demoFrame(sequence.elapsed).cameraProgress;
				const expectedYaw = sequence.fromYaw + (sequence.camera.yaw - sequence.fromYaw) * progress;
				const expectedPitch =
					sequence.fromPitch + (sequence.camera.pitch - sequence.fromPitch) * progress;
				if (Math.abs(yaw - expectedYaw) + Math.abs(pitch - expectedPitch) > 0.00001) {
					sequence.fromYaw = yaw;
					sequence.fromPitch = pitch;
					if (progress < 1) sequence.elapsed = 0;
					else sequence.camera = { yaw, pitch };
				}
				sequence.start = performance.now() - sequence.elapsed;
				frame = requestAnimationFrame(animate);
			} else schedule(600);
		}
		function think() {
			if (!canRun() || pending || sequence) return;
			if (game.result) {
				game = createInitialState();
				shown = game.board;
				last = null;
				clearMarkers();
				schedule();
				return;
			}
			worker ??= new ComputerWorker();
			pending = true;
			const id = ++request;
			worker.onmessage = (event) => {
				if (event.data.id !== request || event.data.type === 'progress') return;
				pending = false;
				const move = event.data.move as Move | undefined;
				if (event.data.type !== 'result' || !move) {
					worker?.terminate();
					worker = null;
					schedule(4000);
					return;
				}
				const applied = applyMove(game, move);
				if (!applied.ok) {
					schedule(4000);
					return;
				}
				if (preference.matches) {
					game = applied.state;
					shown = game.board;
					last = move;
					schedule(game.result ? 8000 : 3600);
					return;
				}
				const travel = game.board.slice();
				travel[move.from] = null;
				sequence = {
					move,
					before: game.board,
					travel,
					next: applied.state,
					piece: game.board[move.from]!,
					captured: game.board[move.to],
					legal: legalMoves(game.board, game.turn, move.from),
					inspection: analyzeThreats(game.board, game.turn, move.to, move.from),
					fromYaw: yaw,
					fromPitch: pitch,
					camera: cameraForMove(game.board, move, { yaw, pitch }),
					start: performance.now(),
					elapsed: 0
				};
				frame = requestAnimationFrame(animate);
			};
			worker.onerror = () => {
				halt();
				schedule(4000);
			};
			worker.postMessage({ id, state: $state.snapshot(game), difficulty: 'easy' });
		}
		stop = halt;
		resume = restartAnimation;
		const visibility = () => {
			if (document.hidden) halt();
			else restartAnimation();
		};
		const changed = () => {
			halt();
			if (sequence && preference.matches) {
				game = sequence.next;
				shown = game.board;
				last = sequence.move;
				sequence = null;
				clearMarkers();
				phase = 'idle';
			}
			restartAnimation();
		};
		document.addEventListener('visibilitychange', visibility);
		preference.addEventListener('change', changed);
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (!visible) halt();
			else restartAnimation();
		});
		observer.observe(root);
		schedule();
		return () => {
			alive = false;
			halt();
			observer.disconnect();
			document.removeEventListener('visibilitychange', visibility);
			preference.removeEventListener('change', changed);
		};
	});
	function toggle() {
		paused = !paused;
		if (paused) stop();
		else resume();
	}
	function interact(event: PointerEvent) {
		if ((event.target as Element).closest('svg.space-svg')) {
			paused = true;
			stop();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (Capture manual orbit gestures to pause the demo.) -->
<div
	class="autoplay"
	bind:this={root}
	data-demo-ply={game.ply}
	data-demo-phase={phase}
	onpointerdown={interact}
>
	<SpatialBoard
		annotations={false}
		board={shown}
		{selected}
		moves={destinations}
		{focusMove}
		lastMove={last}
		{motion}
		inspection={preview}
		inspections={preview ? [preview] : []}
		onselect={() => {}}
		oninspect={() => {}}
		bind:yaw
		bind:pitch
	/>
	<button
		disabled={!ready}
		class="demo-pause"
		aria-label={paused ? 'Play demo' : 'Pause demo'}
		onclick={toggle}
		>{#if paused}<PlayIcon size={18} />{:else}<PauseIcon size={18} />{/if}</button
	>
</div>

<style>
	.autoplay {
		position: relative;
		min-width: 0;
	}
	.demo-pause {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		position: absolute;
		right: 0;
		bottom: 0;
		color: var(--muted);
		cursor: pointer;
	}
	.demo-pause:hover,
	.demo-pause:focus-visible {
		background: var(--surface);
		color: var(--text);
	}
</style>
