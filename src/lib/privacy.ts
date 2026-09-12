export const consentKey = 'fourfold-privacy-v1';
export const consentLifetime = 180 * 86400000;
export type Consent = { version: 1; statistics: boolean; savedAt: number };
export function readConsent(raw: string | null, now = Date.now()): Consent | null {
	try {
		const value = JSON.parse(raw ?? 'null');
		return value?.version === 1 &&
			typeof value.statistics === 'boolean' &&
			Number.isFinite(value.savedAt) &&
			value.savedAt <= now &&
			now - value.savedAt < consentLifetime
			? value
			: null;
	} catch {
		return null;
	}
}
let storageBlocked = false;
export function saveConsent(statistics: boolean): boolean {
	try {
		localStorage.setItem(
			consentKey,
			JSON.stringify({ version: 1, statistics, savedAt: Date.now() })
		);
		storageBlocked = false;
		return true;
	} catch {
		storageBlocked = true;
		return false;
	}
}
export function statisticsAllowed(): boolean {
	if (storageBlocked) return false;
	try {
		return readConsent(localStorage.getItem(consentKey))?.statistics === true;
	} catch {
		return false;
	}
}

export function openPrivacySettings(event: MouseEvent) {
	event.preventDefault();
	window.dispatchEvent(new CustomEvent('privacy-settings', { detail: event.currentTarget }));
}
