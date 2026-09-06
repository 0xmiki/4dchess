/// <reference types="vite/client" />
import { randomUUID } from 'node:crypto';
import { convexTest } from 'convex-test';
import betterAuthTest from '@convex-dev/better-auth/test';
import schema from '../../convex/schema';
import { components } from '../../convex/_generated/api';

const modules = import.meta.glob([
	'../../convex/**/*.ts',
	'../../convex/**/*.js',
	'!../../convex/**/*.d.ts'
]);
export function setup() {
	const t = convexTest(schema, modules);
	betterAuthTest.register(t);
	return t;
}
export async function guest(t: ReturnType<typeof setup>) {
	const now = Date.now();
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				name: 'Guest',
				email: `${randomUUID()}@example.invalid`,
				emailVerified: false,
				isAnonymous: true,
				createdAt: now,
				updatedAt: now
			}
		}
	});
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				userId: user._id,
				token: randomUUID(),
				expiresAt: now + 30 * 86400000,
				createdAt: now,
				updatedAt: now
			}
		}
	});
	return t.withIdentity({ subject: user._id, sessionId: session._id });
}
