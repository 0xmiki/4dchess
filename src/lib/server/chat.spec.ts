import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setup, guest } from './test-helpers';
import { api, internal } from '../../convex/_generated/api';

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv('INVITE_SECRET', 'test-only-chat-key-not-used-by-any-deployment');
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
async function fixture() {
	const t = setup(),
		white = await guest(t),
		black = await guest(t),
		outsider = await guest(t);
	const room = await white.mutation(api.games.create, { seat: 'white', requestId: randomUUID() });
	await black.mutation(api.games.join, { token: room.token });
	return { t, white, black, outsider, roomId: room.gameId };
}
it('restricts reading, sending and muting to the players, even with a public room URL', async () => {
	const { t, white, black, outsider, roomId } = await fixture();
	await expect(outsider.query(api.chat.list, { roomId })).rejects.toThrow('MATCH_NOT_FOUND');
	await expect(t.query(api.chat.list, { roomId })).rejects.toThrow('UNAUTHENTICATED');
	await expect(
		outsider.mutation(api.chat.send, { roomId, text: 'hello', requestId: randomUUID() })
	).rejects.toThrow('MATCH_NOT_FOUND');
	await expect(outsider.mutation(api.chat.setMuted, { roomId, muted: true })).rejects.toThrow(
		'MATCH_NOT_FOUND'
	);
	await white.mutation(api.chat.send, { roomId, text: 'hello', requestId: randomUUID() });
	expect((await black.query(api.chat.list, { roomId })).messages).toMatchObject([
		{ text: 'hello', mine: false }
	]);
	expect(JSON.stringify(await t.query(api.watch.game, { roomId }))).not.toContain('hello');
});
it('deduplicates retries, rejects changed request IDs, empty/oversized text, and repeated spam', async () => {
	const { white, roomId } = await fixture();
	const args = { roomId, text: 'hello', requestId: randomUUID() };
	await white.mutation(api.chat.send, args);
	await white.mutation(api.chat.send, args);
	expect((await white.query(api.chat.list, { roomId })).messages).toHaveLength(1);
	await expect(white.mutation(api.chat.send, { ...args, text: 'changed' })).rejects.toThrow(
		'REQUEST_ID_REUSED'
	);
	await expect(white.mutation(api.chat.send, { ...args, requestId: randomUUID() })).rejects.toThrow(
		'CHAT_DUPLICATE'
	);
	for (const text of ['   ', '\u200b', 'x'.repeat(501)])
		await expect(
			white.mutation(api.chat.send, { roomId, text, requestId: randomUUID() })
		).rejects.toThrow('CHAT_INVALID');
});
it('limits bursts across requests and allows sending after the bucket refills', async () => {
	const { white, roomId } = await fixture();
	for (let i = 0; i < 3; i++)
		await white.mutation(api.chat.send, { roomId, text: `message ${i}`, requestId: randomUUID() });
	await expect(
		white.mutation(api.chat.send, { roomId, text: 'fourth', requestId: randomUUID() })
	).rejects.toThrow('CHAT_RATE_LIMITED');
	vi.advanceTimersByTime(10000);
	await white.mutation(api.chat.send, { roomId, text: 'fourth', requestId: randomUUID() });
});
it('enforces each player’s mute on the server; an opponent cannot undo it', async () => {
	const { white, black, roomId } = await fixture();
	await white.mutation(api.chat.setMuted, { roomId, muted: true });
	await black.mutation(api.chat.setMuted, { roomId, muted: false });
	expect(await black.query(api.chat.list, { roomId })).toMatchObject({
		muted: false,
		paused: true
	});
	await expect(
		black.mutation(api.chat.send, { roomId, text: 'ignored mute', requestId: randomUUID() })
	).rejects.toThrow('CHAT_MUTED');
	await white.mutation(api.chat.setMuted, { roomId, muted: false });
	await black.mutation(api.chat.send, { roomId, text: 'hello', requestId: randomUUID() });
});
it('hides expired history before cleanup and deletes it without deleting the game', async () => {
	const { t, white, roomId } = await fixture();
	await white.mutation(api.chat.send, { roomId, text: 'hello', requestId: randomUUID() });
	vi.advanceTimersByTime(86400001);
	expect((await white.query(api.chat.list, { roomId })).messages).toEqual([]);
	await t.mutation(internal.chat.cleanup, {});
	expect(await t.run((ctx) => ctx.db.query('chatMessages').collect())).toEqual([]);
	expect(await t.run((ctx) => ctx.db.get(roomId))).not.toBeNull();
});
it('shares chat and mutes across rematches and rejects sends in old finished rooms', async () => {
	const { t, white, black, roomId } = await fixture();
	await white.mutation(api.chat.send, { roomId, text: 'good luck', requestId: randomUUID() });
	await white.mutation(api.games.resign, {
		gameId: roomId,
		expectedRevision: 1,
		requestId: randomUUID()
	});
	const args = { roomId, expectedGameId: roomId, presenceVersion: 1 as const };
	await white.mutation(api.games.rematch, args);
	const next = await black.mutation(api.games.rematch, args);
	expect((await white.query(api.chat.list, { roomId: next })).messages).toHaveLength(1);
	await white.mutation(api.chat.setMuted, { roomId: next, muted: true });
	expect((await black.query(api.chat.list, { roomId })).paused).toBe(true);
	await white.mutation(api.chat.setMuted, { roomId, muted: false });
	await t.run((ctx) =>
		ctx.db.patch(next, { status: 'finished', finishedAt: Date.now() - 86400001 })
	);
	await expect(
		black.mutation(api.chat.send, { roomId, text: 'too late', requestId: randomUUID() })
	).rejects.toThrow('CHAT_CLOSED');
});

it('bounds history to 50 messages and keeps other rooms isolated', async () => {
	const { t, white, black, roomId } = await fixture();
	const game = await t.run((ctx) => ctx.db.get(roomId));
	const another = await white.mutation(api.games.create, {
		seat: 'white',
		requestId: randomUUID()
	});
	await t.run(async (ctx) => {
		for (let i = 0; i < 55; i++)
			await ctx.db.insert('chatMessages', {
				roomId,
				senderId: game!.whiteParticipantId!,
				text: `line ${i}`,
				requestId: randomUUID(),
				expiresAt: Date.now() + 86400000
			});
	});
	expect((await black.query(api.chat.list, { roomId })).messages).toHaveLength(50);
	expect((await white.query(api.chat.list, { roomId: another.gameId })).messages).toEqual([]);
	await expect(
		white.mutation(api.chat.send, {
			roomId: another.gameId,
			text: 'waiting',
			requestId: randomUUID()
		})
	).rejects.toThrow('CHAT_CLOSED');
});
it('applies long-term participant and room limits in addition to the burst limit', async () => {
	const { t, white, roomId } = await fixture();
	const game = await t.run((ctx) => ctx.db.get(roomId));
	for (const key of [`chat:daily:${game!.whiteParticipantId}`, `chat:room:${roomId}`]) {
		const id = await t.run((ctx) =>
			ctx.db.insert('rateLimits', {
				key,
				tokens: 0,
				updatedAt: Date.now(),
				expiresAt: Date.now() + 86400000
			})
		);
		await expect(
			white.mutation(api.chat.send, { roomId, text: 'limited', requestId: randomUUID() })
		).rejects.toThrow('CHAT_RATE_LIMITED');
		await t.run((ctx) => ctx.db.delete(id));
	}
});

it('drains a cleanup backlog in bounded batches while keeping unexpired messages', async () => {
	const { t, white, roomId } = await fixture();
	const game = await t.run((ctx) => ctx.db.get(roomId));
	await t.run(async (ctx) => {
		for (let i = 0; i < 205; i++)
			await ctx.db.insert('chatMessages', {
				roomId,
				senderId: game!.whiteParticipantId!,
				text: 'expired',
				requestId: randomUUID(),
				expiresAt: Date.now() - 1
			});
	});
	await white.mutation(api.chat.send, { roomId, text: 'still here', requestId: randomUUID() });
	await t.mutation(internal.chat.cleanup, {});
	expect(await t.run((ctx) => ctx.db.query('chatMessages').collect())).toHaveLength(6);
	await vi.advanceTimersByTimeAsync(0);
	await t.finishInProgressScheduledFunctions();
	expect((await white.query(api.chat.list, { roomId })).messages).toMatchObject([
		{ text: 'still here' }
	]);
	expect(await t.run((ctx) => ctx.db.query('chatMessages').collect())).toHaveLength(1);
});
