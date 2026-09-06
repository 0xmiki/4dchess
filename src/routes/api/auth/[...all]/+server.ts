import { createSvelteKitHandler } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { env } from '$env/dynamic/private';
import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';
import { signGuestRequest } from '$lib/server/guest-proof';

const handler = createSvelteKitHandler();
export const GET = handler.GET;
export const POST: RequestHandler = async (event) => {
	if (event.params.all !== 'sign-in/anonymous') return handler.POST(event);
	const ip = event.getClientAddress();
	const limiter = event.platform?.env.GUEST_SIGNUPS;
	if (limiter && !(await limiter.limit({ key: ip })).success) {
		return new Response(
			JSON.stringify({ message: 'Too many guest sessions. Try again shortly.' }),
			{ status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
		);
	}
	const secret = event.platform?.env.AUTH_PROXY_SECRET ?? env.AUTH_PROXY_SECRET;
	if (!secret) return new Response('Guest sessions are temporarily unavailable.', { status: 503 });
	const signed = await signGuestRequest(secret, ip);
	const headers = new Headers();
	// Fetch may decompress upstream bodies while preserving encoding headers.
	// Request identity encoding so the browser receives a consistent response.
	headers.set('accept-encoding', 'identity');
	for (const name of ['accept', 'cookie', 'origin', 'referer', 'user-agent', 'content-type']) {
		const value = event.request.headers.get(name);
		if (value) headers.set(name, value);
	}
	headers.set('x-forwarded-host', event.url.host);
	headers.set('x-forwarded-proto', event.url.protocol.slice(0, -1));
	headers.set('x-better-auth-forwarded-host', event.url.host);
	headers.set('x-better-auth-forwarded-proto', event.url.protocol.slice(0, -1));
	headers.set('x-fourfold-client', signed.clientKey);
	headers.set('x-fourfold-time', signed.timestamp);
	headers.set('x-fourfold-proof', signed.proof);
	// Anonymous sign-in accepts no user input; keep the forwarded body bounded.
	return fetch(`${PUBLIC_CONVEX_SITE_URL}/api/auth/sign-in/anonymous`, {
		method: 'POST',
		headers,
		body: '{}',
		redirect: 'manual'
	});
};
