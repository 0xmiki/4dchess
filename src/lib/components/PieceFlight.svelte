<script lang="ts">
	import { untrack } from 'svelte';
	import { motionAllowed } from '$lib/motion-preferences';
	import Piece from './Piece.svelte';
	import { piecePose, motionStyle, type PieceMotion, type Point } from './motion';
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
	const reduced = $derived(!$motionAllowed);
	let clock = $state(0);
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
			wake = wake.filter((s) => now - s.born < motionStyle.trailLifetime);
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
				// Keep only a short wake immediately behind the piece.
				let remaining = unit * motionStyle.trailCells;
				const shortWake: Segment[] = [];
				for (let i = wake.length - 1; i >= 0 && remaining > 0; i--) {
					const segment = wake[i],
						dx = segment.from.x - segment.to.x,
						dy = segment.from.y - segment.to.y;
					const length = Math.hypot(dx, dy);
					if (length > remaining)
						shortWake.push({
							...segment,
							from: {
								x: segment.to.x + (dx * remaining) / length,
								y: segment.to.y + (dy * remaining) / length
							}
						});
					else shortWake.push(segment);
					remaining -= length;
				}
				wake = shortWake.reverse();
				last = { ...current };
				previousPoints = positions;
			} else {
				last = null;
				const fade = (time: number) => {
					clock = time;
					wake = wake.filter((s) => time - s.born < motionStyle.trailLifetime);
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
					Math.max(0, (clock - segment.born) / motionStyle.trailLifetime)
				)}
				<g opacity={(1 - age) ** 2}
					><line
						x1={segment.from.x}
						y1={segment.from.y}
						x2={segment.to.x}
						y2={segment.to.y}
						stroke-width={((2.5 + age * 1.5) * unit) / 70}
						opacity=".018"
					/><line
						x1={segment.from.x}
						y1={segment.from.y}
						x2={segment.to.x}
						y2={segment.to.y}
						stroke-width={((1 + age * 0.4) * unit) / 70}
						opacity=".075"
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

		<g
			data-animation={animationName}
			data-warp={reduced ? 0 : pose.warp}
			opacity={reduced ? 1 : 1 - pose.warp * motionStyle.opacityDrop}
			transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle}) scale(${reduced ? 1 : pose.warpScale} ${reduced ? 1 : pose.warpThin}) rotate(${(reduced ? 0 : pose.rotation) - pose.angle}) scale(${reduced ? 1 : pose.sx} ${reduced ? 1 : pose.sy})`}
		>
			<Piece onDark piece={motion.piece} x={-size / 2} y={-size / 2} {size} />
		</g>
	{/if}
</g>
