import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
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
							? { reason: i % 2 === 0 ? 'checkmate' : 'resignation', winner: 'white' }
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
		completed: 200,
		checkmates: 100,
		participants: { total: 1, newToday: 1 },
		today: { started: 204, completed: 200 },
		playingNow: 0,
		outcomes: { checkmate: 100, resignation: 100, draw: 0, timeout: 0, abandonment: 0 },
		gameKinds: { friend: 205, matchmaking: 0 },
		timeControls: { bullet: 0, blitz: 0, rapid: 0, untimed: 205 }
	});
	expect(summary?.daily).toHaveLength(7);
	expect(summary?.daily.at(-1)).toEqual({
		date: '2026-09-07',
		started: 204,
		completed: 200,
		newPlayers: 1,
		players: 0
	});
	expect(Object.keys(summary!).sort()).toEqual(
		[
			'sampledAt',
			'computer',
			'started',
			'active',
			'completed',
			'checkmates',
			'participants',
			'today',
			'playingNow',
			'outcomes',
			'gameKinds',
			'timeControls',
			'players',
			'daily'
		].sort()
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

it('deduplicates active players across pages and UTC dates, with independent 7 and 30 day totals', async () => {
	const t = setup();
	const day = 86400000;
	const midnight = Math.floor(Date.now() / day) * day;
	await t.run(async (ctx) => {
		const ids: Id<'participants'>[] = [];
		for (let i = 0; i < 6; i++)
			ids.push(await ctx.db.insert('participants', { guestId: `player-${i}`, userId: null }));
		const gameId = await ctx.db.insert('games', {
			creatorParticipantId: ids[0],
			createRequestId: 'activity-game',
			whiteParticipantId: ids[0],
			blackParticipantId: ids[1],
			status: 'active',
			revision: 1,
			rulesVersion: 'fourfold-v1',
			board: [],
			turn: 'w',
			ply: 0,
			halfmoveClock: 0,
			positionKeys: [],
			result: null,
			expiresAt: Date.now(),
			startedAt: midnight - 31 * day,
			finishedAt: null
		});
		let ply = 0;
		async function move(player: number, time: number) {
			await ctx.db.insert('moves', {
				gameId,
				participantId: ids[player],
				requestId: `move-${ply}`,
				expectedRevision: ply,
				revision: ply + 1,
				ply: ++ply,
				from: 0,
				to: 1,
				piece: { t: 'p', c: 'w' },
				captured: null,
				createdAt: time,
				result: null
			});
		}
		for (let i = 0; i < 105; i++) await move(0, midnight + i);
		await move(0, midnight - 1); // yesterday, same player
		await move(0, midnight - 6 * day); // first day of the 7-day period
		await move(1, midnight - 7 * day); // monthly only
		await move(2, midnight - 29 * day); // first day of the 30-day period
		await move(3, midnight - 29 * day - 1); // outside the 30-day period
		await move(3, Date.now() + day); // future records cannot count
		await move(4, midnight - 1);
		await move(5, midnight); // UTC midnight is today
	});
	vi.setSystemTime(Date.now() + 1000);
	await t.mutation(internal.stats.refresh, {});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	const summary = await t.query(api.stats.publicSummary, {});
	expect(summary?.players).toEqual({ today: 2, week: 3, month: 5 });
	expect(summary?.daily.at(-1)?.players).toBe(2);
	expect(summary?.daily.at(-2)?.players).toBe(2);
	expect(summary?.daily[0].players).toBe(1);
	expect(await t.run((ctx) => ctx.db.query('statsPlayerDays').collect())).toEqual([]);
	await t.mutation(internal.stats.refresh, {});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	expect((await t.query(api.stats.publicSummary, {}))?.players).toEqual(summary?.players);
});

it('counts computer reports once, rejects stale tokens, publishes only totals, and cleans receipts', async () => {
	const t = setup();
	const token = '2026-09-07:12345678-1234-4123-8123-123456789abc';
	expect(await t.mutation(api.stats.reportComputer, { token, consentVersion: 1 })).toBe(true);
	expect(await t.mutation(api.stats.reportComputer, { token, consentVersion: 1 })).toBe(true);
	for (const invalid of ['bad', token.replace('09-07', '09-06')]) {
		expect(await t.mutation(api.stats.reportComputer, { token: invalid, consentVersion: 1 })).toBe(
			false
		);
	}
	await t.mutation(internal.stats.refresh, {});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	const stats = await t.query(api.stats.publicSummary, {});
	expect(stats?.computer).toEqual([{ date: '2026-09-07', games: 1 }]);
	expect(JSON.stringify(stats)).not.toContain(token);
	vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
	await t.mutation(internal.stats.cleanupComputer, {});
	expect(await t.run((ctx) => ctx.db.query('computerReports').collect())).toEqual([]);
	expect(await t.mutation(api.stats.reportComputer, { token, consentVersion: 1 })).toBe(false);
	expect(await t.run((ctx) => ctx.db.query('computerDays').first())).toMatchObject({ games: 1 });
});
