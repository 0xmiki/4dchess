<script lang="ts">
	import { activeMatch, leaveMatch, rememberMatch } from '$lib/active-match';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { Id } from '../convex/_generated/dataModel';
	import { ConvexError } from 'convex/values';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { api } from '../convex/_generated/api';
	import { guestClient, existingGuestClient, errorMessage } from '$lib/multiplayer';
	import SideToggle from '$lib/components/SideToggle.svelte';
	import PlayOption from '$lib/components/PlayOption.svelte';
	import AutoplayTesseract from '$lib/components/AutoplayTesseract.svelte';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import GithubLogoIcon from 'phosphor-svelte/lib/GithubLogoIcon';
	import XLogoIcon from 'phosphor-svelte/lib/XLogoIcon';
	import SelectField from '$lib/components/SelectField.svelte';
	import { timeControls, type TimeControl } from '$lib/online/time-controls';
	let selectedTime = $state<TimeControl>('10+5');
	const timeOptions = [
		...Object.entries(timeControls).map(([value, control]) => ({
			value: value as TimeControl,
			label: control.label
		})),
		{ value: 'untimed' as const, label: 'Untimed' }
	];

	let seat = $state<'white' | 'black' | 'random'>('random'),
		busy = $state(false),
		error = $state('');
	let requestId: string | null = null;
	let assignedSeat: 'white' | 'black' | null = null;
	function chooseSeat(): 'white' | 'black' {
		return seat === 'random'
			? crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0
				? 'white'
				: 'black'
			: seat;
	}
	$effect(() => {
		void selectedTime;
		requestId = null;
		assignedSeat = null;
	});
	let ready = $state(false),
		resuming = $state(true),
		resumeError = $state(false);
	let alive = true;
	async function resumeMatch() {
		resuming = true;
		resumeError = false;
		const active = activeMatch();
		if (!active || active.kind === 'computer') {
			try {
				if (localStorage.getItem('fourfold-search')) {
					await goto(resolve('/match'), { replaceState: true });
					return;
				}
			} catch {
				/* Storage is optional. */
			}
			resuming = false;
			ready = true;
			return;
		}
		try {
			const client = await existingGuestClient();
			if (!alive) return;
			if (client) {
				const match = await client.query(api.games.get, { gameId: active.gameId as Id<'games'> });
				if (!alive) return;
				if (match.game.status !== 'finished') {
					await goto(resolve('/room/[roomId]', { roomId: active.gameId }), {
						replaceState: true
					});
					return;
				}
			}
			leaveMatch();
		} catch (cause) {
			if (!alive) return;
			if (cause instanceof ConvexError) leaveMatch();
			else {
				resumeError = true;
				error = 'Could not reopen your room. Please retry.';
			}
		}
		resuming = false;
		ready = true;
	}
	onMount(() => {
		void resumeMatch();
		return () => {
			alive = false;
		};
	});
	async function create() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			try {
				const stored = sessionStorage.getItem('fourfold-create');
				if (stored && !requestId) {
					const pending = JSON.parse(stored);
					const savedSeat =
						pending.assignedSeat === 'white' || pending.assignedSeat === 'black'
							? pending.assignedSeat
							: seat !== 'random'
								? seat
								: null;
					if (
						pending.seat === seat &&
						pending.timeControl === selectedTime &&
						typeof pending.requestId === 'string' &&
						/^[a-f0-9-]{36}$/i.test(pending.requestId) &&
						savedSeat
					) {
						requestId = pending.requestId;
						assignedSeat = savedSeat;
					}
				}
			} catch {
				/* Storage is optional. */
			}
			requestId ??= crypto.randomUUID();
			assignedSeat ??= chooseSeat();
			try {
				sessionStorage.setItem(
					'fourfold-create',
					JSON.stringify({ requestId, seat, assignedSeat, timeControl: selectedTime })
				);
			} catch {
				/* The live request still has a stable ID. */
			}
			const client = await guestClient();
			const created = await client.mutation(api.games.create, {
				seat: assignedSeat,
				requestId,
				timeControl: selectedTime
			});
			try {
				sessionStorage.removeItem('fourfold-create');
			} catch {
				/* Storage is optional. */
			}
			rememberMatch({ kind: 'friend', gameId: created.gameId });
			await goto(resolve('/room/[roomId]', { roomId: created.gameId }));
		} catch (cause) {
			error = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head
	><title>4D chess · Play</title><meta
		name="description"
		content="Play four-dimensional chess with a friend or the computer."
	/></svelte:head
>
{#if resuming}<LoadingScreen label="Opening your room" />{:else}<main class="shell home-shell">
		<h1 class="sr-only">4D chess</h1>

		{#if resumeError}<div role="alert" class="flow resume-error">
				<p>{error}</p>
				<Button variant="primary" onclick={resumeMatch}>Retry</Button>
			</div>{:else}<div class="home-play">
				<section class="play-options" aria-label="Choose how to play">
					<div class="play-settings">
						<SideToggle
							allowRandom
							iconOnly
							bind:value={seat}
							disabled={busy || !ready}
							onchange={() => {
								requestId = null;
								assignedSeat = null;
							}}
						/>
						<SelectField
							label="Time"
							options={timeOptions}
							bind:value={selectedTime}
							disabled={!ready || busy}
						/>
					</div>
					<PlayOption
						mode="matchmaking"
						primary
						disabled={!ready || busy || selectedTime === 'untimed'}
						description={selectedTime === 'untimed'
							? 'Choose a clock to find an opponent.'
							: 'Play someone online. Random side.'}
						onclick={() => goto(resolve(`/match?time=${encodeURIComponent(selectedTime)}`))}
					/>
					<PlayOption
						mode="friend"
						primary={false}
						{busy}
						disabled={!ready || busy}
						onclick={create}
					/>

					{#if error}<p class="error" role="alert">{error}</p>{/if}
					<PlayOption
						mode="computer"
						disabled={!ready || busy}
						onclick={() =>
							goto(resolve(chooseSeat() === 'white' ? '/computer?side=w' : '/computer?side=b'))}
					/>
					<a class="learn" href={resolve('/how-to-play')}
						><BookOpenIcon size={20} aria-hidden="true" />Learn how to play</a
					>
				</section>
				<AutoplayTesseract />
			</div>{/if}
		<footer class="home-footer">
			<a href="https://github.com/0xmiki/4dchess" target="_blank" rel="noopener noreferrer">
				<GithubLogoIcon size={20} weight="fill" aria-hidden="true" />GitHub
			</a>
			<a
				href="https://x.com/miki_code"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Made by miki_code on X"
			>
				Made by <XLogoIcon size={18} aria-hidden="true" />
			</a>
		</footer>
	</main>{/if}

<style>
	.play-settings {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: end;
		gap: var(--space-4);
	}
	.home-shell {
		max-width: 1800px;
		min-height: 100svh;
		display: flex;
		flex-direction: column;
	}
	.home-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-top: auto;
		padding-top: var(--space-2);
	}
	.home-footer a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		color: var(--muted);
		font-size: 13px;
		text-decoration: none;
		border-radius: var(--radius-control);
	}
	.home-footer a:hover,
	.home-footer a:focus-visible {
		color: var(--text);
	}
	@media (max-width: 1000px) {
		.home-play :global(.autoplay) {
			width: min(640px, calc(100% - var(--sidebar-width) - var(--sidebar-gap)));
		}
	}
	@media (max-width: 850px) {
		.home-play :global(.autoplay) {
			width: min(640px, 100%);
		}
	}
	.home-play {
		display: grid;
		grid-template-columns: var(--board-columns);
		gap: var(--board-gap);
		width: calc(100% - var(--sidebar-width) - var(--sidebar-gap));
		margin-inline: auto;
		align-items: center;
		min-height: calc(100svh - 100px);
	}
	.play-options {
		display: grid;
		gap: var(--space-5);
		width: 100%;
		max-width: 480px;
		justify-self: center;
	}
	.learn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--control-height);
		text-decoration: none;
		color: var(--text);
	}
	.learn:hover {
		text-decoration: underline;
	}
	@media (max-width: 1000px) {
		.home-play {
			grid-template-columns: 1fr;
			width: 100%;
			justify-items: center;
			gap: var(--space-5);
			min-height: 0;
			padding-top: var(--space-8);
		}
		.play-options {
			gap: var(--space-4);
		}
	}
</style>
