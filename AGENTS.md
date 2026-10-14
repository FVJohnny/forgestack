# Repository Guidelines

## Project Structure & Module Organization

This Nx monorepo is **ForgeStack**, a starter template for NestJS microservices with a Next.js frontend. Backend code lives in `backend/services/<service>/src/bounded-contexts/<context>/`. `service-1` holds the `auth`, `notifications` and `shared` bounded contexts; `service-2` holds the `tasks` bounded context, which consumes service-1's user integration events to demonstrate events across services. Shared domain and infrastructure utilities (CQRS bases, events, outbox/inbox, tracing, logging) reside in `backend/libs/*`; `backend/libs/common/README.md` marks which parts are reusable framework and which are demo code. The frontend is `frontend/public-page` (a standalone pnpm project, not in the npm workspaces), and its MDX docs site lives in `frontend/public-page/app/docs/`. Docker Compose files for local and production workflows are under `infra/compose/`, the Nx generators under `tools/forgestack/`, the custom lint rules under `eslint/rules/`, and each project's `project.json` wires its Nx targets.

## Architecture Overview

Every service applies hexagonal architecture with DDD and CQRS, one bounded context per folder. Domain entities (aggregates), value objects, domain events and repository contracts (ports) live in `domain/`. Application commands, queries, and domain-event handlers sit in `application/`, orchestrating behaviour without transport concerns. Adapters in `interfaces/` expose REST endpoints and integration-event handlers, while `infrastructure/` supplies MongoDB and in-memory repositories (and other adapters such as SMTP) that are swapped via Nest injection tokens. Bounded contexts never import each other (`shared` is the only exception); they communicate through integration events published via the outbox to Kafka and consumed through the inbox. Delivery is at-least-once with deduplication, so integration-event handlers must be idempotent. Handlers and controllers are discovered at runtime by file suffix.

## Build, Test & Development Commands

- `npm run dev:start` checks prerequisites (it verifies Node matches `.nvmrc` and can install Docker if it is missing, but never auto-installs Node), installs git hooks, creates `.env` files, and brings up the full stack via `infra/scripts/start-dev.sh` (MongoDB, Redis, Kafka, monitoring, Caddy). The app is at `https://localhost`, the APIs at `https://localhost/svc1/api/v1` and `/svc2/api/v1`, Swagger at `/svc1/docs` and `/svc2/docs`. Stop it with `npm run dev:down`.
- `npm run dev:restart <service>` recreates a single service (e.g. `npm run dev:restart service-1`); needed after editing `.env` or `backend/libs/`. `npm run dev:restart:all` does a full down + up (data volumes are kept). Tail logs with `npm run dev:logs`.
- `npm run build` runs `nx run-many -t build`; target a single service with `nx build service-1`.
- `npm run typecheck` runs TypeScript checking across the monorepo.
- `npm run lint` enforces the shared ESLint + Prettier rules (including the custom architectural rules); `npm run lint:fix` autofixes. Fix violations before committing.
- `npm run test` executes every project's tests; `npm run test:watch` for watch mode and `npm run test:nocache` to bypass the Nx cache. It needs MongoDB and Redis on localhost (the dev stack, or `docker compose -f infra/compose/docker-compose.dev.yml up -d mongodb redis`).
- lint, typecheck, test and build include the frontend, so its dependencies must be installed on the host: `corepack enable && pnpm -C frontend/public-page install`.
- CI also runs `npm run test:eslint-rules` and `npm --prefix frontend/public-page run check:locales`.
- `npx nx g @forgestack/tools:service <name>` scaffolds a service (served at `/svc<N>` for `service-<N>`, otherwise `/svc<name without dashes>`); `npx nx g @forgestack/tools:bounded-context <name> --service=<service>` scaffolds a bounded context.
- `npm run prod:update` builds images and deploys the production docker-compose stack via the interactive menu.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, camelCase methods, and UPPER_SNAKE env vars and injection tokens. Files are kebab-case with a role suffix (`create-task.command.ts`, `create-task.command-handler.ts`, `task.aggregate.ts`, `task-title.vo.ts`, `task.repository.ts`, `task.mongodb-repository.ts`, `user-created.integration-event-handler.ts`, `create-task.controller.ts`), one folder per command or query. Classes use `Name_Role` (`CreateTask_Command`, `CreateTask_CommandHandler`, `UserRegistered_DomainEvent`, `Task_MongodbRepository`, `Email_InMemoryService`); aggregates and value objects keep plain business names (`Task`, `TaskTitle`). The suffixes are load-bearing: lint rules and runtime discovery depend on them (see `docs/code-style.md`). Keep reusable DTOs and domain primitives in `backend/libs` and re-export from `index.ts`. Run linting or `nx format` before commits; the root `eslint.config.mjs` is authoritative.

## Testing Guidelines

Unit specs live beside implementation files (`*.spec.ts`). Handlers are tested by constructing them directly with in-memory repositories and mock buses. Repositories, converters and services are exercised through shared **contract tests** (see `backend/libs/common/src/test-exports`), so a single contract is reused across the in-memory, MongoDB and Redis adapters. Watch coverage in `coverage/` and prevent regressions when touching business logic or adapters.

## Commit & Pull Request Guidelines

Commits follow the conventional format visible in history (`refactor: ...`, `feat: ...`); include scopes when helpful (`feat(auth): add refresh handler`). Pull requests should summarize behavioural changes, note impacted services/libs, link issues, and attach UI screenshots. Call out migrations or env vars, and confirm `npm run test` plus `npm run lint` before requesting review.
