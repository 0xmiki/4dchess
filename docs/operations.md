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
