import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';

export const maintenance = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const now = Date.now();
		const expired = await ctx.db
			.query('games')
			.withIndex('by_status_expiry', (q) => q.eq('status', 'waiting').lte('expiresAt', now))
			.take(50);
		for (const game of expired)
			await ctx.runMutation(internal.games.expireWaiting, { gameId: game._id });
		const candidates = await ctx.db
			.query('games')
			.withIndex('by_purge', (q) => q.gt('purgeAt', null).lte('purgeAt', now))
			.take(50);
		let deleted = 0;
		for (const game of candidates) {
			if (
				game.status !== 'finished' ||
				game.startedAt !== null ||
				game.ply !== 0 ||
				game.result?.reason !== 'cancellation'
			)
				continue;
			if (
				await ctx.db
					.query('moves')
					.withIndex('by_game_ply', (q) => q.eq('gameId', game._id))
					.first()
			)
				continue;
			if (
				await ctx.db
					.query('commands')
					.withIndex('by_request', (q) => q.eq('gameId', game._id))
					.first()
			)
				continue;
			const invitations = await ctx.db
				.query('invites')
				.withIndex('by_game', (q) => q.eq('gameId', game._id))
				.take(10);
			for (const invite of invitations) await ctx.db.delete(invite._id);
			await ctx.db.delete(game._id);
			deleted++;
		}
		const oldLimits = await ctx.db
			.query('rateLimits')
			.withIndex('by_expiry', (q) => q.lte('expiresAt', now))
			.take(100);
		for (const row of oldLimits) await ctx.db.delete(row._id);
		const recent = await ctx.db.system.query('_scheduled_functions').order('desc').take(100);
		const failedSchedules = recent.filter(
			(row) => row.state.kind === 'failed' && row.scheduledTime > now - 86400000
		).length;
		if (failedSchedules)
			console.error(
				JSON.stringify({
					event: 'scheduled_function_failures',
					count: failedSchedules,
					window: 'recent_100_last_day'
				})
			);
		const current = await ctx.db
			.query('operations')
			.withIndex('by_name', (q) => q.eq('name', 'maintenance'))
			.unique();
		const report = {
			name: 'maintenance',
			checkedAt: now,
			expired: expired.length,
			deleted,
			failedSchedules
		};
		if (current) await ctx.db.patch(current._id, report);
		else await ctx.db.insert('operations', report);
		console.info(
			JSON.stringify({
				event: 'maintenance_completed',
				expired: expired.length,
				deleted,
				failedSchedules
			})
		);
		return null;
	}
});

export const status = internalQuery({
	args: {},
	returns: v.object({
		lastCheck: v.union(v.number(), v.null()),
		stale: v.boolean(),
		expiredLastRun: v.number(),
		deletedLastRun: v.number(),
		recentScheduledFailures: v.number()
	}),
	handler: async (ctx) => {
		const report = await ctx.db
			.query('operations')
			.withIndex('by_name', (q) => q.eq('name', 'maintenance'))
			.unique();
		return {
			lastCheck: report?.checkedAt ?? null,
			stale: !report || Date.now() - report.checkedAt > 30 * 60000,
			expiredLastRun: report?.expired ?? 0,
			deletedLastRun: report?.deleted ?? 0,
			recentScheduledFailures: report?.failedSchedules ?? 0
		};
	}
});

export const backfillRetention = internalMutation({
	args: { cursor: v.union(v.string(), v.null()) },
	returns: v.null(),
	handler: async (ctx, { cursor }) => {
		const page = await ctx.db.query('games').paginate({ numItems: 100, cursor });
		for (const game of page.page) {
			if (game.purgeAt !== undefined) continue;
			const unstarted = game.startedAt === null && game.ply === 0;
			await ctx.db.patch(game._id, {
				purgeAt:
					unstarted && (game.status === 'waiting' || game.result?.reason === 'cancellation')
						? (game.finishedAt ?? game.expiresAt) + 7 * 86400000
						: null
			});
		}
		if (!page.isDone)
			await ctx.scheduler.runAfter(0, internal.operations.backfillRetention, {
				cursor: page.continueCursor
			});
		return null;
	}
});
