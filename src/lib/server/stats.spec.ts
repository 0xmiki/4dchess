import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setup } from './test-helpers';
import { api, internal } from '../../convex/_generated/api';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

it('publishes anonymous totals across pages, excludes unstarted games, and rebuilds without double counting', async () => {
	const t = setup();
	expect(await t.query(api.stats.publicSummary, {})).toBeNull();
	await t.run(async (ctx) => {
		const player = await ctx.db.insert('participants', {
			guestId: 'private-guest',
			userId: null,
			displayName: 'Private name'
		});
		for (let i = 0; i < 206; i++) {
			await ctx.db.insert('games', {
				creatorParticipantId: player,
				createRequestId: `private-${i}`,
				whiteParticipantId: player,
				blackParticipantId: player,
				status: i < 200 || i === 205 ? 'finished' : 'active',
				revision: 1,
				rulesVersion: 'fourfold-v1',
				board: [],
				turn: 'w',
				ply: 10,
				halfmoveClock: 0,
				positionKeys: [],
				result:
					i === 205
						? { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' }
						: i < 200
							? { reason: 'resignation', winner: 'white' }
							: null,
				expiresAt: Date.now(),
				startedAt: Date.now() - (i === 0 ? 8 * 86400000 : 1000),
				finishedAt: i < 200 ? Date.now() : null
			});
		}
		await ctx.db.insert('games', {
			creatorParticipantId: player,
			createRequestId: 'cancelled',
			whiteParticipantId: player,
			blackParticipantId: null,
			status: 'finished',
			revision: 1,
			rulesVersion: 'fourfold-v1',
			board: [],
			turn: 'w',
			ply: 0,
			halfmoveClock: 0,
			positionKeys: [],
			result: { reason: 'cancellation', winner: null, detail: 'inviteExpired' },
			expiresAt: Date.now(),
			startedAt: null,
			finishedAt: Date.now()
		});
	});
	vi.setSystemTime(Date.now() + 1000);
	await t.mutation(internal.stats.refresh, {});
	expect(await t.query(api.stats.publicSummary, {})).toBeNull();
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	const summary = await t.query(api.stats.publicSummary, {});
	expect(summary).toMatchObject({
		started: 205,
		active: 5,
		completed: 200
	});
	expect(summary?.daily).toHaveLength(7);
	expect(summary?.daily.at(-1)).toEqual({ date: '2026-09-07', started: 204 });
	expect(Object.keys(summary!).sort()).toEqual(
		['sampledAt', 'started', 'active', 'completed', 'daily'].sort()
	);
	expect(JSON.stringify(summary)).not.toMatch(/private|Participant|gameId/);
	await t.mutation(internal.stats.refresh, {});
	expect(await t.query(api.stats.publicSummary, {})).toEqual(summary);
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await t.query(api.stats.publicSummary, {})).toEqual(summary);
});

it('keeps the last snapshot while an interrupted build is replaced', async () => {
	const t = setup();
	await t.mutation(internal.stats.refresh, {});
	const old = await t.run((ctx) => ctx.db.query('statsBuild').first());
	await t.mutation(internal.stats.refresh, {});
	expect(await t.run((ctx) => ctx.db.query('statsBuild').collect())).toHaveLength(1);
	vi.setSystemTime(Date.now() + 16 * 60000);
	await t.mutation(internal.stats.refresh, {});
	await t.mutation(internal.stats.scan, { buildId: old!._id, cursor: null });
	expect(await t.query(api.stats.publicSummary, {})).toBeNull();
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await t.query(api.stats.publicSummary, {})).toMatchObject({ started: 0, active: 0 });
});
