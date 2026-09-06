import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { currentParticipant } from './participants';

export async function requireMatch(ctx: QueryCtx | MutationCtx, gameId: Id<'games'>) {
	const { participant } = await currentParticipant(ctx);
	const game = await ctx.db.get(gameId);
	if (!participant || !game) throw new ConvexError('MATCH_NOT_FOUND');
	const seat =
		game.whiteParticipantId === participant._id
			? ('white' as const)
			: game.blackParticipantId === participant._id
				? ('black' as const)
				: null;
	if (!seat) throw new ConvexError('MATCH_NOT_FOUND');
	return { game, participant, seat };
}

export function validateRevision(revision: number) {
	if (!Number.isSafeInteger(revision) || revision < 0) throw new ConvexError('INVALID_REVISION');
}
