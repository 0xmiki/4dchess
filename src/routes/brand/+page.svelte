<script lang="ts">
	import { resolve } from '$app/paths';
	import { previewEndSound } from '$lib/end-sound';
	import SpeakerHighIcon from 'phosphor-svelte/lib/SpeakerHighIcon';
	import Button from '$lib/components/Button.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import SideToggle from '$lib/components/SideToggle.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import PlayOption from '$lib/components/PlayOption.svelte';
	import PlayerProfile from '$lib/components/PlayerProfile.svelte';
	import GameClock from '$lib/components/GameClock.svelte';
	import GameOutcome from '$lib/components/GameOutcome.svelte';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import BoardControls from '$lib/components/BoardControls.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Piece from '$lib/components/Piece.svelte';
	import { createInitialState, applyMove, type Move } from '$lib/chess';
	let side = $state<'random' | 'white' | 'black'>('random');
	let time = $state('10+5');
	let dialog: Modal;
	let feedback = $state('');
	let soundFeedback = $state('');
	async function previewSound(won: boolean) {
		const played = await previewEndSound(won);
		soundFeedback = played
			? won
				? 'Played the win sound.'
				: 'Played the loss sound.'
			: 'Audio is unavailable in this browser.';
	}
	let game = $state(createInitialState());
	let last = $state<Move | null>(null);
	const sections = [
		'Identity',
		'Typography',
		'Colors',
		'Buttons',
		'Forms',
		'Players',
		'Sounds',
		'Game'
	];
	const colors = [
		['Page', '--page'],
		['Surface', '--surface'],
		['Raised surface', '--surface-raised'],
		['Text', '--text'],
		['Muted text', '--muted'],
		['Border', '--line'],
		['Primary', '--primary-fill'],
		['Brand green', '--game-primary'],
		['Light square', '--board-light'],
		['Legal move', '--spatial-destination'],
		['Selection', '--spatial-selection-outline'],
		['Last move', '--spatial-last-move'],
		['Attacker', '--threat-attack'],
		['Defender', '--threat-defend'],
		['Error', '--danger']
	];
	function move(move: Move) {
		const result = applyMove(game, move);
		if (result.ok) {
			game = result.state;
			last = move;
		}
	}
</script>

<svelte:head><title>Brand · 4D chess</title><meta name="robots" content="noindex" /></svelte:head>
<main class="brand-page">
	<header>
		<a href={resolve('/')} aria-label="4D chess home"><Logo /></a><span class="muted"
			>Component library</span
		>
	</header>
	<div class="intro">
		<p class="eyebrow">4D CHESS / BRAND</p>
		<h1>A place to shape the game.</h1>
		<p class="muted">
			The real components, in one place. Try their states and see how they work together.
		</p>
	</div>
	<nav aria-label="Brand sections">
		{#each sections as section (section)}<a href={'#' + section.toLowerCase()}>{section}</a>{/each}
	</nav>
	<section id="identity">
		<div class="section-heading">
			<h2>Identity</h2>
			<p>Mark, type, and the voice of the interface.</p>
		</div>
		<div class="two">
			<div class="sample identity">
				<Logo />
				<div class="large-mark"><Logo wordmark={false} /></div>
				<p class="muted">Simple geometry. Room for the game.</p>
			</div>
			<div class="sample type">
				<span class="font-label">Outfit · Interface typeface</span>
				<h1>Play with your friends.</h1>
				<h2>Your next move.</h2>
				<p class="font-alphabet">Aa Bb Cc Dd Ee Ff Gg<br />0123456789</p>
				<p>Four connected boards. One game.</p>
				<small class="muted">Share a link. No account needed.</small>
				<p class="data">a1[0,0] → b2[1,1] · 10:00</p>
			</div>
		</div>
	</section>
	<section id="typography">
		<div class="section-heading">
			<h2>Typography</h2>
			<p>Outfit for the interface. Monospace for move notation.</p>
		</div>
		<div class="three">
			{#each [{ weight: 400, label: 'Regular / Body' }, { weight: 600, label: 'Semibold / Labels' }, { weight: 700, label: 'Bold / Actions' }] as sample (sample.weight)}
				<div class="sample font-specimen">
					<span class="font-label">{sample.label}</span>
					<p style:font-weight={sample.weight}>A new way to play chess.</p>
					<span style:font-weight={sample.weight}>Find opponent · Join the community</span>
				</div>
			{/each}
		</div>
	</section>
	<section id="colors">
		<div class="section-heading">
			<h2>Colors</h2>
			<p>Quiet surfaces, with distinct colors for play.</p>
		</div>
		<div class="swatches">
			{#each colors as [name, token] (token)}<div class="swatch">
					<div style:background={'var(' + token + ')'}></div>
					<strong>{name}</strong><code>{token}</code>
				</div>{/each}
		</div>
	</section>
	<section id="buttons">
		<div class="section-heading">
			<h2>Buttons</h2>
			<p>Primary actions carry weight. Secondary actions stay flat.</p>
		</div>
		<div class="sample">
			<div class="row">
				<Button variant="primary" onclick={() => (feedback = 'Primary action selected.')}
					>Play now</Button
				><Button onclick={() => (feedback = 'Secondary action selected.')}>Secondary</Button><Button
					disabled>Disabled</Button
				>
			</div>
			<div class="row">
				<Button variant="primary" loading>Find opponent</Button><Button loading>Confirm</Button
				><Spinner label="Loading example" />
			</div>
			<div class="row">
				<Button onclick={() => dialog.showModal()}>Open confirmation dialog</Button><a href="#game"
					>Explore the board →</a
				>
			</div>
			<p class="feedback muted" aria-live="polite">
				{feedback || 'Button actions here only update this preview.'}
			</p>
		</div>
		<div class="two options">
			<PlayOption
				mode="matchmaking"
				primary
				onclick={() => (feedback = 'Matchmaking preview selected.')}
			/><PlayOption
				mode="friend"
				primary={false}
				onclick={() => (feedback = 'Friend challenge preview selected.')}
			/><PlayOption
				mode="computer"
				primary={false}
				onclick={() => (feedback = 'Computer preview selected.')}
			/><PlayOption mode="matchmaking" primary busy onclick={() => {}} />
		</div>
	</section>
	<section id="forms">
		<div class="section-heading">
			<h2>Forms</h2>
			<p>Side selection and time controls.</p>
		</div>
		<div class="sample row">
			<SideToggle bind:value={side} allowRandom iconOnly /><SideToggle
				bind:value={side}
				allowRandom
				label="Piece color"
			/><SelectField
				label="Time"
				bind:value={time}
				options={[
					{ value: '3+2', label: '3 + 2' },
					{ value: '5+3', label: '5 + 3' },
					{ value: '10+5', label: '10 + 5' }
				]}
			/><SelectField
				label="Unavailable"
				value="untimed"
				options={[{ value: 'untimed', label: 'Untimed' }]}
				disabled
			/>
		</div>
	</section>
	<section id="players">
		<div class="section-heading">
			<h2>Players</h2>
			<p>Identity, clocks, captured pieces, and results.</p>
		</div>
		<div class="sample profiles">
			<PlayerProfile
				name="Swift Falcon 7246"
				side="white"
				own
				active
				remaining={584000}
				score={1}
				captured={[
					{ t: 'p', c: 'b' },
					{ t: 'n', c: 'b' }
				]}
				advantage={3}
			/><PlayerProfile
				name="Silver Swan 7739"
				side="black"
				remaining={510000}
				score={0.5}
				captured={[{ t: 'p', c: 'w' }]}
			/>
		</div>
		<div class="sample row">
			<GameClock side="white" remaining={8200} running /><GameClock
				side="black"
				remaining={15000}
				running
			/><BoardControls />
		</div>
		<div class="three">
			<GameOutcome result={{ winner: 'white', reason: 'resignation' }} side="white" /><GameOutcome
				result={{ winner: 'white', reason: 'timeout' }}
				side="black"
			/><GameOutcome result={{ winner: null, reason: 'stalemate' }} side="white" />
		</div>
	</section>
	<section id="sounds">
		<div class="section-heading">
			<h2>Game sounds</h2>
			<p>Sound previews only. Game audio is currently off.</p>
		</div>
		<div class="two">
			<div class="sample sound-sample">
				<div>
					<h3>Win</h3>
					<p class="muted">Preview of the win cue.</p>
				</div>
				<Button aria-label="Play win sound" onclick={() => previewSound(true)}
					><SpeakerHighIcon size={20} aria-hidden="true" />Play</Button
				>
			</div>
			<div class="sample sound-sample">
				<div>
					<h3>Loss</h3>
					<p class="muted">Preview of the loss cue.</p>
				</div>
				<Button aria-label="Play loss sound" onclick={() => previewSound(false)}
					><SpeakerHighIcon size={20} aria-hidden="true" />Play</Button
				>
			</div>
		</div>
		<p class="muted sound-feedback" role="status">{soundFeedback}</p>
	</section>
	<section id="game">
		<div class="section-heading">
			<div>
				<h2>Game</h2>
				<p>A local board for trying selection, moves, and threat inspection.</p>
			</div>
			<Button
				onclick={() => {
					game = createInitialState();
					last = null;
				}}>Reset position</Button
			>
		</div>
		<div class="sample row pieces">
			{#each ['w', 'b'] as color (color)}{#each ['k', 'q', 'r', 'b', 'n', 'p'] as type (type)}<Piece
						piece={{ c: color as 'w' | 'b', t: type as 'k' | 'q' | 'r' | 'b' | 'n' | 'p' }}
						size={40}
						onDark
					/>{/each}{/each}
		</div>
		<ChessBoard
			board={game.board}
			turn={game.turn}
			seat={game.turn === 'w' ? 'white' : 'black'}
			enabled={!game.result}
			lastMove={last}
			onmove={move}
		/>
	</section>
	<footer class="muted">4D chess · Brand workspace</footer>
</main>
<Modal bind:this={dialog} title="Delete this challenge?" dismissOnBackdrop
	><p>Going home deletes your pending challenge. The invitation will stop working.</p>
	<div class="row">
		<Button onclick={() => dialog.close()}>Keep challenge</Button><Button
			onclick={() => {
				feedback = 'Challenge deletion preview confirmed. No challenge was deleted.';
				dialog.close();
			}}>Delete challenge</Button
		>
	</div></Modal
>

<style>
	.brand-page {
		max-width: 1280px;
		padding: 32px 40px 64px;
		margin: auto;
	}
	header,
	.row,
	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	header a {
		text-decoration: none;
	}
	.intro {
		padding: 72px 0 32px;
		max-width: 680px;
	}
	.eyebrow {
		font-family: var(--font-data);
		font-size: 12px;
		letter-spacing: 0.12em;
		color: var(--game-primary);
		margin-bottom: 20px;
	}
	.intro h1 {
		font-size: clamp(32px, 5vw, 52px);
		line-height: 1.1;
		letter-spacing: -0.04em;
		margin-bottom: 20px;
	}
	nav {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		padding: 20px 0;
		border-block: 1px solid var(--line);
	}
	nav a {
		color: var(--muted);
		text-decoration: none;
		font-size: 14px;
	}
	nav a:hover {
		color: var(--text);
	}
	section {
		padding-top: 56px;
		scroll-margin-top: 24px;
	}
	.section-heading {
		margin-bottom: 24px;
	}
	.section-heading p {
		color: var(--muted);
		font-size: 14px;
	}
	h2 {
		font-size: 22px;
	}
	.two,
	.three {
		display: grid;
		gap: 20px;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.sample {
		padding: 24px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		margin-bottom: 20px;
	}
	.row {
		justify-content: flex-start;
	}
	.sample > .row + .row {
		margin-top: 24px;
	}
	.identity {
		display: grid;
		gap: 28px;
	}
	.large-mark :global(img) {
		width: 72px;
		height: 72px;
	}
	.type {
		display: grid;
		gap: 16px;
	}
	.type h1 {
		font-size: 30px;
	}
	.font-label {
		font-size: 12px;
		color: var(--muted);
		letter-spacing: 0.04em;
	}
	.font-alphabet {
		font-size: 22px;
		font-weight: 500;
	}
	.font-specimen {
		display: grid;
		gap: 16px;
	}
	.font-specimen > p {
		font-size: 24px;
		line-height: 1.3;
	}
	.data,
	code {
		font-family: var(--font-data);
	}
	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 20px;
	}
	.swatch {
		display: grid;
		gap: 8px;
		font-size: 13px;
	}
	.swatch > div {
		height: 72px;
		border: 1px solid var(--line);
		border-radius: 12px;
	}
	.swatch code {
		color: var(--muted);
		font-size: 11px;
	}
	.feedback {
		font-size: 13px;
		margin-top: 24px;
	}
	.profiles {
		display: grid;
		gap: 28px;
	}
	.row :global(.clock) {
		margin-left: 0;
	}
	.sound-sample {
		display: grid;
		gap: 20px;
	}
	.sound-sample h3 {
		font-size: 18px;
		margin-bottom: 4px;
	}
	.sound-sample p,
	.sound-feedback {
		font-size: 13px;
	}
	.sound-feedback {
		min-height: 21px;
	}
	footer {
		margin-top: 64px;
		padding-top: 24px;
		border-top: 1px solid var(--line);
		font-size: 13px;
	}
	@media (max-width: 700px) {
		.brand-page {
			padding: 24px 16px;
		}
		.intro {
			padding-top: 40px;
		}
		.two,
		.three {
			grid-template-columns: 1fr;
		}
		.sample {
			padding: 16px;
		}
		nav {
			gap: 16px;
		}
	}
</style>
