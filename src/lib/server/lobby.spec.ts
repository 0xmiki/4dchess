/// <reference types="vite/client" />
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import betterAuthTest from '@convex-dev/better-auth/test';
import schema from '../../convex/schema';
import { api, components, internal } from '../../convex/_generated/api';

const modules = import.meta.glob([
	'../../convex/**/*.ts',
	'../../convex/**/*.js',
	'!../../convex/**/*.d.ts'
]);
const day = 24 * 60 * 60 * 1000;

function setup() {
	const t = convexTest(schema, modules);
	betterAuthTest.register(t);
	return t;
}

async function guest(t: ReturnType<typeof setup>) {
	const now = Date.now();
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				name: 'Guest',
				email: `${randomUUID()}@example.invalid`,
				emailVerified: false,
				isAnonymous: true,
				createdAt: now,
				updatedAt: now
			}
		}
	});
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				userId: user._id,
				token: randomUUID(),
				expiresAt: now + 30 * day,
				createdAt: now,
				updatedAt: now
			}
		}
	});
	return t.withIdentity({ subject: user._id, sessionId: session._id });
}

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

describe('guest participants', () => {
	it('requires a real, unexpired authenticated session', async () => {
		const t = setup();
		expect(await t.query(api.participants.me)).toBeNull();
		await expect(t.mutation(api.participants.ensure)).rejects.toThrow('UNAUTHENTICATED');
		const player = await guest(t);
		vi.setSystemTime(Date.now() + 31 * day);
		await expect(player.mutation(api.participants.ensure)).rejects.toThrow('UNAUTHENTICATED');
	});

	it('resolves concurrent requests from the same guest to one participant', async () => {
		const t = setup();
		const player = await guest(t);
		const ids = await Promise.all(
			Array.from({ length: 3 }, () => player.mutation(api.participants.ensure))
		);
		expect(new Set(ids).size).toBe(1);
		expect(await player.query(api.participants.me)).toEqual({
			participantId: ids[0],
			isGuest: true
		});
		const records = await t.run((ctx) => ctx.db.query('participants').collect());
		expect(records).toHaveLength(1);
		expect(records[0].guestId).toBeTruthy();
		expect(records[0].userId).toBeNull();
	});
});

describe('match creation and invitation access', () => {
	it.each(['white', 'black'] as const)(
		"reserves the creator's %s seat and initializes the rules",
		async (seat) => {
			const t = setup();
			const creator = await guest(t);
			const created = await creator.mutation(api.games.create, { seat, requestId: randomUUID() });
			const view = await creator.query(api.games.get, { gameId: created.gameId });
			expect(view.seat).toBe(seat);
			expect(view.game).toMatchObject({
				status: 'waiting',
				revision: 0,
				ply: 0,
				rulesVersion: 'fourfold-v1',
				turn: 'w',
				result: null,
				startedAt: null,
				finishedAt: null
			});
			expect(view.game.board).toHaveLength(64);
			expect(created.expiresAt).toBe(Date.now() + day);
			expect(view.game[seat === 'white' ? 'blackParticipantId' : 'whiteParticipantId']).toBeNull();
		}
	);

	it('returns the same match and invitation on retries, rejecting changed request contents', async () => {
		const t = setup();
		const creator = await guest(t);
		const requestId = randomUUID();
		const attempts = await Promise.all(
			Array.from({ length: 3 }, () =>
				creator.mutation(api.games.create, { seat: 'white', requestId })
			)
		);
		expect(attempts[1]).toEqual(attempts[0]);
		expect(attempts[2]).toEqual(attempts[0]);
		await expect(creator.mutation(api.games.create, { seat: 'black', requestId })).rejects.toThrow(
			'REQUEST_ID_REUSED'
		);
		expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query('invites').collect())).toHaveLength(1);
	});

	it('stores only the token hash and allows the creator to recover an open invitation', async () => {
		const t = setup();
		const creator = await guest(t);
		const stranger = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		expect(created.token).toMatch(/^[a-f0-9]{64}$/);
		const invite = await t.run((ctx) => ctx.db.query('invites').unique());
		expect(invite?.tokenHash).not.toBe(created.token);
		expect(JSON.stringify(invite)).not.toContain(created.token);
		expect(await creator.query(api.games.getInvitation, { gameId: created.gameId })).toBe(
			created.token
		);
		await expect(
			stranger.query(api.games.getInvitation, { gameId: created.gameId })
		).rejects.toThrow('MATCH_NOT_FOUND');
		await expect(stranger.query(api.games.get, { gameId: created.gameId })).rejects.toThrow(
			'MATCH_NOT_FOUND'
		);
	});

	it('previews an invitation without creating a guest, participant, or seat', async () => {
		const t = setup();
		const creator = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'black',
			requestId: randomUUID()
		});
		const preview = await t.query(api.games.previewInvite, { token: created.token });
		expect(preview).toEqual({
			challengerName: expect.any(String),
			gameId: created.gameId,
			availableSeat: 'white',
			expiresAt: created.expiresAt,
			status: 'waiting'
		});
		expect(await t.run((ctx) => ctx.db.query('participants').collect())).toHaveLength(1);
		expect((await creator.query(api.games.get, { gameId: created.gameId })).game.revision).toBe(0);
	});

	it('rejects malformed input and unknown tokens', async () => {
		const t = setup();
		const creator = await guest(t);
		await expect(
			creator.mutation(api.games.create, { seat: 'white', requestId: '' })
		).rejects.toThrow('INVALID_REQUEST_ID');
		await expect(t.query(api.games.previewInvite, { token: 'short' })).rejects.toThrow(
			'INVALID_INVITE'
		);
		await expect(creator.mutation(api.games.join, { token: 'a'.repeat(64) })).rejects.toThrow(
			'INVALID_INVITE'
		);
		expect(await t.run((ctx) => ctx.db.query('games').collect())).toEqual([]);
	});
});

describe('joining and restoring seats', () => {
	it('admits exactly one of three simultaneous joiners', async () => {
		const t = setup();
		const creator = await guest(t);
		const joiners = await Promise.all([guest(t), guest(t), guest(t)]);
		const created = await creator.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		const attempts = await Promise.allSettled(
			joiners.map((player) => player.mutation(api.games.join, { token: created.token }))
		);
		expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
		for (const attempt of attempts)
			if (attempt.status === 'rejected') expect(String(attempt.reason)).toContain('MATCH_FULL');
		const winner = attempts.findIndex((attempt) => attempt.status === 'fulfilled');
		const retry = await joiners[winner].mutation(api.games.join, { token: created.token });
		expect(retry).toEqual({ gameId: created.gameId, seat: 'black', revision: 1 });
		const restored = await joiners[winner].query(api.games.get, { gameId: created.gameId });
		expect(restored.seat).toBe('black');
		expect(restored.game.status).toBe('active');
		expect(restored.game.revision).toBe(1);
		expect(restored.game.ply).toBe(0);
		expect(restored.game.whiteParticipantId).not.toBe(restored.game.blackParticipantId);
		expect((await t.run((ctx) => ctx.db.query('invites').unique()))?.status).toBe('consumed');
	});

	it('does not let the creator claim the other seat', async () => {
		const t = setup();
		const creator = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'black',
			requestId: randomUUID()
		});
		expect(await creator.mutation(api.games.join, { token: created.token })).toEqual({
			gameId: created.gameId,
			seat: 'black',
			revision: 0
		});
		expect((await creator.query(api.games.get, { gameId: created.gameId })).game.status).toBe(
			'waiting'
		);
	});

	it('preserves active matches and both seats beyond the invitation deadline', async () => {
		const t = setup();
		const creator = await guest(t);
		const friend = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'black',
			requestId: randomUUID()
		});
		await friend.mutation(api.games.join, { token: created.token });
		vi.setSystemTime(Date.now() + 2 * day);
		await t.mutation(internal.games.expireWaiting, { gameId: created.gameId });
		expect(await friend.mutation(api.games.join, { token: created.token })).toEqual({
			gameId: created.gameId,
			seat: 'white',
			revision: 1
		});
		const { game } = await creator.query(api.games.get, { gameId: created.gameId });
		expect(game.status).toBe('active');
		expect(game.result).toBeNull();
		expect(game.finishedAt).toBeNull();
	});
});

describe('waiting match endings', () => {
	it('rejects a join at the deadline even before the scheduled expiry runs', async () => {
		const t = setup();
		const creator = await guest(t);
		const friend = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		vi.setSystemTime(created.expiresAt);
		await expect(friend.mutation(api.games.join, { token: created.token })).rejects.toThrow(
			'INVITE_EXPIRED'
		);
		expect(
			(await t.query(api.games.previewInvite, { token: created.token })).availableSeat
		).toBeNull();
		await t.mutation(internal.games.expireWaiting, { gameId: created.gameId });
		await t.mutation(internal.games.expireWaiting, { gameId: created.gameId });
		expect((await creator.query(api.games.get, { gameId: created.gameId })).game).toMatchObject({
			status: 'finished',
			revision: 1,
			result: { reason: 'cancellation', detail: 'inviteExpired', winner: null }
		});
	});

	it('runs the scheduled expiration with both browsers absent', async () => {
		const t = setup();
		const creator = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(day));
		expect((await creator.query(api.games.get, { gameId: created.gameId })).game.result).toEqual({
			reason: 'cancellation',
			detail: 'inviteExpired',
			winner: null
		});
	});

	it('restricts cancellation to the creator and makes retries harmless', async () => {
		const t = setup();
		const creator = await guest(t);
		const stranger = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		const args = { gameId: created.gameId, expectedRevision: 0 };
		await expect(stranger.mutation(api.games.cancel, args)).rejects.toThrow('MATCH_NOT_FOUND');
		await expect(
			creator.mutation(api.games.cancel, { ...args, expectedRevision: 1 })
		).rejects.toThrow('STALE_REVISION');
		await creator.mutation(api.games.cancel, args);
		await creator.mutation(api.games.cancel, args);
		await expect(stranger.mutation(api.games.join, { token: created.token })).rejects.toThrow(
			'INVITE_CLOSED'
		);
		expect((await creator.query(api.games.get, { gameId: created.gameId })).game).toMatchObject({
			revision: 1,
			status: 'finished',
			result: { reason: 'cancellation', detail: 'creatorCancelled', winner: null }
		});
	});

	it('serializes cancellation against joining', async () => {
		const t = setup();
		const creator = await guest(t);
		const friend = await guest(t);
		const created = await creator.mutation(api.games.create, {
			seat: 'white',
			requestId: randomUUID()
		});
		const attempts = await Promise.allSettled([
			creator.mutation(api.games.cancel, { gameId: created.gameId, expectedRevision: 0 }),
			friend.mutation(api.games.join, { token: created.token })
		]);
		expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
		const { game } = await creator.query(api.games.get, { gameId: created.gameId });
		expect(game.revision).toBe(1);
		if (game.status === 'active') expect(game.result).toBeNull();
		else
			expect(game.result).toEqual({
				reason: 'cancellation',
				detail: 'creatorCancelled',
				winner: null
			});
	});
});
