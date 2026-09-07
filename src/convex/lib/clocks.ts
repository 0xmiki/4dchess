import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { remainingTime, stoppedClock, type ClockState } from '../../lib/online/time-controls';

export async function cancelClockJob(
	ctx: MutationCtx,
	id?: Id<'_scheduled_functions'>
): Promise<void> {
	if (!id) return;
	const job = await ctx.db.system.get(id);
	if (job?.state.kind === 'pending') await ctx.scheduler.cancel(id);
}
export async function armClock(
	ctx: MutationCtx,
	gameId: Id<'games'>,
	clock: ClockState,
	turn: 'w' | 'b',
	revision: number,
	previous?: Id<'_scheduled_functions'>
): Promise<Id<'_scheduled_functions'> | undefined> {
	await cancelClockJob(ctx, previous);
	if (clock.turnStartedAt === null) return undefined;
	const deadline = clock.turnStartedAt + (turn === 'w' ? clock.whiteMs : clock.blackMs);
	return await ctx.scheduler.runAt(deadline, internal.clocks.expire, { gameId, revision });
}
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
	await ctx.db.patch(game._id, {
		status: 'finished',
		result,
		finishedAt: now,
		revision: game.revision + 1,
		clock: stoppedClock(game.clock, game.turn, now),
		timeoutJob: undefined
	});
	return result;
}
