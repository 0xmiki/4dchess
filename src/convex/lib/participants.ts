import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { authComponent } from '../auth';

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
	// The indexed lookup and insert share the caller's transaction.
	return await ctx.db.insert(
		'participants',
		user.isAnonymous ? { guestId: user._id, userId: null } : { guestId: null, userId: user._id }
	);
}
