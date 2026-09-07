import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { ClockState } from '../../lib/online/time-controls';

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
