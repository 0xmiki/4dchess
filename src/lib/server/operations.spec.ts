import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api, internal } from '../../convex/_generated/api';
import { signGuestRequest, verifyGuestRequest } from './guest-proof';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
	vi.stubEnv('INVITE_SECRET', 'test-only-invitation-key-not-used-by-any-deployment');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

it('caps open invitations without charging idempotent creation retries', async () => {
	const t = setup(),
		player = await guest(t);
	const request = { seat: 'white' as const, requestId: randomUUID() };
	const first = await player.mutation(api.games.create, request);
	for (let i = 0; i < 4; i++)
		await player.mutation(api.games.create, { ...request, requestId: randomUUID() });
	await expect(
		player.mutation(api.games.create, { ...request, requestId: randomUUID() })
	).rejects.toThrow('TOO_MANY_INVITES');
	expect(await player.mutation(api.games.create, request)).toEqual(first);
	await player.mutation(api.games.cancel, { gameId: first.gameId, expectedRevision: 0 });
	expect(
		await player.mutation(api.games.create, { ...request, requestId: randomUUID() })
	).toHaveProperty('gameId');
});
it('limits creation across cancelled invitations and refills over time', async () => {
	const t = setup(),
		player = await guest(t);
	for (let i = 0; i < 20; i++) {
		const game = await player.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		await player.mutation(api.games.cancel, { gameId: game.gameId, expectedRevision: 0 });
	}
	await expect(
		player.mutation(api.games.create, { seat: 'white', requestId: randomUUID() })
	).rejects.toThrow('RATE_LIMITED');
	vi.setSystemTime(Date.now() + 180000);
	expect(
		await player.mutation(api.games.create, { seat: 'white', requestId: randomUUID() })
	).toHaveProperty('gameId');
});
it('persists signup throttling even when further authentication never succeeds', async () => {
	const t = setup();
	const attempts = await Promise.all(
		Array.from({ length: 11 }, () =>
			t.mutation(internal.abuse.reserveGuest, { clientKey: 'test-client' })
		)
	);
	expect(attempts.filter((result) => result.ok)).toHaveLength(10);
	expect(
		(await t.mutation(internal.abuse.reserveGuest, { clientKey: 'test-client' })).retryAfterMs
	).toBeGreaterThan(0);
});
it('purges only abandoned games after seven days and keeps active or played games', async () => {
	const t = setup(),
		white = await guest(t),
		black = await guest(t);
	const abandoned = await white.mutation(api.games.create, {
		seat: 'white',
		requestId: randomUUID()
	});
	const active = await white.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	await black.mutation(api.games.join, { token: active.token });
	vi.setSystemTime(Date.now() + 86400000);
	await t.mutation(internal.operations.maintenance);
	expect((await white.query(api.games.get, { gameId: abandoned.gameId })).game.status).toBe(
		'finished'
	);
	vi.setSystemTime(Date.now() + 7 * 86400000);
	await t.mutation(internal.operations.maintenance);
	await expect(white.query(api.games.get, { gameId: abandoned.gameId })).rejects.toThrow(
		'MATCH_NOT_FOUND'
	);
	expect((await white.query(api.games.get, { gameId: active.gameId })).game.status).toBe('active');
	expect((await t.query(internal.operations.status)).stale).toBe(false);
	vi.setSystemTime(Date.now() + 31 * 60000);
	expect((await t.query(internal.operations.status)).stale).toBe(true);
});
it('verifies proxy proofs and rejects forged or expired headers', async () => {
	const secret = 'test-only-proxy-key-not-used-by-any-deployment';
	const signed = await signGuestRequest(secret, '192.0.2.1');
	const headers = new Headers({
		'x-fourfold-client': signed.clientKey,
		'x-fourfold-time': signed.timestamp,
		'x-fourfold-proof': signed.proof
	});
	expect(await verifyGuestRequest(secret, headers)).toBe(signed.clientKey);
	expect(await verifyGuestRequest(secret, headers, Date.now() + 61000)).toBeNull();
	headers.set('x-fourfold-client', 'a'.repeat(64));
	expect(await verifyGuestRequest(secret, headers)).toBeNull();
	expect(await verifyGuestRequest(secret, new Headers())).toBeNull();
});
