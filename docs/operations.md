# Abuse protection and maintenance

The current limits are intended for the friend-match beta:

| Operation                  | Limit                                                                          |
| -------------------------- | ------------------------------------------------------------------------------ |
| Guest signup at the Worker | 10 requests per minute per client IP, per Cloudflare location                  |
| Guest signup in Convex     | 10 attempts per hour per signed client key; 300 per hour across the deployment |
| Match creation             | 20 successful creations per hour per participant                               |
| Open invitations           | At most five unexpired waiting matches per creator                             |

Convex uses transactional token buckets. Successful retries return their existing receipt before consuming creation quota. Denied signup attempts commit their quota reservation separately from authentication. Buckets refill over time and idle bucket records expire.

Only the website can authorize anonymous signup. Its server derives a pseudonymous client key from the client address and signs a timestamped proof. Convex verifies the HMAC and its age before reserving signup capacity. Client-supplied proof headers are not forwarded. Direct calls to the Convex anonymous endpoint are rejected. No raw IP address or proxy secret is written to application logs.

`AUTH_PROXY_SECRET` must match between the Worker and Convex. It is stored in the ignored local environment files and as a Cloudflare secret. It must never use a `PUBLIC_` variable. Existing guest sessions do not need a new signup when limits are reached.

## Retention

Waiting matches expire after 24 hours. A maintenance job runs every 15 minutes and recovers expired waiting matches whose scheduled expiry has not run.

Cancelled or expired matches that never started are deleted seven days after cancellation or expiry. The job checks `startedAt`, `ply`, result, and move/command records before deleting the match and its invitations. Active matches and played games are retained, including completed games. Authentication accounts and participants are not automatically deleted by this policy.

Each maintenance run handles at most 50 expiry recoveries, 50 match deletions, and 100 expired rate-limit buckets. Subsequent runs continue draining any backlog. Creation idempotency is retained while its game record exists; an old invitation is no longer recoverable after retention cleanup.

`operations.backfillRetention` is an internal, paginated migration for records created before the retention field existed. It sets eligibility dates and does not itself delete games.

## Monitoring

```sh
bun run ops:status
bun run ops:logs
```

The internal status query reports the maintenance heartbeat, the last expiry/deletion counts, and failed scheduled functions among the most recent 100 scheduled records in the last day. A heartbeat older than 30 minutes is stale. Maintenance writes structured `maintenance_completed` and `scheduled_function_failures` log events without board positions, invite tokens, or credentials.

Convex records function errors and stack traces in its deployment logs. Cloudflare observability is enabled; SvelteKit server failures add a `request_failure` event with a reference ID, route template, and status. No external log-stream subscription or email notification service is configured.

If the heartbeat is stale or failures appear, inspect the deployment logs and scheduled-function dashboard first. Check quotas, missing environment variables, and deployment errors before manually rerunning maintenance. The status query and maintenance functions are internal and require deployment access; they are not player-facing endpoints.

## Clocks and matchmaking

Online clocks use server timestamps. Each accepted move deducts elapsed time and adds its increment in the same transaction as the move; retries reuse the original receipt. One scheduled timeout job is armed for the current turn. Pending jobs are cancelled on the next move or resignation, and revision checks make stale jobs harmless. Client clocks use a periodically calibrated server-time estimate and continue through disconnections.

A 30-second search lease is renewed every eight seconds while the search page is visible. The queue reads at most 16 live candidates from the selected time-control index. Pairing and cancellation share transactional state, so a cancellation that loses the race returns the created game. Friend joins and rematches also settle any pending searches into that game. Active-game indexes prevent one participant from being assigned to two games concurrently.

Search creation is limited to 12 requests per minute per participant; heartbeats are limited to 20 per minute. Cancelled and matched receipts are retained for at least one day. Search cleanup removes expired receipts in bounded batches. These are initial operating limits, not measured capacity claims.

For this variant, flagging loses unless the opponent has only a king, in which case the game is drawn. Clocks start after a three-second countdown. No client-reported lag allowance or manual pause is supported in this release.

## Lifecycle outcome records

All game-ending paths use one revision-checked transition. It stores a terminal result and one `termination` record containing its cause, policy version, timestamp, revision, and responsible participant when established. A finished game cannot receive a second outcome. New games carry `lifecyclePolicy: online-v1`; games without that field retain legacy semantics, and already finished games are not backfilled.

Search cancellation and lease expiry are recorded separately from game outcomes. Deleted and expired invitations retain their existing cancellation reasons. New matchmaking games enforce the first-move and disconnect policies below. Repeat-offender punishments and automatic incident escalation are not implemented.

Aborted games retain their position and move history, award no room-score points, export with the `*` result marker, and do not offer a rematch. Normal completed games retain their original result and termination record when a new round begins. No-show and abandonment outcomes cannot be applied to legacy games by the lifecycle transition.

## First-move deadlines

New matchmaking games and matchmaking rematches give each player 30 seconds for their first legal move. White's window starts after the three-second start countdown. Black's starts when White's move is accepted. Friend challenges and games without `firstMoveDeadline` keep their existing clock rules.

The current turn has one scheduled job for the earlier of the main clock and opening deadline. Exact ties resolve as unscored first-move aborts. Move submissions, resignations, and queue availability checks use the same deadline resolution. The first accepted move replaces the opening deadline with Black's deadline; the second removes it. Invalid moves and duplicate requests cannot extend it. Revision checks prevent old jobs from ending a later turn.

The client displays the server deadline beside the affected profile and emphasizes the final ten seconds. Screen readers announce phase changes rather than every tick. Reloading or backgrounding the page does not pause the server deadline. After an abort, finding another opponent requires an explicit click and retains the previous clock preset. No penalty or cooldown is applied in this milestone.

## Spectator access

Anyone with a room URL can watch its current game without signing in or creating a guest. The `watch` queries expose an explicit projection of board state, clocks, player display names, results, scores, and paginated move notation data. They omit participant/auth identifiers, invitation tokens, command receipts, and internal scheduling metadata. There is no public room directory.

Viewing permission does not grant playing permission. Existing participant checks still protect moves, resignations, invitations, and rematches. The room URL follows the latest rematch. Spectator analysis is a browser-only variation tree and sends no game mutations; it is not shared or persisted to Convex. Player controls do not gain this analysis mode during their own game.

Spectator load consists of reactive read subscriptions, move-history pagination, and clock calibration. Spectators do not consume guest-signup quota. Connection and bandwidth capacity still require measurement before making large-stream audience guarantees.

## Midgame disconnect forfeits

New matchmaking games and matchmaking rematches require presence protocol version 1 and store the current `disconnectEpoch`. Older clients must reload before entering these games. Existing games without an epoch and ordinary friend challenges retain their original rules. The opening policy exclusively handles the period before both first legal moves.

Each playing page sends a single-flight heartbeat every ten seconds. The backend derives the participant from authentication and assigns a 30-second lease. Any valid playing tab keeps that participant present; spectators never register leases. Hiding a tab does not send a disconnect signal. Suspended pages may eventually lose their leases. There are no unload beacons. Eight simultaneous playing sessions are allowed per participant/game; a ninth is rejected visibly. Session creation and heartbeat requests also have participant-level rate limits.

Once both players have moved, absence begins at the last playing lease's expiry. Reconnect grace begins at the later of that expiry and the player's turn start. Grace is `clamp((baseSeconds + 40 * incrementSeconds) * 0.1, 30, 180)`, giving 30, 42, and 80 seconds for the supported presets. This adopts [Chess.com's documented disconnect allowance](https://support.chess.com/en/articles/8593801-how-does-game-abandonment-work), not its stalling, evaluation-based, or repeat-offender rules. Detection delay precedes reconnect grace.

| Transition                                                          | Server behavior                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Last lease expires                                                  | Mark the player absent and arm a candidate on their turn.                                                                 |
| Current player reconnects before expiry                             | Cancel that absence episode without resetting the chess clock.                                                            |
| Candidate expires with opponent coverage at that instant            | Forfeit, unless an earlier clock deadline already determined the result. A clock/disconnect tie resolves as clock expiry. |
| Candidate expires without opponent coverage                         | Record `waitingOpponent`; ordinary clocks continue.                                                                       |
| Opponent transitions from absent to present while a candidate waits | Arm a fresh full grace. Routine heartbeats and additional overlapping tabs do not restart it.                             |
| Both players remain absent                                          | Do not suppress the chess clocks or manufacture an unscored abort.                                                        |

Coverage intervals are half-open: lease expiry itself is absent. Every renewal resolves due outcomes first. New heartbeats cannot fill historical gaps, and duplicate move receipts have no presence side effects. Fresh accepted moves renew their verified originating session. The shared resolver compares opening, clock, and disconnect deadlines; delayed workers evaluate historical coverage at the deadline, not presence at processing time. A forfeit against an opponent with only a king is a draw, matching this variant's clock rule. Clocks stop at the logical deadline even when processing is delayed.

Presence coordination and generations live outside the game document, so heartbeats do not alter move revisions. Each coordinator retains a valid earliest wake-up; heartbeats may extend leases without rescheduling that job until it wakes. Candidate coverage is retained until adjudication, then pruned. Finished games cancel presence jobs and remove session/coverage records. Rematches require fresh game-scoped sessions.

### Incident switch

Use the internal `presence:setEnabled` operation with an explicitly selected deployment. For example, on development:

```sh
bunx convex run presence:setEnabled '{"enabled":false}' --deployment dev
bunx convex run presence:setEnabled '{"enabled":true}' --deployment dev
```

Disabling stops new matchmaking/rematch creation and invalidates the previous enforcement epoch. Ordinary clocks and first-move rules continue. Affected active games remain disconnect-exempt after re-enabling, even if no mutation touched them during the incident; only newly created games use the new epoch. This switch does not neutralize clock losses or claim that a platform outage has been detected automatically.
