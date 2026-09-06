# 4D chess

4D chess built with SvelteKit and Convex, with untimed friend matches and local computer play. See [architecture.md](architecture.md) for the agreed design.

## Development

Install dependencies with Bun:

```sh
bun install
```

This workspace is connected to the `4dchess` Convex project. Its development deployment is `your-deployment` in `eu-west-1`.

On a new checkout, authenticate and select the existing project:

```sh
bunx convex dev --configure existing --once
```

Choose `4dchess` and a cloud development deployment. Convex writes deployment settings to the ignored `.env.local`. `.env.example` documents the expected variables. CLI credentials remain in the machine's Convex configuration and are never included in the frontend.

Start the frontend and backend watcher together:

```sh
bun run dev:all
```

Alternatively, run `bun run dev` and `bun run dev:backend` in separate terminals.

## Backend access

Backend functions and schema live in `src/convex/`. Convex generates the API and model types in `src/convex/_generated/`; keep these files with the source and regenerate them through the CLI.

Push changes to the configured development deployment:

```sh
bun run convex:push
```

Verify that deployed functions can be called:

```sh
bun run convex:health
```

The health query returns `{ "status": "ok" }`. It exposes no player or game data.

The CLI provides agent access to push functions, run functions, inspect data, and read logs using the existing machine login. No MCP connection is required for this workflow. These scripts target the configured development deployment; they do not publish the frontend or deploy production backend code.

[Open the development dashboard](https://dashboard.convex.dev/d/your-deployment).

## Checks

```sh
bun run gen
bun run check
bun run check:backend
bun run test:rules
bun run test:backend
bun run lint
bun run build
```

`gen` creates the Cloudflare runtime types required by the starter's checks and build. The frontend uses the Cloudflare adapter. Supply the appropriate `PUBLIC_CONVEX_URL` at build time when configuring a future frontend deployment.

Wrangler currently has a [SvelteKit type-generation issue](https://github.com/cloudflare/workers-sdk/issues/14181): running `gen` after a build can reference the compiled Worker and cause source checks to report errors in generated JavaScript. Until this is fixed, clear the generated `.svelte-kit/cloudflare` build directory before regenerating types and checking. The next build recreates it. The standalone rules tests and backend check do not depend on this build output.

## Current scope

The shared `fourfold-v1` rules engine is implemented in `src/lib/chess/` with movement, king safety, state transitions, and automatic outcomes. See its [API notes](src/lib/chess/README.md).

Guest authentication and the match lobby backend are implemented. Better Auth runs as a Convex component, and SvelteKit proxies `/api/auth/*` so browser sessions use cookies on the app's own domain. The client integration is configured in the root layout. Opening a page does not automatically create a guest.

Friend rooms support repeated games: create a room, share its invitation, join in another browser, play, and finish by the variant's automatic outcomes or resignation. New game starts the next round for both players in that same room. The Svelte board preserves the prototype's piece artwork, four flat boards, legal-move markers, and rotatable tesseract projection. Black sees the flat boards from the opposite side. The sidebar score sheet supports historical review without changing the live position.

Invitation tokens travel in the URL fragment rather than the request path. The browser creates a guest only after an explicit create/join action and coordinates guest establishment across tabs when the browser supports Web Locks. The board waits for server-confirmed state. Pending moves retain their request ID in session storage, so refreshing after a lost acknowledgement retries the original request. Disconnecting disables input without forfeiting the match.

The start screen offers **Play with friend** followed by **Play computer**. Friend settings live at `/friend`; computer settings and play live at `/computer`.

Home auto-resumes a remembered room until it finishes, is cancelled, or is explicitly left. Otherwise, the home page offers a side toggle and stacked friend and computer play options beside a live Easy-versus-Easy tesseract demo. Friend play creates an invitation directly; computer play starts or restores a game. The separate `/how-to-play` page includes an interactive guide adapted from the original prototype: one move at a time for all six pieces, an example move, and a free-practice board with piece placement, undo, and reset. Learning does not create a guest session or change a game.

The shared visual foundation is documented in [design-language.md](docs/design-language.md). Colors, typography stacks, and shape tokens live in `src/lib/design.css`. The tesseract mark, dashed W links, coordinate labels, and state colors have consistent meanings across the guide and game. Automated checks cover the primary text/graphic contrast pairs and the legality of the teaching examples.

Threat inspection is available in both modes through right-click, long-press, Shift+F10, or the selected piece's inspection button. It identifies enemy attackers and friendly defenders on both board views. Inspecting a destination previews the selected piece there without changing the game, including a warning when that move leaves the king in check.

Moves animate across the flat boards and tesseract from one shared progress value. Multiplayer animations start only after server confirmation. Promotion displays the moving pawn until arrival. Reduced-motion preferences and hidden tabs skip or finish animations.

Computer play uses a local Web Worker with iterative deepening, alpha-beta search, capture search, and bounded caches. Easy, Medium, Hard, and Extreme use progressively larger time/depth budgets. It creates no guest sessions or backend matches. The move history and settings are saved locally and validated by replay on restoration. Computer games support resignation, which is persisted with the save. A retry action handles worker failures. Search is paused when the tab is hidden and cancelled when a new game starts. Search choices can vary with device speed because its time budget is bounded.

The export icon beside the score sheet copies or downloads 4D PGN, including coordinates, variant/rules metadata, promotions, checks, and the game result. Friend exports collect a complete move prefix matching the selected match snapshot. Computer exports use local history. Import and undo/takebacks remain deferred. The original prototype is unchanged.

Reusable controls and board elements live in [`src/lib/components`](src/lib/components/README.md). Control-specific styles live with the components; global typography and layout utilities remain in `src/routes/layout.css`.

## Guest and lobby API

Use `authClient.signIn.anonymous()` from `src/lib/auth-client.ts` when a player chooses to create or join a match and has no existing session. Wait for Convex authentication to settle before calling a mutation. Reuse a current guest session rather than signing in anonymously again. Sessions expire after 30 days of inactivity, with daily renewal on use.

| Function              | Behavior                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `participants.ensure` | Resolve or create one stable participant for the verified session.                                                                   |
| `participants.me`     | Return only the caller's participant ID and guest status.                                                                            |
| `games.create`        | Reserve the requested seat, create an invitation, and schedule 24-hour expiry. Pass a UUID v4 request ID and reuse it when retrying. |
| `games.previewInvite` | Return a limited invitation preview without claiming a seat or requiring a session.                                                  |
| `games.join`          | Atomically claim the remaining seat or return the caller's existing seat.                                                            |
| `games.get`           | Return the stored match and the caller's seat, for members only.                                                                     |
| `games.getInvitation` | Recover an open invitation token, for its creator only.                                                                              |
| `games.cancel`        | Cancel a waiting match, for its creator only, with a revision check.                                                                 |
| `games.resign`        | End an active match with the other side as winner. Requires an expected revision and request ID.                                     |
| `moves.submit`        | Validate membership, turn, revision, and move legality; atomically save the move, next position, and any result.                     |
| `moves.receipt`       | Recover the caller's accepted move receipt by request ID.                                                                            |
| `moves.latest`        | Return the latest move for highlighting, for members only.                                                                           |
| `moves.list`          | Paginate move history, newest first, for members only.                                                                               |

Joining increments the revision from 0 to 1 while keeping `ply` at 0. Repeated requests do not increment it. Expiry only affects waiting matches; active matches remain intact when clients disconnect. Expired or cancelled, never-started matches are removed after seven days. See [operations.md](docs/operations.md) for limits, retention, and monitoring.

The backend derives each invitation token using HMAC-SHA-256 with `INVITE_SECRET`, the participant ID, and the creation request ID. It stores only a SHA-256 hash of the token in `invites`. This allows retry and creator recovery without storing the raw token. Keep the invitation secret stable while invitations are open. Account linking is not enabled yet.

Move requests contain `{ gameId, move: { from, to }, expectedRevision, requestId }`. Accepted moves store their original revision and result as a receipt. The server checks that receipt before current turn, revision, or terminal-state checks. Retries therefore still succeed after an opponent reply or game ending. Reusing a request ID with different contents fails. Resignation receipts live in a separate `commands` table.

Set these values in the Convex deployment, never in public frontend variables:

- `BETTER_AUTH_SECRET`: a cryptographically random secret of at least 32 bytes.
- `INVITE_SECRET`: a separate cryptographically random secret of at least 32 bytes.
- `AUTH_PROXY_SECRET`: a separate secret shared with the Worker, used to verify the website's anonymous-signup requests. Configure the same value in the ignored local `.env.local` for development and as a Worker secret for deployment.
- `SITE_URL`: `https://4dchess.lol` for the current development site.
- `TRUSTED_ORIGINS`: the site origin and explicitly permitted local development origins, separated by commas.

This workspace's values are saved in the ignored `.env.convex.local`. Upload that file with `bunx convex env set --from-file .env.convex.local`; the command refuses conflicting existing values by default. Do not copy actual secrets into documentation or commit them.

## Browser verification

With the app running against a development backend:

```sh
E2E_BASE_URL=http://localhost:5173 bun run test:multiplayer
```

Install Chromium with `bunx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing Chromium executable. The tests require an explicit URL because friend tests create guest sessions and completed matches on that backend. They verify isolated players, synchronized moves, refresh after a lost acknowledgement, reconnection, repetition, resignation, threat inspection, animations, reduced motion, exports, and local computer-game restoration without backend requests. Signup limits apply to browser tests too; avoid repeatedly creating guests in a short period. Test reports remain in the ignored `test-results` directory.

## Development site

The Cloudflare Worker `4dchess-lol` serves [4dchess.lol](https://4dchess.lol). It currently connects to the Convex development deployment. Set up a separate production backend before treating this as the public game service.

The `4dchess.lol/*` Worker route is in `wrangler.jsonc`. It uses the existing proxied apex DNS record, which must remain proxied. Build with the intended Convex public URLs, then deploy:

```sh
bun run build
bun run deploy:frontend
```

The Worker uses the asset and guest-signup rate-limit bindings plus `AUTH_PROXY_SECRET`. Authentication and invitation secrets live in Convex. `.env*` files, `.dev.vars*`, private keys, and logs are ignored by Git; only `.env.example` is tracked. Local checkpoint commits use a GitHub noreply address.

The previous Worker, `4dchess`, only redirects requests from `4dchess.justglow.dev` to `4dchess.lol`, preserving the path and query. Its separate configuration is in `infrastructure/legacy-domain/wrangler.jsonc`. Deploy it with `bunx wrangler deploy --config infrastructure/legacy-domain/wrangler.jsonc`. Guest cookies and browser saves are origin-specific; they do not transfer automatically between these domains.
