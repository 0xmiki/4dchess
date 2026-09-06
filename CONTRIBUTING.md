# Contributing

Keep changes focused. Describe the problem, the resulting behavior, and how you checked it. For visual changes, include a screenshot at desktop and mobile widths.

## Setup

Follow [development.md](docs/development.md) using your own Convex deployment. Never run the multiplayer test suite against a backend you do not control.

## Project layout

- `src/lib/chess/`: pure rules, search, history, threat analysis, and export.
- `src/lib/components/`: shared controls, board rendering, and lessons.
- `src/convex/`: authentication, invitations, room lifecycle, and authoritative moves.
- `src/routes/`: SvelteKit screens and the auth proxy.
- `e2e/`: two-browser and interaction checks.

## Checks

```sh
bun run test:unit -- --run
bun run check:backend
bun run check
bun run lint
bun run build
```

Run the browser tests for changes to navigation, room lifecycle, or board interaction. Add meaningful regression coverage for rules and persistence changes. Do not change the frozen prototype fixture to make a failing parity test pass.

Use Conventional Commits, for example `feat: add a lesson` or `fix: preserve a pending move on reload`. Keep credentials, guest cookies, private invitation links, and local environment files out of commits and reports.
