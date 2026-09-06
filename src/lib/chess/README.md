# Shared chess rules

`index.ts` exports the `fourfold-v1` engine for both Svelte and Convex. The production module has no browser, Node, network, clock, or random-number dependencies.

```ts
import { applyMove, createInitialState } from './index';

const initial = createInitialState();
const result = applyMove(initial, { from: 0, to: 32 });

if (result.ok) {
	// White's rook moved from a1 [0,0] to a1 [0,1]. Black is now to move.
	const next = result.state;
}
```

## State and moves

Squares use `x + 4*y + 16*z + 32*w`, an integer from 0 to 63. `squareIndex`, `squareCoordinates`, and `squareAddress` convert between coordinates, indices, and the prototype's notation.

A board contains exactly 64 entries. Each entry is `null` or a piece with `t` for type and `c` for color. Colors are `w` and `b`; piece types are `p`, `r`, `n`, `b`, `q`, and `k`.

`createInitialState()` creates the standard position, white to move, and the initial repetition key. `applyMove(state, move)` returns either `{ ok: true, state }` or `{ ok: false, error }`. It never mutates the input. State is JSON serializable, and the TypeScript types expose boards and pieces as read-only values.

Only pass engine-created states or states loaded from trusted storage. The engine checks move indices, move legality, terminal positions, and the rules version. It is not an importer or a validator for arbitrary client-supplied board states. Future Convex mutations must validate request shapes, authenticate players, check their seats and revisions, and load the authoritative state before calling it.

`ply` counts accepted moves. `halfmoveClock` resets on a pawn move or capture. `positionKeys` contains the current position and its reversible history, resetting after a pawn move or capture. A key includes side to move. The automatic 100-halfmove draw bounds this history to at most 101 keys for engine-created states.

The rules result covers checkmate and automatic draws. Convex owns waiting/active/finished status, cancellation, resignation, participant identity, revisions, and request idempotency.

## Queries

`legalMoves(board, color, onlyFrom?)` returns moves that preserve king safety and never capture a king. It describes board legality, so a caller displaying playable destinations should also check the state's result or the match's lifecycle. `applyMove` enforces game-over rejection.

`canReach` checks movement geometry and blockers, without king safety. Its attack mode includes friendly defended squares and pawn capture geometry. Pinned pieces still control squares when checking king safety.

`getOutcome` preserves the prototype's precedence: checkmate or stalemate, bare kings, 100 quiet halfmoves, then third repetition. It does not add standard-chess draw conditions absent from this variant.

## Verification

```sh
bun run test:rules
bun run check:backend
```

Focused tests cover movement across all dimensions, blockers, pawn captures and promotion, pins, king safety, state immutability, illegal requests, draws, and checkmate precedence.

Parity tests compare every piece/square pair on empty and occupied boards, then compare legal moves, positions, checks, and outcomes through 24 deterministic games. `fixtures/prototype-rules.txt` is a frozen test reference extracted from the user's prototype on 2026-09-06. Its rule functions are unchanged; evaluation and search were omitted. Tests do not require the original directory to exist.

The Convex TypeScript check includes the production engine. The engine itself has no Node runtime imports. Tests do not establish deployed Convex performance. Benchmark validation when the match mutation is implemented.
