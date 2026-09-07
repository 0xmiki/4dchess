import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { finishGame } from './lifecycle';
import { disconnectDeadline } from './presence';
import { stoppedClock } from '../../lib/online/time-controls';
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
	const disconnect = await disconnectDeadline(ctx, game, now);
	// At equal deadlines a first-move no-show is unscored, not a clock loss.
	if (
		openingDeadline !== undefined &&
		openingDeadline <= clockDeadline &&
		openingDeadline <= (disconnect ?? Infinity) &&
		now >= openingDeadline
	) {
		const result = { reason: 'aborted', winner: null, detail: 'firstMoveNoShow' } as const;
		return (await finishGame(ctx, {
			gameId: game._id,
			expectedRevision: game.revision,
			result,
			clock: stoppedClock(game.clock, game.turn, openingDeadline),
			now
		}))
			? result
			: null;
	}
	const side = game.turn === 'w' ? 'white' : 'black';
	const disconnected = disconnect !== undefined && disconnect < clockDeadline;
	if (!disconnected && now < clockDeadline) return null;
	const opponent = game.turn === 'w' ? 'b' : 'w';
	const hasMaterial = game.board.some((piece) => piece?.c === opponent && piece.t !== 'k');
	const result: NonNullable<Doc<'games'>['result']> = hasMaterial
		? disconnected
			? {
					reason: 'abandonment',
					detail: 'disconnect',
					winner: side === 'white' ? 'black' : 'white'
				}
			: { reason: 'timeout', winner: side === 'white' ? 'black' : 'white' }
		: {
				reason: 'draw',
				winner: null,
				detail: disconnected ? 'disconnectNoMaterial' : 'timeoutNoMaterial'
			};
	const finished = await finishGame(ctx, {
		gameId: game._id,
		expectedRevision: game.revision,
		result,
		clock: stoppedClock(game.clock, game.turn, disconnected ? disconnect! : clockDeadline),
		now,
		cancelTimer: true
	});
	return finished ? result : null;
}
