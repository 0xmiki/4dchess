import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { remainingTime } from '../../lib/online/time-controls';
import { finishGame } from './lifecycle';
export { armClock, cancelClockJob } from './clock_jobs';

export async function endIfTimedOut(
	ctx: MutationCtx,
	game: Doc<'games'>,
	now: number
): Promise<Doc<'games'>['result']> {
	if (game.status !== 'active' || !game.clock || game.clock.turnStartedAt === null) return null;
	const side = game.turn === 'w' ? 'white' : 'black';
	if (remainingTime(game.clock, game.turn, side, now) > 0) return null;
	const opponent = game.turn === 'w' ? 'b' : 'w';
	const hasMaterial = game.board.some((piece) => piece?.c === opponent && piece.t !== 'k');
	const result: NonNullable<Doc<'games'>['result']> = hasMaterial
		? { reason: 'timeout', winner: side === 'white' ? 'black' : 'white' }
		: { reason: 'draw', winner: null, detail: 'timeoutNoMaterial' };
	const finished = await finishGame(ctx, {
		gameId: game._id,
		expectedRevision: game.revision,
		result,
		now,
		cancelTimer: false
	});
	return finished ? result : null;
}
