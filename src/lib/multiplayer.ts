import { ConvexError } from 'convex/values';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { authClient } from './auth-client';

let guestRequest: Promise<void> | null = null;

async function establishGuest() {
	const session = await authClient.getSession();
	if (session.error) throw new Error('Could not restore your session.');
	if (session.data) return;
	const signedIn = await authClient.signIn.anonymous();
	if (signedIn.error?.status === 429) throw new ConvexError('GUEST_RATE_LIMITED');
	if (signedIn.error) throw new Error('Could not start a guest session.');
}

export async function guestClient() {
	if (!guestRequest) {
		guestRequest = (
			navigator.locks
				? navigator.locks.request('fourfold-guest-session', establishGuest)
				: establishGuest()
		).finally(() => {
			guestRequest = null;
		});
	}
	await guestRequest;
	const token = await authClient.convex.token();
	if (token.error || !token.data?.token) throw new Error('Could not authenticate your session.');
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	client.setAuth(token.data.token);
	return client;
}

const messages: Record<string, string> = {
	MATCH_NOT_FINISHED: 'Finish the current game before starting another.',
	ROOM_CLOSED: 'This room is closed. Create another room to play.',
	GUEST_RATE_LIMITED:
		'Too many guest sessions were started from this connection. Please try again later.',
	RATE_LIMITED: 'You have started too many games recently. Please try again later.',
	TOO_MANY_INVITES: 'You already have five open invitations. Cancel one or wait for it to expire.',
	UNAUTHENTICATED:
		'Your guest session is unavailable. Reopen the game in the browser where you joined.',
	MATCH_NOT_FOUND: 'This game is not available to your guest session.',
	MATCH_FULL: 'This room is full.',
	INVITE_CLOSED: 'This room is no longer available. Ask your friend for a new invitation.',
	INVITE_EXPIRED: 'This invitation has expired.',
	INVALID_INVITE: 'This invitation is invalid.',
	STALE_REVISION: 'The game changed. Review the latest position before trying again.',
	NOT_YOUR_TURN: 'It is your opponent’s turn.',
	MATCH_NOT_ACTIVE: 'This game is not active.',
	ILLEGAL_MOVE: 'That move is not legal.',
	GAME_OVER: 'This game has finished.',
	REQUEST_ID_REUSED: 'This request conflicts with an earlier action. Reload the game.'
};
export function errorMessage(error: unknown) {
	if (error instanceof ConvexError && typeof error.data === 'string')
		return messages[error.data] ?? 'The request was rejected.';
	return 'Could not reach the game server. Check your connection and retry.';
}

/** Restore identity for auto-resume without creating an anonymous session. */
export async function existingGuestClient() {
	const session = await authClient.getSession();
	if (session.error) throw Error('Session unavailable');
	if (!session.data) return null;
	const token = await authClient.convex.token();
	if (token.error || !token.data?.token) throw Error('Session unavailable');
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	client.setAuth(token.data.token);
	return client;
}
