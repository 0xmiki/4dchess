import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { GameState } from '../../lib/chess';
import { stoppedClock, type ClockState } from '../../lib/online/time-controls';
import { cancelClockJob } from './clock_jobs';

type Outcome = NonNullable<Doc<'games'>['result']>;
type Termination = NonNullable<Doc<'games'>['termination']>;
type Position = Pick<GameState, 'board' | 'turn' | 'ply' | 'halfmoveClock' | 'positionKeys'>;
function metadata(game: Doc<'games'>, result: Outcome, now: number): Termination {
	let cause: Termination['cause'];
	let responsible: 'white' | 'black' | undefined;
	switch (result.reason) {
		case 'checkmate':
			cause = 'checkmate';
			break;
		case 'resignation':
			cause = 'resignation';
			responsible = result.winner === 'white' ? 'black' : 'white';
			break;
		case 'timeout':
			cause = 'clockTimeout';
			responsible = game.turn === 'w' ? 'white' : 'black';
			break;
		case 'draw':
			cause = result.detail === 'timeoutNoMaterial' ? 'clockTimeout' : 'boardDraw';
			if (result.detail === 'timeoutNoMaterial')
				responsible = game.turn === 'w' ? 'white' : 'black';
			break;
		case 'cancellation':
			cause = result.detail === 'creatorCancelled' ? 'challengeDeleted' : 'challengeExpired';
			break;
		case 'aborted':
			cause = result.detail;
			if (result.detail === 'firstMoveNoShow') responsible = game.turn === 'w' ? 'white' : 'black';
			break;
		case 'abandonment':
			cause = result.detail === 'disconnect' ? 'disconnectAbandonment' : 'stallingAbandonment';
			responsible = result.winner === 'white' ? 'black' : 'white';
			break;
	}
	const responsibleParticipantId =
		cause === 'challengeDeleted'
			? game.creatorParticipantId
			: responsible === 'white'
				? game.whiteParticipantId
				: responsible === 'black'
					? game.blackParticipantId
					: undefined;
	return {
		cause,
		policyVersion: game.lifecyclePolicy ?? 'legacy-v1',
		responsibleParticipantId: responsibleParticipantId ?? undefined,
		recordedAt: now,
		revision: game.revision + 1
	};
}

/** The only terminal transition. A stale or duplicate ending cannot overwrite an outcome. */
export async function finishGame(
	ctx: MutationCtx,
	args: {
		gameId: Id<'games'>;
		expectedRevision: number;
		result: Outcome;
		now: number;
		position?: Position;
		clock?: ClockState;
		cancelTimer?: boolean;
	}
): Promise<boolean> {
	const game = await ctx.db.get(args.gameId);
	if (
		!game ||
		game.status === 'finished' ||
		game.result ||
		game.termination ||
		game.revision !== args.expectedRevision
	)
		return false;
	if (game.status !== (args.result.reason === 'cancellation' ? 'waiting' : 'active')) return false;
	if (
		(args.result.reason === 'aborted' || args.result.reason === 'abandonment') &&
		!game.lifecyclePolicy
	)
		return false;
	if (args.result.reason === 'abandonment' && game.kind !== 'matchmaking') return false;
	if (
		args.result.reason === 'aborted' &&
		args.result.detail === 'firstMoveNoShow' &&
		(game.kind !== 'matchmaking' || game.ply >= 2)
	)
		return false;
	if (args.cancelTimer !== false) await cancelClockJob(ctx, game.timeoutJob);
	const clock = args.clock ?? game.clock;
	await ctx.db.patch(game._id, {
		...(args.position
			? {
					...args.position,
					board: [...args.position.board],
					positionKeys: [...args.position.positionKeys]
				}
			: {}),
		status: 'finished',
		result: args.result,
		revision: game.revision + 1,
		finishedAt: args.now,
		termination: metadata(game, args.result, args.now),
		rematchRequestedBy: undefined,
		firstMoveDeadline: undefined,
		...(clock ? { clock: stoppedClock(clock, args.position?.turn ?? game.turn, args.now) } : {}),
		timeoutJob: undefined
	});
	return true;
}
