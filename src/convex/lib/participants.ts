import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { authComponent } from '../auth';
import { guestName } from '../../lib/guest-name';
import type { Id } from '../_generated/dataModel';

export async function participantName(ctx: QueryCtx | MutationCtx, id: Id<'participants'>) {
	const participant = await ctx.db.get(id);
	return participant?.displayName ?? guestName(id);
}

export async function currentParticipant(ctx: QueryCtx | MutationCtx) {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user) throw new ConvexError('UNAUTHENTICATED');
	const participant = user.isAnonymous
		? await ctx.db
				.query('participants')
				.withIndex('by_guest', (q) => q.eq('guestId', user._id))
				.unique()
		: await ctx.db
				.query('participants')
				.withIndex('by_user', (q) => q.eq('userId', user._id))
				.unique();
	return { user, participant };
}

export async function ensureParticipant(ctx: MutationCtx) {
	const { user, participant } = await currentParticipant(ctx);
	if (participant) return participant._id;
	const displayName = user.name && user.name !== 'Guest' ? user.name : undefined;
	// The indexed lookup and insert share the caller's transaction.
	return await ctx.db.insert(
		'participants',
		user.isAnonymous
			? { guestId: user._id, userId: null, displayName }
			: { guestId: null, userId: user._id, displayName }
	);
}
