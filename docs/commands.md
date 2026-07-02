# Commands

Standard scripts live in `package.json` — read it directly for the full list (`dev:start`, `dev:down`, `dev:restart`, `lint`, `lint:fix`, `typecheck`, `test`, `test:nocache`, `prod:update`, etc.).

## Not obvious from `package.json`

### Scaffold a new backend service

```bash
npx nx g @forgestack/tools:service <name>   # --dry-run to preview, --expose=false for event-only services
```

Generates `backend/services/<name>/` (starter bounded context included) and wires the compose files, Caddyfile and env templates. Follow with `npm i`. Full walkthrough: the "Adding a Service" docs page.

### Run a single test file

From the service-1 directory:

```bash
cd backend/services/service-1 && npx jest src/path/to/test.spec.ts
```

### Hot reload caveat for `backend/libs/`

After editing files in `backend/libs/` (common, kafka, mongodb, redis), service-1's dev container does NOT pick up changes automatically via hot reload. You must manually restart the service-1 container for library changes to take effect.

### Restarting one service vs. the whole dev stack

- `npm run dev:restart <service>` — recreates just the named container(s) (e.g. `npm run dev:restart service-1`). Uses `docker compose up --force-recreate --no-deps`, so env-file edits are picked up (a plain `docker compose restart` would NOT re-read `.env`). Leaves Kafka/Mongo/Redis untouched.
- `npm run dev:restart:all` — full down + up. Use when you're changing shared infra config or want a clean slate.
