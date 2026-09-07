# Deploying to Cloudflare

The frontend runs on Cloudflare Workers and the multiplayer backend runs on Convex. Use your own deployments when hosting a fork.

## One-time setup

1. Create a Convex deployment. Configure `SITE_URL`, `TRUSTED_ORIGINS`, `BETTER_AUTH_SECRET`, `INVITE_SECRET`, and `AUTH_PROXY_SECRET` as described in [development.md](development.md), using your public site origin.
2. Edit the Worker name and hostname route in `wrangler.jsonc`. The checked-in route belongs to the hosted demo; change it for your own site. A hostname route needs an existing proxied DNS record. Alternatively, configure a Worker custom domain.
3. Change the social metadata URLs in `src/routes/+layout.svelte` to your public site origin.
4. Keep the Worker's `AUTH_PROXY_SECRET` identical to Convex's value. The Worker declares it as a required secret.

## GitHub Actions

The [CI workflow](../.github/workflows/ci.yml) runs a full-history Gitleaks scan, formatting, lint, unit tests, backend type checking, Svelte checking, and a production build for pull requests and pushes to `main`. These checks use placeholder public URLs and need no deployment credentials. Actions are pinned to commit hashes.

To enable deployment, create a GitHub environment named `production` and add these secrets:

| Secret                  | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Account that owns the Worker and zone                                      |
| `CLOUDFLARE_API_TOKEN`  | A token scoped to that account and zone with Worker deployment permissions |
| `CONVEX_DEPLOY_KEY`     | Production-scoped deploy key for the backend this site should use          |
| `AUTH_PROXY_SECRET`     | The same value already configured on that backend                          |

Set the repository variable `PRODUCTION_CONVEX_URL` to the production backend's exact HTTPS origin and `CLOUDFLARE_DEPLOY_ENABLED` to `true`. Until enabled, only checks run. The release scripts reject non-production keys and stop before publishing if Convex injects a different backend URL. You may add environment approval rules in GitHub. Pull requests never receive deployment secrets or publish a Worker.

On a successful `main` build, CI builds against the URL provided by the Convex deploy key, publishes backend changes, and then deploys the Worker with its auth secret. Deployments are serialized so one release cannot interrupt another. A failure in either the build or backend deployment prevents the Worker deployment.

The workflow is ready to use once this project has a GitHub repository and the secrets above. It does not create a repository, generate deploy tokens, or enable Cloudflare's separate Workers Builds integration.

## Manual deployment

Authenticate with `bunx wrangler login`, configure your backend URLs, and run the checks from [CONTRIBUTING.md](../CONTRIBUTING.md). Publish matching backend code before deploying the frontend.

```sh
bun run gen
bun run build
bunx wrangler secret put AUTH_PROXY_SECRET
bun run deploy:frontend
```

## Hosted demo

The demo is at [4dchess.lol](https://4dchess.lol). Its Worker route uses the existing proxied apex DNS record. The optional redirect Worker under `infrastructure/legacy-domain/` preserves older links to the demo. Forks do not need to deploy that Worker.

The demo's production backend is `gregarious-parrot-749`; `tough-sardine-116` is development only. Production was migrated with the released application code, game records, and Better Auth component records. Development uses separate secrets and test data. Never run browser tests against the public site.

Browser saves and guest cookies belong to their site origin and do not automatically move when changing domains. Keep auth and invitation secrets stable across releases.
