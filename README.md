# 4D chess

Multiplayer 4D chess built with SvelteKit and Convex. The first release will support untimed friend matches through guest invitation links. See [architecture.md](architecture.md) for the agreed design.

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

The homepage is still the starter. Multiplayer screens and authoritative move submission are the next checkpoints.

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

Joining increments the revision from 0 to 1 while keeping `ply` at 0. Repeated requests do not increment it. Expiry only affects waiting matches; active matches remain intact when clients disconnect. The seven-day cleanup retention proposal is not implemented yet.

The backend derives each invitation token using HMAC-SHA-256 with `INVITE_SECRET`, the participant ID, and the creation request ID. It stores only a SHA-256 hash of the token in `invites`. This allows retry and creator recovery without storing the raw token. Keep the invitation secret stable while invitations are open. Account linking is not enabled yet.

Set these values in the Convex deployment, never in public frontend variables:

- `BETTER_AUTH_SECRET`: a cryptographically random secret of at least 32 bytes.
- `INVITE_SECRET`: a separate cryptographically random secret of at least 32 bytes.
- `SITE_URL`: `https://4dchess.justglow.dev` for the current development site.
- `TRUSTED_ORIGINS`: the site origin and explicitly permitted local development origins, separated by commas.

This workspace's values are saved in the ignored `.env.convex.local`. Upload that file with `bunx convex env set --from-file .env.convex.local`; the command refuses conflicting existing values by default. Do not copy actual secrets into documentation or commit them.

## Development site

The Cloudflare Worker uses the custom domain [4dchess.justglow.dev](https://4dchess.justglow.dev). It currently connects to the Convex development deployment. Set up a separate production backend before treating this as the public game service.

The custom-domain route is in `wrangler.jsonc`. Build with the intended Convex public URLs, then deploy:

```sh
bun run build
bun run deploy:frontend
```

The Worker only needs the asset binding. Authentication and invitation secrets live in Convex. `.env*` files, `.dev.vars*`, private keys, and logs are ignored by Git; only `.env.example` is tracked. Local checkpoint commits use a GitHub noreply address.
