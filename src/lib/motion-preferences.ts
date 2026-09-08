import { derived, writable } from 'svelte/store';
export const motionEnabled = writable(true);
export const systemReducedMotion = writable(false);
export const motionAllowed = derived(
	[motionEnabled, systemReducedMotion],
	([enabled, reduced]) => enabled && !reduced
);
let initialized = false;
export function initMotionPreferences() {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;
	try {
		motionEnabled.set(localStorage.getItem('4dchess-motion-effects') !== 'off');
	} catch {
		/* System preference still applies without storage. */
	}
	const media = matchMedia('(prefers-reduced-motion: reduce)');
	const update = () => systemReducedMotion.set(media.matches);
	update();
	media.addEventListener('change', update);
	motionEnabled.subscribe((enabled) => {
		try {
			localStorage.setItem('4dchess-motion-effects', enabled ? 'on' : 'off');
		} catch {
			/* The current session still works. */
		}
	});
}
