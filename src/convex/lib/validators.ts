import { v } from 'convex/values';

export const color = v.union(v.literal('white'), v.literal('black'));
export const piece = v.object({
	t: v.union(
		v.literal('p'),
		v.literal('r'),
		v.literal('n'),
		v.literal('b'),
		v.literal('q'),
		v.literal('k')
	),
	c: v.union(v.literal('w'), v.literal('b'))
});
export const result = v.union(
	v.null(),
	v.object({ reason: v.union(v.literal('checkmate'), v.literal('resignation')), winner: color }),
	v.object({
		reason: v.literal('draw'),
		winner: v.null(),
		detail: v.union(
			v.literal('stalemate'),
			v.literal('repetition'),
			v.literal('fiftyMove'),
			v.literal('bareKings')
		)
	}),
	v.object({
		reason: v.literal('cancellation'),
		winner: v.null(),
		detail: v.union(v.literal('creatorCancelled'), v.literal('inviteExpired'))
	})
);
export const gameFields = {
	creatorParticipantId: v.id('participants'),
	createRequestId: v.string(),
	whiteParticipantId: v.union(v.id('participants'), v.null()),
	blackParticipantId: v.union(v.id('participants'), v.null()),
	status: v.union(v.literal('waiting'), v.literal('active'), v.literal('finished')),
	revision: v.number(),
	rulesVersion: v.literal('fourfold-v1'),
	board: v.array(v.union(piece, v.null())),
	turn: v.union(v.literal('w'), v.literal('b')),
	ply: v.number(),
	halfmoveClock: v.number(),
	positionKeys: v.array(v.string()),
	result,
	expiresAt: v.number(),
	startedAt: v.union(v.number(), v.null()),
	finishedAt: v.union(v.number(), v.null()),
	purgeAt: v.optional(v.union(v.number(), v.null()))
};
export const moveFields = {
	gameId: v.id('games'),
	participantId: v.id('participants'),
	requestId: v.string(),
	expectedRevision: v.number(),
	revision: v.number(),
	ply: v.number(),
	from: v.number(),
	to: v.number(),
	piece,
	captured: v.union(piece, v.null()),
	createdAt: v.number(),
	result
};
export const moveDocument = v.object({
	_id: v.id('moves'),
	_creationTime: v.number(),
	...moveFields
});
export const moveReceipt = v.object({ revision: v.number(), ply: v.number(), result });
export const gameDocument = v.object({
	_id: v.id('games'),
	_creationTime: v.number(),
	...gameFields
});
export const seatReceipt = v.object({ gameId: v.id('games'), seat: color, revision: v.number() });
