# Local development

Install Bun, then run `bun install`. Create or select your own Convex project with `bunx convex dev --once`. The CLI saves deployment URLs to the ignored `.env.local` file. Use `.env.example` as a reference; do not replace the real URLs with its placeholders.

`bun run dev:all` starts the frontend and syncs backend code to the selected development deployment. The development scripts reject production deployments, deploy keys, and mismatched frontend URLs. Keep `CONVEX_DEPLOY_KEY` out of local environment files. Development has its own database and authentication secrets; never copy production sessions into it for testing.

The hosted project's development deployment is `tough-sardine-116`. The public site uses the separate production deployment `gregarious-parrot-749`. No `DEVELOPMENT=true` flag is needed: `.env.local` selects development, while CI selects production with a deployment-scoped key. Restart the frontend after changing these environment variables.

## Authentication setup

Generate three separate random secrets. For each one, use a password manager or run:

```sh
openssl rand -hex 32
```

Store these values in an ignored `.env.convex.local` file:

```dotenv
SITE_URL=http://localhost:5173
TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
BETTER_AUTH_SECRET=replace-with-a-random-secret
INVITE_SECRET=replace-with-another-random-secret
AUTH_PROXY_SECRET=replace-with-a-third-random-secret
```

Copy the same `AUTH_PROXY_SECRET` value into `.env.local`. It authenticates anonymous-signup requests between SvelteKit and Convex. The other two secrets stay on the backend.

Upload the backend variables and start development:

```sh
bunx convex env set --from-file .env.convex.local
bun run dev:all
```

The environment command refuses conflicting values by default. Only use `--force` when intentionally changing variables on your own deployment. Keep `INVITE_SECRET` stable while invitations are open.

Opening the home page does not create a guest. A guest is created when someone creates or accepts a challenge. Guest names and completed games are stored in Convex; computer games are stored in the browser.

## Checks

```sh
bun run gen
bun run check
bun run check:backend
bun run test:unit -- --run
bun run lint
bun run build
```

Wrangler has a [SvelteKit type-generation issue](https://github.com/cloudflare/workers-sdk/issues/14181). If type generation after a build includes compiled Worker JavaScript, remove the generated `.svelte-kit/cloudflare` directory and rerun `bun run gen` before checking. The next build recreates it.

## Browser tests

With the app and a development backend running:

```sh
bunx playwright install chromium
E2E_BASE_URL=http://localhost:5173 bun run test:multiplayer
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation. These tests create real guest sessions and rooms on the specified backend. Signup limits apply, so avoid repeatedly running them against a shared deployment.

The [rules reference](../src/lib/chess/README.md), [architecture](../architecture.md), and [operations notes](operations.md) explain the data model and checks in more detail.

## README and social images

The README screenshot and social card are captured from the actual board renderer, using a fresh computer game so every piece is on its starting square. The README composition removes coordinates, axes, and hints from the capture only, and aligns the four boards beside the tesseract. With the local app running:

```sh
bunx playwright install chromium
node scripts/capture-images.mjs
```

Install TeX Gyre Pagella to reproduce the social card's serif title. Set `CAPTURE_URL` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use a different local preview or browser. The capture does not create a guest session or multiplayer room.

## Game stats preview

After `bun run convex:push`, run `bunx convex run stats:refresh '{}'` to prepare the first development summary. Open `/stats` on the local frontend. Production deployment remains owned by CI.

The stats cron refreshes every five minutes. Visitors read one anonymous summary; collection scans retained games in pages of at most 100 and publishes only after completion. Interrupted builds are replaced after 15 minutes, and the page labels old summaries as delayed. Collection cost grows with game history; replace periodic scans with incremental counters if scans become expensive or approach the refresh interval.

Totals cover started multiplayer games and rematches, excluding cancelled and aborted games. Local computer games are not counted. Unfinished games may include abandoned sessions without a recorded result. Daily counts cover seven UTC dates, including the current partial day. Counts are periodic observations rather than a transactionally consistent snapshot. No player identities or room links are returned.

Unique active players means distinct participant identities with at least one recorded multiplayer move. The snapshot scans the last 30 UTC dates through its cutoff time using the move timestamp index. Daily, seven-day, and 30-day counts deduplicate independently; the longer totals never sum daily counts. The current UTC date is partial. Moves still count when a game is later aborted. Guests can count separately after clearing a session or switching browsers.

Temporary per-build player/day masks keep deduplication bounded per transaction. They stay private and are deleted in batches after publishing or replacing an interrupted build. The public summary contains only counts. The activity scan adds work proportional to moves in the last 30 days, independent of dashboard visitor traffic.
