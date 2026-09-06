<script lang="ts">
	import { onMount } from 'svelte';
	import { createInitialState, applyMove, type Board, type Move } from '$lib/chess';
	import ComputerWorker from '$lib/chess/computer.worker.ts?worker&inline';
	import SpatialBoard from './SpatialBoard.svelte';
	import type { PieceMotion } from './motion';
	import PauseIcon from 'phosphor-svelte/lib/PauseIcon';
	import PlayIcon from 'phosphor-svelte/lib/PlayIcon';
	const initial = createInitialState();
	let game = $state(initial),
		shown = $state<Board>(initial.board),
		motion = $state<PieceMotion | null>(null),
		last = $state<Move | null>(null);
	let yaw = $state(-0.48),
		pitch = $state(0.26),
		paused = $state(false),
		root: HTMLDivElement;
	let resume = () => {},
		stop = () => {};
	onMount(() => {
		let worker: Worker | null = null,
			timer: ReturnType<typeof setTimeout>,
			frame = 0,
			pending = false,
			request = 0,
			visible = true,
			alive = true;
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		function halt() {
			clearTimeout(timer);
			cancelAnimationFrame(frame);
			worker?.terminate();
			worker = null;
			pending = false;
			request++;
			motion = null;
			shown = game.board;
		}
		function schedule(delay = 1200) {
			clearTimeout(timer);
			if (alive && !paused && !document.hidden && visible) timer = setTimeout(think, delay);
		}
		function think() {
			if (!alive || paused || document.hidden || !visible || pending) return;
			if (game.result) {
				game = createInitialState();
				shown = game.board;
				last = null;
				schedule(1200);
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
					schedule(2000);
					return;
				}
				const before = game.board,
					applied = applyMove(game, move);
				if (!applied.ok) {
					schedule(2000);
					return;
				}
				game = applied.state;
				last = move;
				if (preference.matches) {
					shown = game.board;
					schedule(game.result ? 4000 : 1800);
					return;
				}
				const piece = before[move.from]!,
					captured = before[move.to],
					view = before.slice();
				view[move.from] = null;
				shown = view;
				const start = performance.now(),
					fromYaw = yaw,
					fromPitch = pitch,
					toYaw = yaw + 0.25,
					toPitch = 0.24 + Math.sin(game.ply * 0.6) * 0.15;
				const animate = (now: number) => {
					const t = Math.min(1, (now - start) / 900),
						ease = t * t * (3 - 2 * t);
					motion = { ...move, piece, captured, progress: ease };
					yaw = fromYaw + (toYaw - fromYaw) * ease;
					pitch = fromPitch + (toPitch - fromPitch) * ease;
					if (t < 1) frame = requestAnimationFrame(animate);
					else {
						motion = null;
						shown = game.board;
						schedule(game.result ? 4000 : 1200);
					}
				};
				frame = requestAnimationFrame(animate);
			};
			worker.onerror = () => {
				halt();
				schedule(2000);
			};
			worker.postMessage({ id, state: $state.snapshot(game), difficulty: 'easy' });
		}
		stop = halt;
		resume = () => schedule(300);
		const visibility = () => {
			if (document.hidden) halt();
			else schedule(300);
		};
		const changed = () => {
			halt();
			schedule(300);
		};
		document.addEventListener('visibilitychange', visibility);
		preference.addEventListener('change', changed);
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (!visible) halt();
			else schedule(500);
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
<div class="autoplay" bind:this={root} data-demo-ply={game.ply} onpointerdown={interact}>
	<SpatialBoard
		annotations={false}
		centerY={220}
		board={shown}
		selected={null}
		moves={[]}
		lastMove={last}
		{motion}
		inspection={null}
		onselect={() => {}}
		oninspect={() => {}}
		bind:yaw
		bind:pitch
	/>
	<button class="demo-pause" aria-label={paused ? 'Play demo' : 'Pause demo'} onclick={toggle}
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
