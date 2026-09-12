import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { statsValue } from './lib/stats';
import { consume } from './lib/limits';

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
		const computer = await ctx.db
			.query('computerDays')
			.withIndex('by_date', (q) =>
				q.gte('date', new Date(today - 6 * 86400000).toISOString().slice(0, 10))
			)
			.take(7);
		const value = {
			computer: computer.map(({ date, games }) => ({ date, games })),
			sampledAt,
			started: 0,
			active: 0,
			completed: 0,
			checkmates: 0,
			participants: { total: 0, newToday: 0 },
			today: { started: 0, completed: 0 },
			playingNow: 0,
			outcomes: { checkmate: 0, resignation: 0, draw: 0, timeout: 0, abandonment: 0 },
			gameKinds: { friend: 0, matchmaking: 0 },
			timeControls: { bullet: 0, blitz: 0, rapid: 0, untimed: 0 },
			players: { today: 0, week: 0, month: 0 },
			daily: Array.from({ length: 7 }, (_, i) => ({
				date: new Date(today - (6 - i) * 86400000).toISOString().slice(0, 10),
				started: 0,
				completed: 0,
				newPlayers: 0,
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
		const today = Math.floor(value.sampledAt / 86400000) * 86400000;
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
			if (game.startedAt >= today) value.today!.started++;
			value.gameKinds![game.kind === 'matchmaking' ? 'matchmaking' : 'friend']++;
			const control = game.timeControl ?? 'untimed';
			value.timeControls![
				control === '3+2'
					? 'bullet'
					: control === '5+3'
						? 'blitz'
						: control === '10+5'
							? 'rapid'
							: 'untimed'
			]++;
			if (game.status === 'active') {
				value.active++;
				const presence = await ctx.db
					.query('gamePresence')
					.withIndex('by_game', (q) => q.eq('gameId', game._id))
					.unique();
				if (presence?.whiteOnline && presence.blackOnline) value.playingNow!++;
			}
			if (game.status === 'finished') {
				value.completed++;
				if (game.finishedAt && game.finishedAt >= today) value.today!.completed++;
				if (game.result?.reason === 'checkmate') {
					value.checkmates = (value.checkmates ?? 0) + 1;
					value.outcomes!.checkmate++;
				} else if (game.result?.reason === 'resignation') value.outcomes!.resignation++;
				else if (game.result?.reason === 'draw') value.outcomes!.draw++;
				else if (game.result?.reason === 'timeout') value.outcomes!.timeout++;
				else if (game.result?.reason === 'abandonment') value.outcomes!.abandonment++;
			}
			const day = value.daily.find(
				(d) => d.date === new Date(game.startedAt!).toISOString().slice(0, 10)
			);
			if (day) day.started++;
			const finishedDay = game.finishedAt
				? value.daily.find((d) => d.date === new Date(game.finishedAt!).toISOString().slice(0, 10))
				: undefined;
			if (finishedDay && game.status === 'finished')
				finishedDay.completed = (finishedDay.completed ?? 0) + 1;
		}
		if (!page.isDone) {
			await ctx.db.patch(buildId, { value });
			await ctx.scheduler.runAfter(0, internal.stats.scan, {
				buildId,
				cursor: page.continueCursor
			});
		} else {
			await ctx.db.patch(buildId, { value });
			await ctx.scheduler.runAfter(0, internal.stats.scanParticipants, { buildId, cursor: null });
		}
		return null;
	}
});

export const scanParticipants = internalMutation({
	args: { buildId: v.id('statsBuild'), cursor: v.union(v.string(), v.null()) },
	returns: v.null(),
	handler: async (ctx, { buildId, cursor }) => {
		const build = await ctx.db.get(buildId);
		if (!build) return null;
		const value = build.value;
		const participants = value.participants;
		if (!participants) return null;
		const today = Math.floor(value.sampledAt / 86400000) * 86400000;
		const page = await ctx.db
			.query('participants')
			.withIndex('by_creation_time', (q) => q.lte('_creationTime', value.sampledAt))
			.paginate({ cursor, numItems: 100, maximumBytesRead: 1000000 });
		for (const participant of page.page) {
			participants.total++;
			if (participant._creationTime >= today) participants.newToday++;
			const day = value.daily.find(
				(d) => d.date === new Date(participant._creationTime).toISOString().slice(0, 10)
			);
			if (day) day.newPlayers = (day.newPlayers ?? 0) + 1;
		}
		await ctx.db.patch(buildId, { value });
		if (!page.isDone)
			await ctx.scheduler.runAfter(0, internal.stats.scanParticipants, {
				buildId,
				cursor: page.continueCursor
			});
		else await ctx.scheduler.runAfter(0, internal.stats.scanPlayers, { buildId, cursor: null });
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

// Client-reported activity is approximate, not verified games or unique people.
export const reportComputer = mutation({
	args: { token: v.string(), consentVersion: v.literal(1) },
	returns: v.boolean(),
	handler: async (ctx, { token }) => {
		const now = Date.now();
		const date = new Date(now).toISOString().slice(0, 10);
		if (
			!/^[0-9]{4}-[0-9]{2}-[0-9]{2}:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
				token
			) ||
			!token.startsWith(date + ':')
		)
			return false;
		if (
			await ctx.db
				.query('computerReports')
				.withIndex('by_token', (q) => q.eq('token', token))
				.unique()
		)
			return true;
		// ponytail: global 120/minute cap bounds anonymous writes; use gateway abuse controls if traffic outgrows it.
		if (!(await consume(ctx, 'computer-reports', 120, 60000)).ok) return false;
		await ctx.db.insert('computerReports', { token, expiresAt: now + 2 * 86400000 });
		const day = await ctx.db
			.query('computerDays')
			.withIndex('by_date', (q) => q.eq('date', date))
			.unique();
		if (day) await ctx.db.patch(day._id, { games: day.games + 1 });
		else await ctx.db.insert('computerDays', { date, games: 1 });
		return true;
	}
});
export const cleanupComputer = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const rows = await ctx.db
			.query('computerReports')
			.withIndex('by_expiry', (q) => q.lte('expiresAt', Date.now()))
			.take(100);
		for (const row of rows) await ctx.db.delete(row._id);
		if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.stats.cleanupComputer, {});
		return null;
	}
});
