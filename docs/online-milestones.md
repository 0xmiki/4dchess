# Timed games and matchmaking

The first release uses verified anonymous identities and unrated matchmaking. Registered accounts, ratings, spectators, parties, and custom clocks are outside this release. Computer games remain untimed.

## 1. Authoritative clocks

- Three timed presets: 3+2, 5+3, and 10+5. Friend challenges also support Untimed.
- Existing games remain untimed. The chosen control is fixed for a game and inherited by rematches.
- Both players get a three-second start countdown. Waiting invitations consume no clock time.
- Server time decides whether a move arrived in time. Client timestamps do not grant extra time.
- Increment is added once per accepted move. Retries cannot charge or award time twice.
- Refresh, reviewing history, and disconnecting do not pause online clocks.
- Timeout loses the game, except that an opponent with only a king receives a draw. This is an explicit rule of this 4D variant.
- Durable timeout jobs finish games even without connected browsers; stale jobs cannot end a later turn.

## 2. Matching queue

- Search within the selected time-control pool. No rating or region optimization yet.
- Claim two players and create their game in one transaction.
- One active search or online game per participant. Duplicate tabs cannot double-match.
- Searching browsers renew a short lease. Expired entries are not paired.
- Cancellation racing with pairing returns the created game instead of silently abandoning an opponent.
- Bounded indexed candidate reads, with no global queue counter or whole-table scan.

## 3. Interface

- Find opponent on home, with a time selector and cancellable search state.
- Preserve direct friend challenges and computer play.
- Clocks sit beside the player profiles, with restrained active/low-time emphasis.
- Matchmade games use the same board, history, export, results, and accepted-rematch flow.

## 4. Verification

Test move/timeout races, exact expiry boundaries, increment and retry behavior, disconnect recovery, duplicate search requests, cancellation/pairing races, and color-swapping rematches. Run two-browser tests against an isolated development backend before release. No capacity claim without a load test.

## Implementation status

- Server clocks, accepted-move accounting, durable flag fall, and rematch reset implemented.
- Guest queue, leases, cancellation receipts, rate limits, and cross-flow availability checks implemented.
- Home search/time selection, player clocks, countdown, mobile placement, and time-control export implemented.
- Verified with 120 unit tests, 24 browser scenarios, backend/Svelte type checks, lint, and a production build. Browser scenarios ran against an isolated local backend; its guest quotas were reset between test batches. No cloud release or Git push is part of this milestone pass.
