import { base } from '$app/paths';
import { get, writable } from 'svelte/store';
export const soundCues = [
	['start', 'Game start'],
	['end', 'Game end'],
	['move', 'Your move'],
	['opponent', 'Opponent move'],
	['capture', 'Capture'],
	['check', 'Check'],
	['checkmate', 'Checkmate'],
	['promote', 'Promotion'],
	['notify', 'Notification'],
	['illegal', 'Illegal move'],
	['low-time', 'Low time'],
	['castle', 'Castle · preview only'],
	['premove', 'Premove · preview only']
] as const;
export type SoundCue = (typeof soundCues)[number][0];
export const soundSettings = writable({ enabled: true, volume: 0.55 });
export const soundReady = writable(false);
const settingsKey = '4dchess-sounds';
class GameSounds {
	private context: AudioContext | undefined;
	private buffers = new Map<SoundCue, Promise<AudioBuffer>>();
	private voices = new Set<AudioBufferSourceNode>();
	private revision = 0;
	private initialized = false;
	init() {
		if (this.initialized || typeof window === 'undefined') return;
		this.initialized = true;
		try {
			const saved = JSON.parse(localStorage.getItem(settingsKey) ?? 'null');
			if (
				saved &&
				typeof saved.enabled === 'boolean' &&
				typeof saved.volume === 'number' &&
				Number.isFinite(saved.volume)
			)
				soundSettings.set({
					enabled: saved.enabled,
					volume: Math.max(0, Math.min(1, saved.volume))
				});
		} catch {
			/* Defaults work without storage. */
		}
		soundSettings.subscribe((settings) => {
			if (!settings.enabled) this.stop();
			try {
				localStorage.setItem(settingsKey, JSON.stringify(settings));
			} catch {
				/* Storage is optional. */
			}
		});
		const unlock = () => {
			if (get(soundSettings).enabled) void this.unlock();
		};
		window.addEventListener('pointerdown', unlock, { passive: true });
		window.addEventListener('keydown', unlock);
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) this.stop();
		});
	}
	async unlock() {
		if (typeof window === 'undefined') return false;
		try {
			this.context ??= new AudioContext();
			await this.context.resume();
			const ready = this.context.state === 'running';
			soundReady.set(ready);
			return ready;
		} catch {
			return false;
		}
	}
	private load(cue: SoundCue) {
		this.context ??= new AudioContext();
		let pending = this.buffers.get(cue);
		if (!pending) {
			pending = fetch(`${base}/audio/game/${cue}.wav`)
				.then((r) => {
					if (!r.ok) throw Error('Sound unavailable');
					return r.arrayBuffer();
				})
				.then((b) => this.context!.decodeAudioData(b))
				.catch((error) => {
					this.buffers.delete(cue);
					throw error;
				});
			this.buffers.set(cue, pending);
		}
		return pending;
	}
	prepare() {
		this.init();
		if (typeof window === 'undefined' || !get(soundSettings).enabled) return;
		for (const [cue] of soundCues) void this.load(cue).catch(() => {});
	}
	async play(cue: SoundCue) {
		this.init();
		if (typeof document === 'undefined' || document.hidden || !get(soundSettings).enabled)
			return false;
		const revision = this.revision,
			requestedAt = performance.now();
		try {
			const buffer = await this.load(cue),
				settings = get(soundSettings);
			if (
				revision !== this.revision ||
				!settings.enabled ||
				document.hidden ||
				this.context?.state !== 'running' ||
				performance.now() - requestedAt > 1500
			)
				return false;
			const source = this.context.createBufferSource(),
				gain = this.context.createGain();
			source.buffer = buffer;
			gain.gain.value = settings.volume;
			source.connect(gain);
			gain.connect(this.context.destination);
			this.voices.add(source);
			source.onended = () => {
				this.voices.delete(source);
				source.disconnect();
				gain.disconnect();
			};
			source.start();
			return true;
		} catch {
			return false;
		}
	}
	stop() {
		this.revision++;
		for (const voice of this.voices) voice.stop();
		this.voices.clear();
	}
}
export const gameSounds = new GameSounds();
