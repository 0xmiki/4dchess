import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameFields } from './lib/validators';

export default defineSchema({
	participants: defineTable(
		v.union(
			v.object({ guestId: v.string(), userId: v.null() }),
			v.object({ guestId: v.null(), userId: v.string() })
		)
	)
		.index('by_guest', ['guestId'])
		.index('by_user', ['userId']),
	games: defineTable(gameFields)
		.index('by_creator_request', ['creatorParticipantId', 'createRequestId'])
		.index('by_white', ['whiteParticipantId'])
		.index('by_black', ['blackParticipantId']),
	invites: defineTable({
		gameId: v.id('games'),
		tokenHash: v.string(),
		expiresAt: v.number(),
		status: v.union(
			v.literal('open'),
			v.literal('consumed'),
			v.literal('revoked'),
			v.literal('expired')
		)
	})
		.index('by_token_hash', ['tokenHash'])
		.index('by_game', ['gameId'])
});
