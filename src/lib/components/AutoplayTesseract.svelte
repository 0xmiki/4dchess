<script lang="ts">
	import { onMount } from 'svelte';
	import { cameraForMove, DEFAULT_CAMERA } from '$lib/visuals/projection';
	import { demoFrame, DEMO_CAMERA_IDLE, DEMO_TIMING } from '$lib/visuals/demo-timeline';
	import { createInitialState, applyMove, legalMoves, type Move, type GameState } from '$lib/chess';
	import ComputerWorker from '$lib/chess/computer.worker.ts?worker&inline';
	import SpatialBoard from './SpatialBoard.svelte';
	import { type PieceMotion } from './motion';
	let game = $state(createInitialState());
	let elapsed = $state(0);
	let sequence = $state<{ move: Move; next: GameState; orbit: number; duration: number } | null>(
		null
	);
	let yaw = $state(DEFAULT_CAMERA.yaw),
		pitch = $state(DEFAULT_CAMERA.pitch);
	let root: HTMLDivElement;
	let cameraHoldUntil = 0,
		cameraInterrupted = false;
	const sample = $derived(demoFrame(elapsed, sequence?.orbit, sequence?.duration));
	const phase = $derived(sequence ? sample.phase : 'idle');
	const selected = $derived(
		sequence && (phase === 'selection' || phase === 'preview') ? sequence.move.from : null
	);
	const destinations = $derived(
		phase === 'selection' ? legalMoves(game.board, game.turn, selected!) : []
	);
	const motion: PieceMotion | null = $derived(
		sequence && phase === 'move'
			? {
					...sequence.move,
					piece: game.board[sequence.move.from]!,
					captured: game.board[sequence.move.to],
					progress: sample.pieceProgress
				}
			: null
	);
	const shown = $derived.by(() => {
		if (sequence && phase === 'settle') return sequence.next.board;
		if (!motion) return game.board;
		const board = game.board.slice();
		board[motion.from] = null;
		return board;
	});
	onMount(() => {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		let visible = false,
			alive = true,
			frame = 0,
			previous: number | null = null;
		let worker: Worker | null = null,
			pending = false,
			request = 0;
		let idle = 2400;
		let fromCamera = { yaw, pitch },
			toCamera = { yaw, pitch };
		function cancelWorker() {
			worker?.terminate();
			worker = null;
			pending = false;
			request++;
		}
		function think() {
			if (pending) return;
			if (game.result) {
				game = createInitialState();
				idle = 2400;
				return;
			}
			worker ??= new ComputerWorker();
			pending = true;
			const id = ++request;
			worker.onmessage = (event) => {
				if (!alive || event.data.id !== request || event.data.type === 'progress') return;
				pending = false;
				const move = event.data.move as Move | undefined;
				const applied = move && event.data.type === 'result' ? applyMove(game, move) : null;
				if (!move || !applied?.ok) {
					cancelWorker();
					idle = 4000;
					return;
				}
				if (preference.matches) {
					game = applied.state;
					idle = 3600;
					return;
				}
				const canOrbit = performance.now() >= cameraHoldUntil;
				fromCamera = { yaw, pitch };
				toCamera = canOrbit ? cameraForMove(game.board, move, fromCamera) : fromCamera;
				if (canOrbit) cameraInterrupted = false;
				elapsed = 0;
				sequence = {
					move,
					next: applied.state,
					orbit: canOrbit ? DEMO_TIMING.orbit : 0,
					duration: DEMO_TIMING.move
				};
			};
			worker.onerror = () => {
				cancelWorker();
				idle = 4000;
			};
			worker.postMessage({ id, state: $state.snapshot(game), difficulty: 'easy' });
		}
		function halt() {
			cancelAnimationFrame(frame);
			previous = null;
			cancelWorker();
		}
		function animate(now: number) {
			if (!alive || !visible || document.hidden) return;
			const delta = previous === null ? 0 : now - previous;
			previous = now;
			if (sequence) {
				elapsed += delta;
				const sample = demoFrame(elapsed, sequence.orbit, sequence.duration);
				if (!cameraInterrupted && now >= cameraHoldUntil) {
					yaw = fromCamera.yaw + (toCamera.yaw - fromCamera.yaw) * sample.cameraProgress;
					pitch = fromCamera.pitch + (toCamera.pitch - fromCamera.pitch) * sample.cameraProgress;
				}
				if (sample.done) {
					game = sequence.next;
					sequence = null;
					idle = game.result ? 8000 : 1600;
				}
			} else {
				idle -= delta;
				if (idle <= 0) think();
			}
			frame = requestAnimationFrame(animate);
		}
		function start() {
			halt();
			if (visible && !document.hidden) frame = requestAnimationFrame(animate);
		}
		const visibility = () => (document.hidden ? halt() : start());
		const changed = () => {
			if (preference.matches && sequence) {
				game = sequence.next;
				sequence = null;
				idle = 3600;
			}
			start();
		};
		document.addEventListener('visibilitychange', visibility);
		preference.addEventListener('change', changed);
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			start();
		});
		observer.observe(root);
		return () => {
			alive = false;
			halt();
			observer.disconnect();
			document.removeEventListener('visibilitychange', visibility);
			preference.removeEventListener('change', changed);
		};
	});
	function interact(event: PointerEvent | KeyboardEvent) {
		if (!(event.target as Element).closest('svg.space-svg')) return;
		if (event.type === 'pointermove' && !(event as PointerEvent).buttons) return;
		if (
			event instanceof KeyboardEvent &&
			!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)
		)
			return;
		cameraHoldUntil = performance.now() + DEMO_CAMERA_IDLE;
		cameraInterrupted = true;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (Manual orbit gestures hold the camera while autoplay continues.) -->
<div
	class="autoplay"
	bind:this={root}
	data-demo-ply={game.ply}
	data-demo-phase={phase}
	onpointerdown={interact}
	onpointermove={interact}
	onpointerup={interact}
	onkeydown={interact}
>
	<SpatialBoard
		annotations={false}
		showMoveTrail={false}
		lastMove={null}
		inspection={null}
		board={shown}
		{selected}
		moves={destinations}
		{motion}
		onselect={() => {}}
		oninspect={() => {}}
		bind:yaw
		bind:pitch
	/>
</div>

<style>
	.autoplay {
		position: relative;
		min-width: 0;
	}
</style>
