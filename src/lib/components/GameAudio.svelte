<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Board, Color } from '$lib/chess';
	import type { PresentedMove } from './motion';
	import { GameSoundTracker } from '$lib/audio/game-events';
	import { gameSounds, soundReady, soundSettings, type SoundCue } from '$lib/audio/game-sounds';
	let {
		gameKey,
		board,
		turn,
		ply,
		active,
		result = null,
		lastMove = null,
		seat = null,
		remaining = null,
		notification = null,
		audible = true,
		announceStart = true
	}: {
		gameKey: string;
		board: Board;
		turn: Color;
		ply: number;
		active: boolean;
		result?: { reason: string } | null;
		lastMove?: PresentedMove | null;
		seat?: Color | null;
		remaining?: number | null;
		notification?: string | null;
		audible?: boolean;
		announceStart?: boolean;
	} = $props();
	const tracker = new GameSoundTracker();
	let mounted = $state(false),
		pendingStart = false,
		previousKey = '';
	const timers = new SvelteSet<ReturnType<typeof setTimeout>>();
	let moveTimer: ReturnType<typeof setTimeout> | undefined;
	function clear() {
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
		pendingStart = false;
		gameSounds.stop();
	}
	function schedule(cue: SoundCue, delay: number) {
		if (!$soundReady) {
			if (cue === 'start') pendingStart = true;
			return;
		}
		if (['move', 'opponent', 'capture', 'check', 'promote', 'checkmate', 'end'].includes(cue)) {
			clearTimeout(moveTimer);
			if (moveTimer) timers.delete(moveTimer);
		}
		const timer = setTimeout(() => {
			timers.delete(timer);
			void gameSounds.play(cue);
		}, delay);
		timers.add(timer);
		if (['move', 'opponent', 'capture', 'check', 'promote', 'checkmate', 'end'].includes(cue))
			moveTimer = timer;
	}
	onMount(() => {
		gameSounds.prepare();
		mounted = true;
		const visibility = () => {
			if (document.hidden) clear();
		};
		document.addEventListener('visibilitychange', visibility);
		return () => {
			clear();
			document.removeEventListener('visibilitychange', visibility);
		};
	});
	$effect(() => {
		if (!mounted) return;
		const snapshot = {
			key: gameKey,
			board,
			turn,
			ply,
			active,
			result,
			move: lastMove,
			seat,
			remaining,
			notification,
			audible: audible && $soundSettings.enabled && !document.hidden,
			announceStart,
			now: performance.now()
		};
		const ready = $soundReady;
		untrack(() => {
			if (previousKey !== gameKey) {
				clear();
				previousKey = gameKey;
			}
			if (!snapshot.audible) {
				clear();
			}
			const events = tracker.update(snapshot);
			if (!active || ply > 0 || result) pendingStart = false;
			if (pendingStart && ready && snapshot.audible) {
				pendingStart = false;
				void gameSounds.play('start');
			}
			for (const event of events) schedule(event.cue, event.delay);
		});
	});
</script>
