import { v } from 'convex/values';

export const statsFields = {
	sampledAt: v.number(),
	started: v.number(),
	active: v.number(),
	completed: v.number(),
	daily: v.array(v.object({ date: v.string(), started: v.number() }))
};
export const statsValue = v.object(statsFields);
