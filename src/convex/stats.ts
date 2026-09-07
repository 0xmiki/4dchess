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
				previous.value.checkmates !== undefined &&
				Date.now() - previous.value.sampledAt < 15 * 60000
			)
				return null;
			await ctx.db.delete(previous._id);
		}
		const sampledAt = Date.now();
		const today = Math.floor(sampledAt / 86400000) * 86400000;
		const value = {
			sampledAt,
			started: 0,
			active: 0,
			completed: 0,
			checkmates: 0,
			daily: Array.from({ length: 7 }, (_, i) => ({
				date: new Date(today - (6 - i) * 86400000).toISOString().slice(0, 10),
				started: 0
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
		if (!build || build.value.checkmates === undefined) return null;
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
			const current = await ctx.db
				.query('publicStats')
				.withIndex('by_name', (q) => q.eq('name', 'published'))
				.unique();
			if (current) await ctx.db.patch(current._id, { value });
			else await ctx.db.insert('publicStats', { name: 'published', value });
			await ctx.db.delete(buildId);
		}
		return null;
	}
});
