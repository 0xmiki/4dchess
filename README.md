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
bun run lint
bun run build
```

`gen` creates the Cloudflare runtime types required by the starter's checks and build. The frontend uses the Cloudflare adapter. Supply the appropriate `PUBLIC_CONVEX_URL` at build time when configuring a future frontend deployment.

Wrangler currently has a [SvelteKit type-generation issue](https://github.com/cloudflare/workers-sdk/issues/14181): running `gen` after a build can reference the compiled Worker and cause source checks to report errors in generated JavaScript. Until this is fixed, clear the generated `.svelte-kit/cloudflare` build directory before regenerating types and checking. The next build recreates it. The standalone rules tests and backend check do not depend on this build output.

## Current scope

Convex setup includes the Svelte client, an empty schema, generated types, and a health query. The shared `fourfold-v1` rules engine is implemented in `src/lib/chess/` with movement, king safety, state transitions, and automatic outcomes. See its [API notes](src/lib/chess/README.md).

Guest authentication, match tables, and multiplayer UI are still to be implemented.
