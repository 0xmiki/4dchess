import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { finishGame } from './lifecycle';
export { armClock, cancelClockJob } from './clock_jobs';

export async function endIfDeadlineExpired(
	ctx: MutationCtx,
	game: Doc<'games'>,
	now: number
): Promise<Doc<'games'>['result']> {
	if (game.status !== 'active' || !game.clock || game.clock.turnStartedAt === null) return null;
	const clockDeadline =
		game.clock.turnStartedAt + (game.turn === 'w' ? game.clock.whiteMs : game.clock.blackMs);
	const openingDeadline =
		game.kind === 'matchmaking' && game.lifecyclePolicy && game.ply < 2
			? game.firstMoveDeadline
			: undefined;
	// At equal deadlines a first-move no-show is unscored, not a clock loss.
	if (openingDeadline !== undefined && openingDeadline <= clockDeadline && now >= openingDeadline) {
		const result = { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' } as const;
		return (await finishGame(ctx, {
			gameId: game._id,
			expectedRevision: game.revision,
			result,
			now
		}))
			? result
			: null;
	}
	const side = game.turn === 'w' ? 'white' : 'black';
	if (now < clockDeadline) return null;
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
