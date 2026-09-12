import { v } from 'convex/values';

export const statsFields = {
	sampledAt: v.number(),
	computer: v.optional(v.array(v.object({ date: v.string(), games: v.number() }))),
	started: v.number(),
	active: v.number(),
	completed: v.number(),
	checkmates: v.optional(v.number()),
	participants: v.optional(v.object({ total: v.number(), newToday: v.number() })),
	today: v.optional(v.object({ started: v.number(), completed: v.number() })),
	playingNow: v.optional(v.number()),
	outcomes: v.optional(
		v.object({
			checkmate: v.number(),
			resignation: v.number(),
			draw: v.number(),
			timeout: v.number(),
			abandonment: v.number()
		})
	),
	gameKinds: v.optional(v.object({ friend: v.number(), matchmaking: v.number() })),
	timeControls: v.optional(
		v.object({ bullet: v.number(), blitz: v.number(), rapid: v.number(), untimed: v.number() })
	),
	players: v.optional(v.object({ today: v.number(), week: v.number(), month: v.number() })),
	daily: v.array(
		v.object({
			date: v.string(),
			started: v.number(),
			completed: v.optional(v.number()),
			newPlayers: v.optional(v.number()),
			players: v.optional(v.number())
		})
	)
};
export const statsValue = v.object(statsFields);
