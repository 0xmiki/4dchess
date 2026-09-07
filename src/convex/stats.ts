import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { statsValue } from './lib/stats';

// Public reads touch one aggregate document, never game or participant records.
export const publicSummary = query({
	args: {},
	returns: v.union(v.null(), statsValue),
	handler: async (ctx) => {
		const row = await ctx.db
			.query('publicStats')
			.withIndex('by_name', (q) => q.eq('name', 'published'))
			.unique();
		return row?.value ?? null;
	}
});

// Build in bounded pages, then publish atomically. An interrupted build is replaced
// at the next cron tick. Old scheduled pages cannot overwrite a newer build.
export const refresh = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const previous = await ctx.db.query('statsBuild').first();
		if (previous) {
			if (
				previous.value.players !== undefined &&
				Date.now() - previous.value.sampledAt < 15 * 60000
			)
				return null;
			await ctx.db.delete(previous._id);
			await ctx.scheduler.runAfter(0, internal.stats.cleanupPlayers, { buildId: previous._id });
		}
		const sampledAt = Date.now();
		const today = Math.floor(sampledAt / 86400000) * 86400000;
		const value = {
			sampledAt,
			started: 0,
			active: 0,
			completed: 0,
			checkmates: 0,
			players: { today: 0, week: 0, month: 0 },
			daily: Array.from({ length: 7 }, (_, i) => ({
				date: new Date(today - (6 - i) * 86400000).toISOString().slice(0, 10),
				started: 0,
				players: 0
			}))
		};
		const buildId = await ctx.db.insert('statsBuild', { value });
		await ctx.scheduler.runAfter(0, internal.stats.scan, { buildId, cursor: null });
		return null;
	}
});
export const scan = internalMutation({
	args: { buildId: v.id('statsBuild'), cursor: v.union(v.string(), v.null()) },
	returns: v.null(),
	handler: async (ctx, { buildId, cursor }) => {
		const build = await ctx.db.get(buildId);
		if (!build || build.value.players === undefined) return null;
		const value = build.value;
		const page = await ctx.db
			.query('games')
			.withIndex('by_creation_time', (q) => q.lte('_creationTime', value.sampledAt))
			.paginate({ cursor, numItems: 100, maximumBytesRead: 1000000 });
		for (const game of page.page) {
			if (
				game.startedAt === null ||
				game.startedAt > value.sampledAt ||
				game.result?.reason === 'cancellation' ||
				game.result?.reason === 'aborted'
			)
				continue;
			value.started++;
			if (game.status === 'active') value.active++;
			if (game.status === 'finished') {
				value.completed++;
				if (game.result?.reason === 'checkmate') value.checkmates = (value.checkmates ?? 0) + 1;
			}
			const day = value.daily.find(
				(d) => d.date === new Date(game.startedAt!).toISOString().slice(0, 10)
			);
			if (day) day.started++;
		}
		if (!page.isDone) {
			await ctx.db.patch(buildId, { value });
			await ctx.scheduler.runAfter(0, internal.stats.scan, {
				buildId,
				cursor: page.continueCursor
			});
		} else {
			await ctx.db.patch(buildId, { value });
			await ctx.scheduler.runAfter(0, internal.stats.scanPlayers, { buildId, cursor: null });
		}
		return null;
	}
});

// Deduplicate participants across days and scan pages using private temporary rows.
// A 30-bit mask holds UTC activity dates; no player IDs enter the public summary.
export const scanPlayers = internalMutation({
	args: { buildId: v.id('statsBuild'), cursor: v.union(v.string(), v.null()) },
	returns: v.null(),
	handler: async (ctx, { buildId, cursor }) => {
		const build = await ctx.db.get(buildId);
		if (!build || !build.value.players) return null;
		const value = build.value;
		const players = build.value.players;
		const today = Math.floor(value.sampledAt / 86400000) * 86400000;
		const page = await ctx.db
			.query('moves')
			.withIndex('by_created', (q) =>
				q.gte('createdAt', today - 29 * 86400000).lte('createdAt', value.sampledAt)
			)
			.paginate({ cursor, numItems: 100, maximumBytesRead: 1000000 });
		for (const move of page.page) {
			const age = Math.floor((today - Math.floor(move.createdAt / 86400000) * 86400000) / 86400000);
			const bit = 1 << age;
			const row = await ctx.db
				.query('statsPlayerDays')
				.withIndex('by_build_player', (q) =>
					q.eq('buildId', buildId).eq('participantId', move.participantId)
				)
				.unique();
			const before = row?.days ?? 0;
			if (before & bit) continue;
			if (before === 0) players.month++;
			if (age < 7 && (before & 127) === 0) players.week++;
			if (age === 0) players.today++;
			if (age < 7) {
				const day = value.daily[6 - age];
				day.players = (day.players ?? 0) + 1;
			}
			if (row) await ctx.db.patch(row._id, { days: before | bit });
			else
				await ctx.db.insert('statsPlayerDays', {
					buildId,
					participantId: move.participantId,
					days: bit
				});
		}
		if (!page.isDone) {
			await ctx.db.patch(buildId, { value });
			await ctx.scheduler.runAfter(0, internal.stats.scanPlayers, {
				buildId,
				cursor: page.continueCursor
			});
		} else {
			const current = await ctx.db
				.query('publicStats')
				.withIndex('by_name', (q) => q.eq('name', 'published'))
				.unique();
			if (current) await ctx.db.patch(current._id, { value });
			else await ctx.db.insert('publicStats', { name: 'published', value });
			await ctx.db.delete(buildId);
			await ctx.scheduler.runAfter(0, internal.stats.cleanupPlayers, { buildId });
		}
		return null;
	}
});

export const cleanupPlayers = internalMutation({
	args: { buildId: v.id('statsBuild') },
	returns: v.null(),
	handler: async (ctx, { buildId }) => {
		const rows = await ctx.db
			.query('statsPlayerDays')
			.withIndex('by_build_player', (q) => q.eq('buildId', buildId))
			.take(100);
		for (const row of rows) await ctx.db.delete(row._id);
		if (rows.length === 100)
			await ctx.scheduler.runAfter(0, internal.stats.cleanupPlayers, { buildId });
		return null;
	}
});
