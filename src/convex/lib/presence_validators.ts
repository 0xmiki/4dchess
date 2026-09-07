import { v } from 'convex/values';
import { color } from './validators';
export const coverage = v.array(v.object({ start: v.number(), end: v.number() }));
export const candidate = v.object({
	side: color,
	episode: v.number(),
	deadline: v.number(),
	state: v.union(v.literal('armed'), v.literal('waitingOpponent'))
});
export const presenceStatus = v.object({
	enforced: v.boolean(),
	white: v.object({ online: v.boolean(), deadline: v.union(v.number(), v.null()) }),
	black: v.object({ online: v.boolean(), deadline: v.union(v.number(), v.null()) })
});
