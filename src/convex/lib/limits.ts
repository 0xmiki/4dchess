import { ConvexError } from 'convex/values';
import type { MutationCtx } from '../_generated/server';

export async function consume(ctx: MutationCtx, key: string, capacity: number, periodMs: number) {
	const now = Date.now();
	const row = await ctx.db
		.query('rateLimits')
		.withIndex('by_key', (q) => q.eq('key', key))
		.unique();
	const available = row
		? Math.min(capacity, row.tokens + ((now - row.updatedAt) * capacity) / periodMs)
		: capacity;
	if (available < 1)
		return { ok: false, retryAfterMs: Math.ceil(((1 - available) * periodMs) / capacity) };
	const values = {
		tokens: available - 1,
		updatedAt: now,
		expiresAt: now + Math.max(periodMs * 2, 86400000)
	};
	if (row) await ctx.db.patch(row._id, values);
	else await ctx.db.insert('rateLimits', { key, ...values });
	return { ok: true, retryAfterMs: 0 };
}
export async function limitCreation(ctx: MutationCtx, participantId: string) {
	const result = await consume(ctx, `match:${participantId}`, 20, 3600000);
	if (!result.ok) throw new ConvexError('RATE_LIMITED');
}
