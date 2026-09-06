import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth/minimal';
import { anonymous } from 'better-auth/plugins';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { components, internal } from './_generated/api';
import { verifyGuestRequest } from '../lib/server/guest-proof';
import type { DataModel } from './_generated/dataModel';
import authConfig from './auth.config';
import { randomGuestName } from '../lib/guest-name';

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
	betterAuth({
		baseURL: process.env.SITE_URL,
		secret: process.env.BETTER_AUTH_SECRET,
		trustedOrigins: (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
		database: authComponent.adapter(ctx),
		session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
		hooks: {
			before: createAuthMiddleware(async (context) => {
				if (context.path !== '/sign-in/anonymous') return;
				const headers = context.headers ?? new Headers();
				const clientKey = await verifyGuestRequest(process.env.AUTH_PROXY_SECRET ?? '', headers);
				if (!clientKey)
					throw new APIError('FORBIDDEN', {
						message: 'Start a guest session from the game website.'
					});
				if (!('runMutation' in ctx)) throw new APIError('SERVICE_UNAVAILABLE');
				const limit = await ctx.runMutation(internal.abuse.reserveGuest, { clientKey });
				if (!limit.ok) {
					context.setHeader('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
					throw new APIError('TOO_MANY_REQUESTS', {
						message: 'Too many guest sessions. Try again later.'
					});
				}
			})
		},
		plugins: [
			anonymous({ disableDeleteAnonymousUser: true, generateName: randomGuestName }),
			convex({ authConfig })
		]
	});
