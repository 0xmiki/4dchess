import { afterEach, expect, it, vi } from 'vitest';
import { activeMatch, leaveMatch, rememberMatch } from './active-match';
afterEach(() => vi.unstubAllGlobals());
it('migrates an existing computer game but respects an explicit leave', () => {
	const data = new Map([
		['fourfold-computer-v1', JSON.stringify({ version: 1, moves: [], player: 'w' })]
	]);
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => data.set(key, value),
		removeItem: (key: string) => data.delete(key)
	});
	expect(activeMatch()).toEqual({ kind: 'computer' });
	leaveMatch();
	expect(activeMatch()).toBeNull();
	expect(data.has('fourfold-computer-v1')).toBe(true);
	rememberMatch({ kind: 'friend', gameId: 'abc123' });
	expect(activeMatch()).toEqual({ kind: 'friend', gameId: 'abc123' });
});

it('does not resume a finished saved game even with a stale active pointer', () => {
	const moves = [
		{ from: 0, to: 32 },
		{ from: 63, to: 31 },
		{ from: 32, to: 0 },
		{ from: 31, to: 63 },
		{ from: 0, to: 32 },
		{ from: 63, to: 31 },
		{ from: 32, to: 0 },
		{ from: 31, to: 63 }
	];
	const saved = JSON.stringify({ version: 1, player: 'w', moves });
	const data = new Map([
		['fourfold-computer-v1', saved],
		['fourfold-active-match', JSON.stringify({ kind: 'computer' })]
	]);
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => data.set(key, value),
		removeItem: (key: string) => data.delete(key)
	});
	expect(activeMatch()).toBeNull();
	expect(data.get('fourfold-computer-v1')).toBe(saved);
	expect(data.get('fourfold-active-match')).toBe('null');
});
