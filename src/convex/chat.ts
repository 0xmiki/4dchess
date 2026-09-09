import { ConvexError, v } from 'convex/values';
import {
	query,
	mutation,
	internalMutation,
	type QueryCtx,
	type MutationCtx
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { requireMatch } from './lib/access';
import { consume } from './lib/limits';

const DAY = 86400000;
async function roomAccess(ctx: QueryCtx | MutationCtx, roomId: Id<'games'>) {
	const { game, participant } = await requireMatch(ctx, roomId);
	const root = game.roomRootId ? await ctx.db.get(game.roomRootId) : game;
	if (!root) throw new ConvexError('MATCH_NOT_FOUND');
	const current = root.currentGameId ? await ctx.db.get(root.currentGameId) : root;
	const mutes = await ctx.db
		.query('chatMutes')
		.withIndex('by_room', (q) => q.eq('roomId', root._id))
		.take(2);
	return { root, current, participant, mutes };
}

export const list = query({
	args: { roomId: v.id('games') },
	returns: v.object({
		messages: v.array(
			v.object({
				id: v.id('chatMessages'),
				text: v.string(),
				mine: v.boolean(),
				expiresAt: v.number()
			})
		),
		muted: v.boolean(),
		paused: v.boolean(),
		canSend: v.boolean(),
		closesAt: v.union(v.number(), v.null())
	}),
	handler: async (ctx, { roomId }) => {
		const { root, current, participant, mutes } = await roomAccess(ctx, roomId);
		const messages = await ctx.db
			.query('chatMessages')
			.withIndex('by_room', (q) => q.eq('roomId', root._id))
			.order('desc')
			.take(50);
		return {
			messages: messages
				.filter((m) => m.expiresAt > Date.now())
				.reverse()
				.map((m) => ({
					id: m._id,
					text: m.text,
					mine: m.senderId === participant._id,
					expiresAt: m.expiresAt
				})),
			muted: mutes.some((m) => m.participantId === participant._id),
			paused: mutes.length > 0,
			closesAt: current?.status === 'finished' ? (current.finishedAt ?? 0) + DAY : null,
			canSend:
				!!current?.whiteParticipantId &&
				!!current?.blackParticipantId &&
				(current.status === 'active' ||
					(current.status === 'finished' && (current.finishedAt ?? 0) + DAY > Date.now()))
		};
	}
});
export const send = mutation({
	args: { roomId: v.id('games'), text: v.string(), requestId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { root, current, participant, mutes } = await roomAccess(ctx, args.roomId);
		if (args.requestId.length > 64 || !args.requestId.length || args.text.length > 500)
			throw new ConvexError('CHAT_INVALID');
		const text = args.text
			.normalize('NFKC')
			.replace(/\s+/g, ' ')
			.replace(/[\p{Cc}\p{Cf}]/gu, '')
			.trim();
		if (!text || text.length > 500) throw new ConvexError('CHAT_INVALID');
		const prior = await ctx.db
			.query('chatMessages')
			.withIndex('by_request', (q) =>
				q.eq('roomId', root._id).eq('senderId', participant._id).eq('requestId', args.requestId)
			)
			.unique();
		if (prior) {
			if (prior.text !== text) throw new ConvexError('REQUEST_ID_REUSED');
			return null;
		}
		if (mutes.length) throw new ConvexError('CHAT_MUTED');
		if (
			!current?.whiteParticipantId ||
			!current.blackParticipantId ||
			!(
				current.status === 'active' ||
				(current.status === 'finished' && (current.finishedAt ?? 0) + DAY > Date.now())
			)
		)
			throw new ConvexError('CHAT_CLOSED');
		const recent = await ctx.db
			.query('chatMessages')
			.withIndex('by_room', (q) => q.eq('roomId', root._id))
			.order('desc')
			.take(10);
		if (
			recent.some(
				(m) =>
					m.senderId === participant._id &&
					m.text.toLowerCase() === text.toLowerCase() &&
					m._creationTime > Date.now() - 30000
			)
		)
			throw new ConvexError('CHAT_DUPLICATE');
		for (const [key, capacity, period] of [
			[`chat:burst:${participant._id}`, 3, 10000],
			[`chat:daily:${participant._id}`, 200, DAY],
			[`chat:room:${root._id}`, 300, DAY]
		] as const) {
			if (!(await consume(ctx, key, capacity, period)).ok)
				throw new ConvexError('CHAT_RATE_LIMITED');
		}
		await ctx.db.insert('chatMessages', {
			roomId: root._id,
			senderId: participant._id,
			text,
			requestId: args.requestId,
			expiresAt: Date.now() + DAY
		});
		return null;
	}
});
export const setMuted = mutation({
	args: { roomId: v.id('games'), muted: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { roomId, muted }) => {
		const { root, participant, mutes } = await roomAccess(ctx, roomId);
		const own = mutes.find((m) => m.participantId === participant._id);
		if (!!own === muted) return null;
		if (!(await consume(ctx, `chat:mute:${participant._id}`, 5, 60000)).ok)
			throw new ConvexError('CHAT_RATE_LIMITED');
		if (own) await ctx.db.delete(own._id);
		else await ctx.db.insert('chatMutes', { roomId: root._id, participantId: participant._id });
		return null;
	}
});
export const cleanup = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const rows = await ctx.db
			.query('chatMessages')
			.withIndex('by_expiry', (q) => q.lte('expiresAt', Date.now()))
			.take(200);
		for (const row of rows) await ctx.db.delete(row._id);
		if (rows.length === 200) await ctx.scheduler.runAfter(0, internal.chat.cleanup, {});
		return null;
	}
});
