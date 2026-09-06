import { ConvexError } from 'convex/values';

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) =>
	Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

export function validateRequestId(requestId: string) {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
		throw new ConvexError('INVALID_REQUEST_ID');
	}
}

// A keyed digest makes retry/recovery deterministic without storing the raw token.
// Keep INVITE_SECRET stable while invitations are open.
export async function invitationToken(participantId: string, requestId: string) {
	const secret = process.env.INVITE_SECRET;
	if (!secret || secret.length < 32) throw new Error('INVITE_SECRET must be configured.');
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return hex(
		await crypto.subtle.sign(
			'HMAC',
			key,
			encoder.encode(JSON.stringify(['fourfold-invite-v1', participantId, requestId]))
		)
	);
}

export async function tokenHash(token: string) {
	if (!/^[0-9a-f]{64}$/.test(token)) throw new ConvexError('INVALID_INVITE');
	return hex(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
}
