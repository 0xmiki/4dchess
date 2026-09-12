import { expect, it, vi } from 'vitest';
import {
	consentKey,
	consentLifetime,
	readConsent,
	saveConsent,
	statisticsAllowed
} from './privacy';

it('requires current explicit consent and fails closed on missing, expired or blocked storage', () => {
	const now = Date.now();
	const consent = (statistics: boolean, savedAt = now, version = 1) =>
		JSON.stringify({ version, statistics, savedAt });
	expect(readConsent(consent(true), now)?.statistics).toBe(true);
	expect(readConsent(consent(false), now)?.statistics).toBe(false);
	for (const raw of [
		null,
		'{',
		'{}',
		consent(true, now, 2),
		consent(true, now + 1),
		consent(true, now - consentLifetime)
	]) {
		expect(readConsent(raw, now)).toBeNull();
	}
	let raw = consent(false);
	vi.stubGlobal('localStorage', { getItem: (key: string) => (key === consentKey ? raw : null) });
	try {
		expect(statisticsAllowed()).toBe(false);
		raw = consent(true);
		expect(statisticsAllowed()).toBe(true);
		raw = consent(false);
		expect(statisticsAllowed()).toBe(false);
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw Error('Blocked');
			}
		});
		expect(statisticsAllowed()).toBe(false);
		raw = consent(true);
		expect(saveConsent(false)).toBe(false);
		expect(statisticsAllowed()).toBe(false);
		vi.stubGlobal('localStorage', {
			getItem: () => raw,
			setItem: (_key: string, value: string) => {
				raw = value;
			}
		});
		expect(saveConsent(false)).toBe(true);
		expect(statisticsAllowed()).toBe(false);
	} finally {
		vi.unstubAllGlobals();
	}
});
