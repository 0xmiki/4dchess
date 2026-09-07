import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import { requireMatch } from './lib/access';
import { validateRequestId } from './lib/invitations';
import { presenceStatus } from './lib/presence_validators';
import { disconnectDeadline, enforced, policy, presenceFor, renewPresence } from './lib/presence';
import { endIfDeadlineExpired } from './lib/clocks';
import { ConvexError } from 'convex/values';
import { consume } from './lib/limits';

export const heartbeat = mutation({
	args: {
		gameId: v.id('games'),
		sessionId: v.string(),
		sequence: v.number(),
		version: v.literal(1)
	},
	returns: v.object({ active: v.boolean() }),
	handler: async (ctx, { gameId, sessionId, sequence }) => {
		validateRequestId(sessionId);
		if (!Number.isSafeInteger(sequence) || sequence < 0)
			throw new ConvexError('INVALID_REQUEST_ID');
		const { game, participant } = await requireMatch(ctx, gameId);
		const now = Date.now();
		if (game.status !== 'active' || (await endIfDeadlineExpired(ctx, game, now)))
			return { active: false };
		if (!(await enforced(ctx, game))) return { active: false };
		if (!(await consume(ctx, `presence-heartbeat:${participant._id}`, 80, 60000)).ok)
			throw new ConvexError('PRESENCE_RATE_LIMITED');
		await renewPresence(ctx, game, participant._id, sessionId, now, sequence);
		await disconnectDeadline(ctx, game, now);
		return { active: true };
	}
});
export const status = query({
	args: { gameId: v.id('games') },
	returns: presenceStatus,
	handler: async (ctx, { gameId }) => {
		const game = await ctx.db.get(gameId);
		const enabled = !!game && game.ply >= 2 && (await enforced(ctx, game));
		const p = enabled ? await presenceFor(ctx, gameId) : null;
		return {
			enforced: enabled,
			white: {
				online: p?.whiteOnline ?? false,
				deadline:
					p?.candidate?.side === 'white' && p.candidate.state === 'armed'
						? p.candidate.deadline
						: null
			},
			black: {
				online: p?.blackOnline ?? false,
				deadline:
					p?.candidate?.side === 'black' && p.candidate.state === 'armed'
						? p.candidate.deadline
						: null
			}
		};
	}
});
export const wake = internalMutation({
	args: { gameId: v.id('games'), generation: v.number() },
	returns: v.null(),
	handler: async (ctx, { gameId, generation }) => {
		const p = await presenceFor(ctx, gameId),
			game = await ctx.db.get(gameId);
		if (!p || p.generation !== generation || !game || game.status !== 'active') return null;
		await endIfDeadlineExpired(ctx, game, Date.now());
		return null;
	}
});
// Internal CLI/operator operation. Epoch mismatch permanently exempts games created earlier.
export const setEnabled = internalMutation({
	args: { enabled: v.boolean() },
	returns: v.number(),
	handler: async (ctx, { enabled }) => {
		const current = await policy(ctx);
		if (current.enabled === enabled) return current.epoch;
		const epoch = current.epoch + 1;
		if ('_id' in current) await ctx.db.patch(current._id, { enabled, epoch });
		else await ctx.db.insert('onlinePolicy', { key: 'disconnect', enabled, epoch });
		return epoch;
	}
});
