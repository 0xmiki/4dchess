import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { consume } from './lib/limits';

export const reserveGuest = internalMutation({
	args: { clientKey: v.string() },
	returns: v.object({ ok: v.boolean(), retryAfterMs: v.number() }),
	handler: async (ctx, { clientKey }) => {
		const client = await consume(ctx, `guest:${clientKey}`, 10, 3600000);
		if (!client.ok) return client;
		return await consume(ctx, 'guest:global', 300, 3600000);
	}
});
