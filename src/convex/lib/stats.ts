import { v } from 'convex/values';

export const statsFields = {
	sampledAt: v.number(),
	started: v.number(),
	active: v.number(),
	completed: v.number(),
	checkmates: v.optional(v.number()),
	players: v.optional(v.object({ today: v.number(), week: v.number(), month: v.number() })),
	daily: v.array(
		v.object({ date: v.string(), started: v.number(), players: v.optional(v.number()) })
	)
};
export const statsValue = v.object(statsFields);
