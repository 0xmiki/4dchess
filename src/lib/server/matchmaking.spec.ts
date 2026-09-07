import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api } from '../../convex/_generated/api';

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'test-only-matchmaking-invitation-secret');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
it('pairs compatible guests atomically, assigns opposite seats, and retries the same search', async () => {
	const t = setup(),
		a = await guest(t),
		b = await guest(t),
		other = await guest(t);
	const args = { requestId: randomUUID(), timeControl: '5+3' as const };
	const first = await a.mutation(api.matchmaking.join, { ...args, presenceVersion: 1 });
	expect(first.status).toBe('waiting');
	expect(await a.mutation(api.matchmaking.join, { ...args, presenceVersion: 1 })).toEqual(first);
	await other.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	const paired = await b.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '5+3'
	});
	expect(paired.status).toBe('matched');
	expect((await a.query(api.matchmaking.current, {}))?.gameId).toBe(paired.gameId);
	const viewA = await a.query(api.games.get, { gameId: paired.gameId! });
	const viewB = await b.query(api.games.get, { gameId: paired.gameId! });
	expect(viewA.seat).not.toBe(viewB.seat);
	expect(viewA.game).toMatchObject({
		kind: 'matchmaking',
		timeControl: '5+3',
		status: 'active',
		ply: 0
	});
	expect((await other.query(api.matchmaking.current, {}))?.status).toBe('waiting');
	expect(
		(
			await a.mutation(api.matchmaking.join, {
				presenceVersion: 1,
				requestId: randomUUID(),
				timeControl: '3+2'
			})
		).gameId
	).toBe(paired.gameId);
	await expect(other.mutation(api.matchmaking.cancel, { id: first.id })).rejects.toThrow(
		'SEARCH_NOT_FOUND'
	);
	expect((await a.mutation(api.matchmaking.join, { ...args, presenceVersion: 1 })).gameId).toBe(
		paired.gameId
	);
});
it('does not pair stale leases or resurrect a cancelled request', async () => {
	const t = setup(),
		a = await guest(t),
		b = await guest(t);
	const args = { requestId: randomUUID(), timeControl: '10+5' as const };
	const search = await a.mutation(api.matchmaking.join, { ...args, presenceVersion: 1 });
	vi.setSystemTime(search.expiresAt + 1);
	expect((await a.mutation(api.matchmaking.heartbeat, { id: search.id })).status).toBe('cancelled');
	expect(
		(
			await b.mutation(api.matchmaking.join, {
				presenceVersion: 1,
				requestId: randomUUID(),
				timeControl: '10+5'
			})
		).status
	).toBe('waiting');
	expect((await a.mutation(api.matchmaking.join, { ...args, presenceVersion: 1 })).status).toBe(
		'cancelled'
	);
});
it('serializes cancellation against pairing without abandoning a created game', async () => {
	const t = setup(),
		a = await guest(t),
		b = await guest(t);
	const search = await a.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	const [cancelled, joined] = await Promise.all([
		a.mutation(api.matchmaking.cancel, { id: search.id }),
		b.mutation(api.matchmaking.join, {
			presenceVersion: 1,
			requestId: randomUUID(),
			timeControl: '3+2'
		})
	]);
	if (cancelled.status === 'matched') expect(cancelled.gameId).toBe(joined.gameId);
	else {
		expect(cancelled.status).toBe('cancelled');
		expect(joined.status).toBe('waiting');
	}
});
it('lets only one competing guest claim a waiting player', async () => {
	const t = setup(),
		a = await guest(t),
		b = await guest(t),
		c = await guest(t);
	await a.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	const results = await Promise.all(
		[b, c].map((player) =>
			player.mutation(api.matchmaking.join, {
				presenceVersion: 1,
				requestId: randomUUID(),
				timeControl: '3+2'
			})
		)
	);
	expect(results.filter((result) => result.status === 'matched')).toHaveLength(1);
	expect(results.filter((result) => result.status === 'waiting')).toHaveLength(1);
	expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(1);
});
it('prevents a friend invitation from starting a second concurrent game', async () => {
	const t = setup(),
		a = await guest(t),
		b = await guest(t),
		c = await guest(t);
	const invitation = await a.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	await a.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	await b.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	await expect(c.mutation(api.games.join, { token: invitation.token })).rejects.toThrow(
		'ALREADY_PLAYING'
	);
});

it('remembers cancellation before a delayed join reaches the server', async () => {
	const t = setup(),
		player = await guest(t);
	const request = { requestId: randomUUID(), timeControl: '3+2' as const };
	expect((await player.mutation(api.matchmaking.cancel, request)).status).toBe('cancelled');
	expect(
		(await player.mutation(api.matchmaking.join, { ...request, presenceVersion: 1 })).status
	).toBe('cancelled');
	expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(0);
});

it('routes a searching player into their accepted friend challenge', async () => {
	const t = setup(),
		creator = await guest(t),
		friend = await guest(t);
	const room = await creator.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	const search = await creator.mutation(api.matchmaking.join, {
		presenceVersion: 1,
		requestId: randomUUID(),
		timeControl: '3+2'
	});
	await friend.mutation(api.games.join, { token: room.token });
	const state = await creator.query(api.matchmaking.current, {});
	expect(state).toMatchObject({ id: search.id, status: 'matched', gameId: room.gameId });
});
