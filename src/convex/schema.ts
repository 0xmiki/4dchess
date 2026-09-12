import { statsValue } from './lib/stats';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameFields, moveFields, timedControl } from './lib/validators';
import { coverage, candidate } from './lib/presence_validators';

export default defineSchema({
	chatMessages: defineTable({
		roomId: v.id('games'),
		senderId: v.id('participants'),
		text: v.string(),
		requestId: v.string(),
		expiresAt: v.number()
	})
		.index('by_room', ['roomId'])
		.index('by_expiry', ['expiresAt'])
		.index('by_request', ['roomId', 'senderId', 'requestId']),
	chatMutes: defineTable({ roomId: v.id('games'), participantId: v.id('participants') }).index(
		'by_room',
		['roomId']
	),
	computerReports: defineTable({ token: v.string(), expiresAt: v.number() })
		.index('by_token', ['token'])
		.index('by_expiry', ['expiresAt']),
	computerDays: defineTable({ date: v.string(), games: v.number() }).index('by_date', ['date']),
	publicStats: defineTable({ name: v.string(), value: statsValue }).index('by_name', ['name']),
	statsBuild: defineTable({ value: statsValue }),
	statsPlayerDays: defineTable({
		buildId: v.id('statsBuild'),
		participantId: v.id('participants'),
		days: v.number()
	}).index('by_build_player', ['buildId', 'participantId']),
	onlinePolicy: defineTable({
		key: v.literal('disconnect'),
		enabled: v.boolean(),
		epoch: v.number()
	}).index('by_key', ['key']),
	gameSessions: defineTable({
		gameId: v.id('games'),
		participantId: v.id('participants'),
		sessionId: v.string(),
		sequence: v.number(),
		expiresAt: v.number()
	})
		.index('by_session', ['gameId', 'participantId', 'sessionId'])
		.index('by_player_expiry', ['gameId', 'participantId', 'expiresAt'])
		.index('by_game', ['gameId']),
	gamePresence: defineTable({
		gameId: v.id('games'),
		white: coverage,
		black: coverage,
		candidate: v.optional(candidate),
		generation: v.number(),
		wakeAt: v.optional(v.number()),
		wakeId: v.optional(v.id('_scheduled_functions')),
		whiteOnline: v.boolean(),
		blackOnline: v.boolean()
	}).index('by_game', ['gameId']),
	matchSearches: defineTable({
		participantId: v.id('participants'),
		presenceVersion: v.optional(v.literal(1)),
		requestId: v.string(),
		timeControl: timedControl,
		status: v.union(v.literal('waiting'), v.literal('matched'), v.literal('cancelled')),
		closeReason: v.optional(v.union(v.literal('userCancelled'), v.literal('leaseExpired'))),
		closedAt: v.optional(v.number()),
		expiresAt: v.number(),
		gameId: v.optional(v.id('games'))
	})
		.index('by_participant_request', ['participantId', 'requestId'])
		.index('by_participant_status', ['participantId', 'status'])
		.index('by_participant', ['participantId'])
		.index('by_pool_expiry', ['timeControl', 'status', 'expiresAt'])
		.index('by_expiry', ['expiresAt']),
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
			v.object({ guestId: v.string(), userId: v.null(), displayName: v.optional(v.string()) }),
			v.object({ guestId: v.null(), userId: v.string(), displayName: v.optional(v.string()) })
		)
	)
		.index('by_guest', ['guestId'])
		.index('by_user', ['userId']),
	games: defineTable(gameFields)
		.index('by_creator_request', ['creatorParticipantId', 'createRequestId'])
		.index('by_room_round', ['roomRootId', 'round'])
		.index('by_white', ['whiteParticipantId'])
		.index('by_black', ['blackParticipantId'])
		.index('by_white_status', ['whiteParticipantId', 'status'])
		.index('by_black_status', ['blackParticipantId', 'status'])
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
		.index('by_created', ['createdAt'])
		.index('by_game_capture', ['gameId', 'captured', 'ply'])
		.index('by_game_ply', ['gameId', 'ply'])
		.index('by_request', ['gameId', 'participantId', 'requestId']),
	commands: defineTable({
		gameId: v.id('games'),
		participantId: v.id('participants'),
		requestId: v.string(),
		expectedRevision: v.number(),
		revision: v.number(),
		kind: v.union(v.literal('resign'), v.literal('moveTimeout')),
		move: v.optional(v.object({ from: v.number(), to: v.number() }))
	}).index('by_request', ['gameId', 'participantId', 'requestId'])
});
