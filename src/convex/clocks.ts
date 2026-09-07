import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';
import { endIfDeadlineExpired } from './lib/clocks';

export const expire = internalMutation({
	args: { gameId: v.id('games'), revision: v.number() },
	returns: v.null(),
	handler: async (ctx, { gameId, revision }): Promise<null> => {
		const game = await ctx.db.get(gameId);
		if (game && game.revision === revision) await endIfDeadlineExpired(ctx, game, Date.now());
		return null;
	}
});
// A distinct sample prevents a cached query timestamp from being reused as "now".
export const time = query({
	args: { sample: v.string() },
	returns: v.number(),
	handler: () => Date.now()
});
