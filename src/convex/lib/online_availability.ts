import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { endIfDeadlineExpired } from './clocks';

/** Indexed reads conflict with concurrent pairing/join transactions for the same participant. */
export async function activeOnlineGame(
	ctx: MutationCtx,
	participantId: Id<'participants'>
): Promise<Id<'games'> | null> {
	const games = await Promise.all([
		ctx.db
			.query('games')
			.withIndex('by_white_status', (q) =>
				q.eq('whiteParticipantId', participantId).eq('status', 'active')
			)
			.take(2),
		ctx.db
			.query('games')
			.withIndex('by_black_status', (q) =>
				q.eq('blackParticipantId', participantId).eq('status', 'active')
			)
			.take(2)
	]);
	for (const game of games.flat())
		if (!(await endIfDeadlineExpired(ctx, game, Date.now()))) return game._id;
	return null;
}
export async function requireOnlineAvailable(ctx: MutationCtx, participants: Id<'participants'>[]) {
	for (const id of participants)
		if (await activeOnlineGame(ctx, id)) throw new ConvexError('ALREADY_PLAYING');
}
export async function settleWaitingSearches(
	ctx: MutationCtx,
	participantId: Id<'participants'>,
	gameId: Id<'games'>
) {
	const rows = await ctx.db
		.query('matchSearches')
		.withIndex('by_participant_status', (q) =>
			q.eq('participantId', participantId).eq('status', 'waiting')
		)
		.take(2);
	for (const row of rows) await ctx.db.patch(row._id, { status: 'matched', gameId });
}
