import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameFields, moveFields } from './lib/validators';

export default defineSchema({
	rateLimits: defineTable({
		key: v.string(),
		tokens: v.number(),
		updatedAt: v.number(),
		expiresAt: v.number()
	})
		.index('by_key', ['key'])
		.index('by_expiry', ['expiresAt']),
	operations: defineTable({
		name: v.string(),
		checkedAt: v.number(),
		expired: v.number(),
		deleted: v.number(),
		failedSchedules: v.number()
	}).index('by_name', ['name']),
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
		.index('by_black', ['blackParticipantId'])
		.index('by_status_expiry', ['status', 'expiresAt'])
		.index('by_creator_status', ['creatorParticipantId', 'status', 'expiresAt'])
		.index('by_purge', ['purgeAt'])
		.index('by_status_finished', ['status', 'finishedAt']),

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
		.index('by_game', ['gameId']),
	moves: defineTable(moveFields)
		.index('by_game_ply', ['gameId', 'ply'])
		.index('by_request', ['gameId', 'participantId', 'requestId']),
	commands: defineTable({
		gameId: v.id('games'),
		participantId: v.id('participants'),
		requestId: v.string(),
		expectedRevision: v.number(),
		revision: v.number(),
		kind: v.literal('resign')
	}).index('by_request', ['gameId', 'participantId', 'requestId'])
});
