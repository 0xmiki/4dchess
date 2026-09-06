<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { lessons, lessonOrder, type Lesson } from '$lib/guide/lessons';
	import type { PieceType } from '$lib/chess';
	import Button from './Button.svelte';
	import Piece from './Piece.svelte';
	import GuideProjection from './GuideProjection.svelte';
	import GuideFlatBoards from './GuideFlatBoards.svelte';
	import CoordinateChange from './CoordinateChange.svelte';
	import MovePlayback from './MovePlayback.svelte';
	let selected = $state<PieceType>('r'),
		mistake = $state(false),
		progress = $state(0),
		yaw = $state(-0.48),
		pitch = $state(0.26);
	const lesson: Lesson = $derived(lessons[selected]);
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const destination = $derived(mistake ? lesson.bad : lesson.four);
	function choose(piece: PieceType) {
		selected = piece;
		mistake = false;
		progress = 0;
	}
</script>

<section id="how-to-play" class="guide" aria-labelledby="guide-title">
	<header class="guide-heading">
		<div>
			<p class="section-label">Interactive guide</p>
			<h1 id="guide-title">How to play 4D chess</h1>
		</div>
		<p>The goal is checkmate. Start by learning how the four boards connect.</p>
	</header>
	<div class="dimension-steps">
		<article>
			<span class="axis-tag">X / Y</span>
			<h3>One square on a board</h3>
			<p>
				X is the file, a to d. Y is the rank, 1 to 4. Together they locate a square on a 4 × 4
				board.
			</p>
		</article>
		<article>
			<span class="axis-tag">Z</span>
			<h3>Two layers make a 3D board</h3>
			<p>
				Z selects one of two layers. In White's view, these are the left and right boards in a row.
			</p>
		</article>
		<article>
			<span class="axis-tag fourth">W</span>
			<h3>Two copies add a fourth direction</h3>
			<p>
				W selects a whole 3D board. In White's view, W = 0 is the bottom row and W = 1 is the top
				row.
			</p>
		</article>
	</div>
	<p class="projection-note">
		The nested cubes represent equally sized spaces. One looks smaller because of the projection. <strong
			>W is a spatial direction, not time.</strong
		>
	</p>

	<section class="move-explorer" aria-labelledby="explorer-title">
		<div class="explorer-heading">
			<h3 id="explorer-title">Explore a piece's move</h3>
			<span class="muted">3D → 4D</span>
		</div>
		<div class="piece-selector" role="group" aria-label="Piece to learn">
			{#each lessonOrder as piece (piece)}<Button
					aria-pressed={selected === piece}
					onclick={() => choose(piece)}
					><Piece piece={{ t: piece, c: 'w' }} size={22} />{lessons[piece].name}</Button
				>{/each}
		</div>
		<div class="lesson-options">
			<label
				><input
					type="checkbox"
					disabled={!ready}
					bind:checked={mistake}
					onchange={() => {
						progress = 0;
					}}
				/>Show a common mistake</label
			><Button
				onclick={() => {
					yaw = -0.48;
					pitch = 0.26;
				}}>Reset views</Button
			>
		</div>
		<div class="lesson-explanation" aria-live="polite" aria-atomic="true">
			<span class="case-label" class:invalid={mistake}
				>{mistake ? 'Not a legal move' : 'Legal movement'}</span
			>
			<h4>{mistake ? lesson.badTitle : lesson.title}</h4>
			<p>{mistake ? lesson.badText : lesson.rule}</p>
		</div>
		<div class="comparisons">
			<figure>
				<figcaption><strong>In one 3D board</strong><span>XYZ</span></figcaption>
				<GuideProjection
					four={false}
					from={lesson.from}
					to={lesson.three}
					piece={selected}
					capture={lesson.capture ?? false}
					{progress}
					bind:yaw
					bind:pitch
					label={`${lesson.name} move in 3D`}
				/>
				<p>{lesson.threeText}</p>
			</figure>
			<figure>
				<figcaption><strong>In the 4D board</strong><span class="fourth">XYZ + W</span></figcaption>
				<GuideProjection
					from={lesson.from}
					to={destination}
					piece={selected}
					capture={lesson.capture ?? false}
					invalid={mistake}
					{progress}
					bind:yaw
					bind:pitch
					label={`${lesson.name} ${mistake ? 'common mistake' : 'move'} in 4D`}
				/>
				<p>{mistake ? lesson.badText : lesson.fourText}</p>
			</figure>
		</div>
		<div class="playback-row">
			{#key `${selected}:${mistake}`}<MovePlayback bind:progress disabled={mistake} />{/key}
			<p>Drag either diagram to rotate both. Arrow keys rotate; Home resets.</p>
		</div>
		<div class="flat-comparison">
			<div>
				<h4>The same move on your boards</h4>
				<GuideFlatBoards
					from={lesson.from}
					to={destination}
					piece={selected}
					capture={lesson.capture ?? false}
					invalid={mistake}
					{progress}
				/>
			</div>
			<div class="takeaway">
				<h4>{mistake ? lesson.badTitle : lesson.takeaway}</h4>
				<p>{mistake ? lesson.badText : lesson.flatText}</p>
				<CoordinateChange from={lesson.from} to={destination} />
				<p class="lesson-note">{lesson.note}</p>
			</div>
		</div>
		<p class="isolation-note">
			These examples isolate movement. In a match, pieces block sliding paths and every move must
			keep your king safe.
		</p>
	</section>

	<div class="guide-finish">
		<div>
			<h3>Look for threats across W</h3>
			<p>
				A rook at <code>a1 [0,0]</code> can attack a king at <code>a1 [0,1]</code>. They look far
				apart, but only W changes. Screen distance does not measure safety.
			</p>
			<p>
				Right-click or long-press a square to inspect attackers and defenders. On a keyboard, use
				Shift+F10. Two lines crossing in the projection do not necessarily share a square.
			</p>
			<a href={resolve('/computer')}>Try a computer game <span aria-hidden="true">↗</span></a>
		</div>
		<details>
			<summary>Setup, special moves, and draws</summary>
			<div>
				<p>
					Each side has a king, queen, two rooks, a bishop, a knight, and four pawns. White moves
					first. Pawns automatically promote to queens.
				</p>
				<p>
					There is no castling, en passant, or opening pawn double move. Checkmate ends the game;
					the king is never captured.
				</p>
				<p>
					Stalemate, third repetition with the same side to move, 100 halfmoves without a pawn move
					or capture, and bare kings are draws.
				</p>
			</div>
		</details>
	</div>
</section>

<style>
	.guide {
		padding-top: 44px;
		border-top: 1px solid var(--line);
		margin-top: 64px;
		scroll-margin-top: 24px;
	}
	.guide-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 40px;
		margin-bottom: 32px;
	}
	.section-label {
		font: 12px var(--font-data);
		color: var(--accent);
		margin-bottom: 10px;
	}
	.guide-heading h1 {
		font-size: 32px;
		line-height: 1.2;
	}
	.guide-heading > p {
		max-width: 370px;
		color: var(--muted);
	}
	.dimension-steps {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 32px;
	}
	.dimension-steps article {
		border-left: 1px solid var(--line);
		padding-left: 20px;
	}
	.axis-tag {
		font: 13px var(--font-data);
		color: var(--accent);
	}
	.fourth {
		color: var(--axis-w);
	}
	h3 {
		font-size: 18px;
		font-weight: 600;
		line-height: 1.4;
	}
	.dimension-steps h3 {
		margin: 10px 0;
	}
	.dimension-steps p,
	.projection-note {
		color: var(--muted);
		font-size: 14px;
	}
	.projection-note {
		margin-top: 24px;
		max-width: 72ch;
	}
	.projection-note strong {
		color: var(--text);
		font-weight: 500;
	}
	.move-explorer {
		margin-top: 40px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
		padding: 28px;
	}
	.explorer-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 20px;
	}
	.explorer-heading > span {
		font: 12px var(--font-data);
	}
	.piece-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.piece-selector :global(button) {
		flex: 1;
		min-width: 110px;
	}
	.piece-selector :global(button[aria-pressed='true']) {
		border-color: var(--accent);
		background: var(--surface-raised);
		box-shadow: inset 0 -2px var(--accent);
	}
	.lesson-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-top: 20px;
	}
	.lesson-options label {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 13px;
		min-height: 44px;
	}
	.lesson-options input {
		accent-color: var(--accent);
		border-color: var(--line-strong);
		background: var(--page);
	}
	.lesson-explanation {
		margin: 24px 0 0;
		padding-top: 24px;
		border-top: 1px solid var(--line);
		min-height: 130px;
	}
	.case-label {
		font: 11px var(--font-data);
		color: var(--legal);
	}
	.case-label.invalid {
		color: var(--danger);
	}
	h4 {
		font-size: 17px;
		font-weight: 600;
		line-height: 1.5;
	}
	.lesson-explanation h4 {
		margin: 8px 0;
	}
	.lesson-explanation p {
		color: var(--muted);
		max-width: 72ch;
		font-size: 14px;
	}
	.comparisons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 28px;
		margin-top: 24px;
	}
	.comparisons figure {
		margin: 0;
		min-width: 0;
	}
	.comparisons figure + figure {
		border-left: 1px solid var(--line);
		padding-left: 28px;
	}
	.comparisons figcaption {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 13px;
	}
	.comparisons figcaption strong {
		font-weight: 550;
	}
	.comparisons figcaption span {
		font: 11px var(--font-data);
		color: var(--muted);
	}
	.comparisons figcaption span.fourth {
		color: var(--axis-w);
	}
	.comparisons :global(.projection) {
		max-height: 340px;
	}
	.comparisons p {
		font-size: 13px;
		color: var(--muted);
		min-height: 45px;
	}
	.playback-row {
		margin-top: 28px;
		padding: 20px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.playback-row > p {
		font-size: 12px;
		color: var(--muted);
		margin-top: 12px;
	}
	.flat-comparison {
		display: grid;
		grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
		gap: 48px;
		margin-top: 28px;
		align-items: center;
	}
	.flat-comparison h4 {
		margin-bottom: 18px;
	}
	.flat-comparison > div:first-child {
		max-width: 320px;
	}
	.takeaway {
		display: grid;
		gap: 18px;
	}
	.takeaway h4 {
		margin: 0;
	}
	.takeaway > p {
		color: var(--muted);
		font-size: 14px;
	}
	.takeaway .lesson-note {
		font-size: 13px;
	}
	.isolation-note {
		font-size: 12px;
		color: var(--muted);
		margin-top: 24px;
	}
	.guide-finish {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 60px;
		margin-top: 36px;
	}
	.guide-finish h3 {
		margin-bottom: 14px;
	}
	.guide-finish p {
		color: var(--muted);
		font-size: 14px;
		margin-bottom: 14px;
	}
	.guide-finish a {
		display: inline-block;
		color: var(--accent);
		margin-top: 6px;
	}
	.guide-finish details {
		border-top: 1px solid var(--line);
	}
	.guide-finish summary {
		padding: 16px 0;
		cursor: pointer;
		font-weight: 550;
		min-height: 48px;
	}
	.guide-finish details > div {
		padding-bottom: 16px;
	}
	@media (max-width: 750px) {
		.guide {
			margin-top: 44px;
			padding-top: 28px;
		}
		.guide-heading {
			align-items: flex-start;
			flex-direction: column;
			gap: 14px;
		}
		.guide-heading h1 {
			font-size: 27px;
		}
		.dimension-steps {
			grid-template-columns: 1fr;
			gap: 22px;
		}
		.move-explorer {
			padding: 18px;
		}
		.piece-selector :global(button) {
			min-width: 85px;
			font-size: 13px;
			padding: 9px 8px;
		}
		.lesson-options {
			gap: 12px;
		}
		.lesson-options :global(button) {
			font-size: 12px;
			padding: 9px 10px;
		}
		.lesson-explanation {
			min-height: 0;
		}
		.comparisons {
			gap: 16px;
		}
		.comparisons figure + figure {
			padding-left: 16px;
		}
		.comparisons figcaption {
			flex-direction: column;
			gap: 5px;
		}
		.comparisons p {
			font-size: 12px;
		}
		.flat-comparison {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.flat-comparison > div:first-child {
			max-width: 280px;
		}
		.guide-finish {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.takeaway {
			gap: 14px;
		}
	}
	@media (max-width: 430px) {
		.comparisons {
			grid-template-columns: 1fr;
		}
		.comparisons figure + figure {
			padding: 20px 0 0;
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.comparisons figcaption {
			flex-direction: row;
		}
		.comparisons :global(.projection) {
			max-height: 270px;
		}
	}
</style>
