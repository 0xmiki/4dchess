# Local development

Install Bun, then run `bun install`. Create or select your own Convex project with `bunx convex dev --once`. The CLI saves deployment URLs to the ignored `.env.local` file. Use `.env.example` as a reference; do not replace the real URLs with its placeholders.

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
