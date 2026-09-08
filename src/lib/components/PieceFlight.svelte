<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Piece from './Piece.svelte';
	import { piecePose, type PieceMotion, type Point } from './motion';
	let {
		motion,
		points,
		unit,
		size,
		animationName = 'piece',
		trail = true
	}: {
		motion: PieceMotion | null;
		points: readonly Point[];
		unit: number;
		size: number;
		animationName?: string;
		trail?: boolean;
	} = $props();
	let reduced = $state(false),
		clock = $state(0);
	type Segment = { id: number; from: Point; to: Point; born: number };
	let wake = $state<Segment[]>([]);
	let last: PieceMotion | null = null,
		previousPoints: readonly Point[] | null = null,
		frame = 0,
		id = 0;
	const pose = $derived(
		motion && points[motion.from] && points[motion.to]
			? piecePose(points[motion.from], points[motion.to], motion, unit)
			: null
	);
	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => (reduced = query.matches);
		update();
		query.addEventListener('change', update);
		return () => {
			query.removeEventListener('change', update);
			cancelAnimationFrame(frame);
		};
	});
	$effect(() => {
		const current = motion,
			positions = points,
			skip = reduced || !trail;
		untrack(() => {
			cancelAnimationFrame(frame);
			if (skip) {
				wake = [];
				last = null;
				return;
			}
			const now = performance.now();
			clock = now;
			wake = wake.filter((s) => now - s.born < 480);
			if (current && positions[current.from] && positions[current.to]) {
				if (
					previousPoints !== positions ||
					!last ||
					current.from !== last.from ||
					current.to !== last.to ||
					current.progress < last.progress
				) {
					wake = [];
					last = { ...current, progress: 0 };
				}
				const from = last.progress;
				for (let i = 0; i < 3; i++) {
					const a = piecePose(
						positions[current.from],
						positions[current.to],
						{ ...current, progress: from + ((current.progress - from) * i) / 3 },
						unit
					);
					const b = piecePose(
						positions[current.from],
						positions[current.to],
						{ ...current, progress: from + ((current.progress - from) * (i + 1)) / 3 },
						unit
					);
					if (Math.hypot(b.x - a.x, b.y - a.y) > 0.05)
						wake = [...wake, { id: id++, from: a, to: b, born: now }];
				}
				last = { ...current };
				previousPoints = positions;
			} else {
				last = null;
				const fade = (time: number) => {
					clock = time;
					wake = wake.filter((s) => time - s.born < 480);
					if (wake.length) frame = requestAnimationFrame(fade);
				};
				if (wake.length) frame = requestAnimationFrame(fade);
			}
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

<g pointer-events="none" aria-hidden="true">
	{#if !reduced}<g data-wake fill="none" stroke="var(--piece-white)" stroke-linecap="round">
			{#each wake as segment (segment.id)}{@const age = Math.min(
					1,
					Math.max(0, (clock - segment.born) / 480)
				)}
				<g opacity={(1 - age) ** 2}
					><line
						x1={segment.from.x}
						y1={segment.from.y}
						x2={segment.to.x}
						y2={segment.to.y}
						stroke-width={((4 + age * 5) * unit) / 70}
						opacity=".035"
					/><line
						x1={segment.from.x}
						y1={segment.from.y}
						x2={segment.to.x}
						y2={segment.to.y}
						stroke-width={((1.5 + age * 2) * unit) / 70}
						opacity=".16"
					/></g
				>
			{/each}
		</g>{/if}
	{#if motion && pose}
		<ellipse
			cx={pose.x}
			cy={pose.y + size * 0.45}
			rx={size * 0.36}
			ry={size * 0.09}
			fill="#000"
			opacity={0.18 * (1 - pose.warp)}
		/>
		{#if !reduced && pose.warp > 0.04}<g
				data-warp-streak
				transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle})`}
				opacity={pose.warp * 0.8}
			>
				<path
					d={`M ${-pose.length} 0 Q ${-pose.length * 0.4} ${(-4 * unit) / 70} ${(12 * unit) / 70} 0 Q ${-pose.length * 0.4} ${(4 * unit) / 70} ${-pose.length} 0`}
					fill={motion.piece.c === 'w' ? 'var(--piece-white)' : 'var(--piece-black)'}
					stroke={motion.piece.c === 'w'
						? 'var(--piece-white-outline)'
						: 'var(--piece-black-detail)'}
					stroke-width={(0.7 * unit) / 70}
				/>
			</g>{/if}
		<g
			data-animation={animationName}
			data-warp={reduced ? 0 : pose.warp}
			opacity={reduced ? 1 : 1 - pose.warp * 0.65}
			transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle}) scale(${reduced ? 1 : pose.warpScale} ${reduced ? 1 : pose.warpThin}) rotate(${(reduced ? 0 : pose.rotation) - pose.angle}) scale(${reduced ? 1 : pose.sx} ${reduced ? 1 : pose.sy})`}
		>
			<Piece onDark piece={motion.piece} x={-size / 2} y={-size / 2} {size} />
		</g>
	{/if}
</g>
