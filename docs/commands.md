# Commands

> Quick in-repo reference. The canonical pages are **[Project Structure](https://forgestack.fvjohnny.com/docs/project-structure)** and **[Adding a Service](https://forgestack.fvjohnny.com/docs/guides/adding-a-service)** on the docs site; when the two disagree, the docs site wins.

Standard scripts live in `package.json`. Read it directly for the full list (`dev:start`, `dev:down`, `dev:restart`, `lint`, `lint:fix`, `typecheck`, `test`, `test:nocache`, `test:eslint-rules`, `prod:setup`, `prod:update`, etc.).

## Not obvious from `package.json`

### Scaffold a new backend service

```bash
npx nx g @forgestack/tools:service <name>   # --dry-run to preview, --expose=false for event-only services
```

Generates `backend/services/<name>/` (starter bounded context included), wires the compose files, the Caddy route and the env templates, and installs the new package into the workspace (no separate `npm i`). The service is served under a path prefix on the main origin: `service-<N>` at `/svc<N>`, any other name at `/svc<name without dashes>` (e.g. `billing` → `https://localhost/svcbilling/api/v1`). The generator prints the exact URLs. Full walkthrough: [Adding a Service](https://forgestack.fvjohnny.com/docs/guides/adding-a-service).

### Scaffold a bounded context

```bash
npx nx g @forgestack/tools:bounded-context <name> --service=<service>   # --command=<kebab-name> for the starter command
```

### Run the checks the way CI does

`npm run lint`, `typecheck`, `test` and `build` run Nx targets for every project, including the pnpm-managed frontend, so install its dependencies once with `corepack enable && pnpm -C frontend/public-page install`. CI also runs:

```bash
npm run test:eslint-rules                                # tests for the custom ESLint rules
npm --prefix frontend/public-page run check:locales      # every locale file has the same keys
```

`npm run test` needs MongoDB and Redis on localhost (the repository contract tests hit real datastores): keep the dev stack up, or run `docker compose -f infra/compose/docker-compose.dev.yml up -d mongodb redis`.

### Run a single test file

From the service directory:

```bash
cd backend/services/service-1 && npx jest src/path/to/test.spec.ts
```

### Hot reload caveat for `backend/libs/`

Service code hot-reloads, but edits in `backend/libs/` (common, kafka, mongodb, redis) do NOT reach a running service container. Recreate it with `npm run dev:restart <service>`: on start, the container notices the changed lib sources and rebuilds before launching.

### Restarting one service vs. the whole dev stack

- `npm run dev:restart <service>`: recreates just the named container(s) (e.g. `npm run dev:restart service-1`). Uses `docker compose up --force-recreate --no-deps`, so env-file edits are picked up (a plain `docker compose restart` would NOT re-read `.env`). Leaves Kafka/Mongo/Redis untouched.
- `npm run dev:restart:all`: full down + up of every container (it runs `dev:down` then `dev:start`). Use it after changing shared infra config. It keeps the data volumes, so it is not a clean slate.
- To wipe all local data (MongoDB, Redis, Kafka, metrics), run `docker compose -f infra/compose/docker-compose.dev.yml down -v`, then `npm run dev:start`.
