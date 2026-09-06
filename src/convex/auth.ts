import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth/minimal';
import { anonymous } from 'better-auth/plugins';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import authConfig from './auth.config';

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
	betterAuth({
		baseURL: process.env.SITE_URL,
		secret: process.env.BETTER_AUTH_SECRET,
		trustedOrigins: (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
		database: authComponent.adapter(ctx),
		session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
		plugins: [
			anonymous({ disableDeleteAnonymousUser: true, generateName: () => 'Guest' }),
			convex({ authConfig })
		]
	});
