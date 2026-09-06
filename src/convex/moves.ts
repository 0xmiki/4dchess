import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { applyMove } from '../lib/chess';
import { mutation, query } from './_generated/server';
import { requireMatch, validateRevision } from './lib/access';
import { validateRequestId } from './lib/invitations';
import { moveDocument, moveReceipt } from './lib/validators';

export const submit = mutation({
	args: {
		gameId: v.id('games'),
		move: v.object({ from: v.number(), to: v.number() }),
		expectedRevision: v.number(),
		requestId: v.string()
	},
	returns: moveReceipt,
	handler: async (ctx, { gameId, move, expectedRevision, requestId }) => {
		validateRequestId(requestId);
		validateRevision(expectedRevision);
		const { game, participant, seat } = await requireMatch(ctx, gameId);
		const previous = await ctx.db
			.query('moves')
			.withIndex('by_request', (q) =>
				q.eq('gameId', gameId).eq('participantId', participant._id).eq('requestId', requestId)
			)
			.unique();
		if (previous) {
			if (
				previous.from !== move.from ||
				previous.to !== move.to ||
				previous.expectedRevision !== expectedRevision
			)
				throw new ConvexError('REQUEST_ID_REUSED');
			return { revision: previous.revision, ply: previous.ply, result: previous.result };
		}
		if (
			await ctx.db
				.query('commands')
				.withIndex('by_request', (q) =>
					q.eq('gameId', gameId).eq('participantId', participant._id).eq('requestId', requestId)
				)
				.unique()
		)
			throw new ConvexError('REQUEST_ID_REUSED');
		if (game.status !== 'active') throw new ConvexError('MATCH_NOT_ACTIVE');
		if (game.revision !== expectedRevision) throw new ConvexError('STALE_REVISION');
		if (game.turn !== (seat === 'white' ? 'w' : 'b')) throw new ConvexError('NOT_YOUR_TURN');
		const applied = applyMove({ ...game, result: null }, move);
		if (!applied.ok) throw new ConvexError(applied.error);
		const next = applied.state;
		const revision = game.revision + 1;
		const createdAt = Date.now();
		await ctx.db.insert('moves', {
			gameId,
			participantId: participant._id,
			requestId,
			expectedRevision,
			revision,
			ply: next.ply,
			...move,
			piece: game.board[move.from]!,
			captured: game.board[move.to],
			createdAt,
			result: next.result
		});
		await ctx.db.patch(gameId, {
			board: [...next.board],
			turn: next.turn,
			ply: next.ply,
			halfmoveClock: next.halfmoveClock,
			positionKeys: [...next.positionKeys],
			result: next.result,
			revision,
			status: next.result ? 'finished' : 'active',
			finishedAt: next.result ? createdAt : null
		});
		return { revision, ply: next.ply, result: next.result };
	}
});

export const list = query({
	args: { gameId: v.id('games'), paginationOpts: paginationOptsValidator },
	returns: v.object({
		page: v.array(moveDocument),
		isDone: v.boolean(),
		continueCursor: v.string(),
		splitCursor: v.optional(v.union(v.string(), v.null())),
		pageStatus: v.optional(
			v.union(v.literal('SplitRecommended'), v.literal('SplitRequired'), v.null())
		)
	}),
	handler: async (ctx, { gameId, paginationOpts }) => {
		await requireMatch(ctx, gameId);
		return await ctx.db
			.query('moves')
			.withIndex('by_game_ply', (q) => q.eq('gameId', gameId))
			.order('desc')
			.paginate({
				...paginationOpts,
				numItems: Math.max(1, Math.min(50, paginationOpts.numItems))
			});
	}
});

export const latest = query({
	args: { gameId: v.id('games') },
	returns: v.union(moveDocument, v.null()),
	handler: async (ctx, { gameId }) => {
		await requireMatch(ctx, gameId);
		return await ctx.db
			.query('moves')
			.withIndex('by_game_ply', (q) => q.eq('gameId', gameId))
			.order('desc')
			.first();
	}
});

export const receipt = query({
	args: { gameId: v.id('games'), requestId: v.string() },
	returns: v.union(moveReceipt, v.null()),
	handler: async (ctx, { gameId, requestId }) => {
		const { participant } = await requireMatch(ctx, gameId);
		const move = await ctx.db
			.query('moves')
			.withIndex('by_request', (q) =>
				q.eq('gameId', gameId).eq('participantId', participant._id).eq('requestId', requestId)
			)
			.unique();
		return move ? { revision: move.revision, ply: move.ply, result: move.result } : null;
	}
});
