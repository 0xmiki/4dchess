import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { currentParticipant, ensureParticipant } from './lib/participants';

export const ensure = mutation({
	args: {},
	returns: v.id('participants'),
	handler: ensureParticipant
});

export const me = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({ participantId: v.id('participants'), isGuest: v.boolean() })
	),
	handler: async (ctx) => {
		if (!(await ctx.auth.getUserIdentity())) return null;
		const { participant } = await currentParticipant(ctx);
		return participant
			? { participantId: participant._id, isGuest: participant.guestId !== null }
			: null;
	}
});
