import { query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { authComponent } from './auth';
import { currentParticipant, participantName } from './lib/participants';
import { isUnscoredResult } from '../lib/online/outcomes';
import { clockState, color, piece, result, timeControl } from './lib/validators';

async function currentGame(ctx: QueryCtx, roomId: Id<'games'>) {
	const requested = await ctx.db.get(roomId);
	const root = requested?.roomRootId ? await ctx.db.get(requested.roomRootId) : requested;
	return root?.currentGameId ? await ctx.db.get(root.currentGameId) : root;
}

// Reading a room does not create a guest or expose a participant identifier.
export const role = query({
	args: { roomId: v.id('games') },
	returns: v.union(color, v.literal('spectator')),
	handler: async (ctx, { roomId }) => {
		if (!(await authComponent.safeGetAuthUser(ctx))) return 'spectator' as const;
		const { participant } = await currentParticipant(ctx);
		const game = await currentGame(ctx, roomId);
		if (participant && game?.whiteParticipantId === participant._id) return 'white' as const;
		if (participant && game?.blackParticipantId === participant._id) return 'black' as const;
		return 'spectator' as const;
	}
});

const publicGame = v.object({
	id: v.id('games'),
	round: v.number(),
	status: v.union(v.literal('waiting'), v.literal('active'), v.literal('finished')),
	board: v.array(v.union(piece, v.null())),
	turn: v.union(v.literal('w'), v.literal('b')),
	ply: v.number(),
	result,
	timeControl: v.optional(timeControl),
	clock: v.optional(clockState),
	players: v.object({ white: v.union(v.string(), v.null()), black: v.union(v.string(), v.null()) })
});
export const game = query({
	args: { roomId: v.id('games') },
	returns: v.union(publicGame, v.null()),
	handler: async (ctx, { roomId }) => {
		const game = await currentGame(ctx, roomId);
		if (!game) return null;
		return {
			id: game._id,
			round: game.round ?? 1,
			status: game.status,
			board: game.board,
			turn: game.turn,
			ply: game.ply,
			result: game.result,
			timeControl: game.timeControl,
			clock: game.clock,
			players: {
				white: game.whiteParticipantId ? await participantName(ctx, game.whiteParticipantId) : null,
				black: game.blackParticipantId ? await participantName(ctx, game.blackParticipantId) : null
			}
		};
	}
});
const publicMove = v.object({
	gameId: v.id('games'),
	ply: v.number(),
	from: v.number(),
	to: v.number(),
	piece,
	captured: v.union(piece, v.null())
});
export const moves = query({
	args: { gameId: v.id('games'), paginationOpts: paginationOptsValidator },
	returns: v.object({
		page: v.array(publicMove),
		isDone: v.boolean(),
		continueCursor: v.string(),
		splitCursor: v.optional(v.union(v.string(), v.null())),
		pageStatus: v.optional(
			v.union(v.literal('SplitRecommended'), v.literal('SplitRequired'), v.null())
		)
	}),
	handler: async (ctx, { gameId, paginationOpts }) => {
		const page = await ctx.db
			.query('moves')
			.withIndex('by_game_ply', (q) => q.eq('gameId', gameId))
			.order('asc')
			.paginate({
				...paginationOpts,
				numItems: Math.max(1, Math.min(100, paginationOpts.numItems))
			});
		return {
			...page,
			page: page.page.map(({ ply, from, to, piece, captured }) => ({
				gameId,
				ply,
				from,
				to,
				piece,
				captured
			}))
		};
	}
});
export const score = query({
	args: { roomId: v.id('games') },
	returns: v.object({ white: v.number(), black: v.number(), games: v.number() }),
	handler: async (ctx, { roomId }) => {
		const game = await currentGame(ctx, roomId);
		const score = { white: 0, black: 0, games: 0 };
		if (!game) return score;
		const root = game.roomRootId ? await ctx.db.get(game.roomRootId) : game;
		if (!root) return score;
		const rounds = await ctx.db
			.query('games')
			.withIndex('by_room_round', (q) => q.eq('roomRootId', root._id))
			.collect();
		if (!rounds.some((round) => round._id === root._id)) rounds.push(root);
		for (const round of rounds) {
			if (round.status !== 'finished' || isUnscoredResult(round.result)) continue;
			score.games++;
			if (!round.result?.winner) {
				score.white += 0.5;
				score.black += 0.5;
			} else {
				const winner =
					round.result.winner === 'white' ? round.whiteParticipantId : round.blackParticipantId;
				if (winner === game.whiteParticipantId) score.white++;
				else if (winner === game.blackParticipantId) score.black++;
			}
		}
		return score;
	}
});

// A normal game has at most 18 captures. The index avoids scanning quiet moves.
export const captures = query({
	args: { gameId: v.id('games'), throughPly: v.number() },
	returns: v.array(v.object({ ply: v.number(), piece, captured: piece })),
	handler: async (ctx, { gameId, throughPly }) => {
		const moves = await ctx.db
			.query('moves')
			.withIndex('by_game_capture', (q) => q.eq('gameId', gameId).gt('captured', null))
			.collect();
		return moves
			.filter((move) => move.ply <= throughPly && move.captured)
			.map((move) => ({ ply: move.ply, piece: move.piece, captured: move.captured! }));
	}
});
