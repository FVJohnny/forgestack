# Repository Guidelines

## Project Structure & Module Organization

This Nx monorepo is a starter template for NestJS microservices. Backend code lives in `backend/services/<service>/src`; `service-1` illustrates the expected bounded-context layout. Shared domain and infrastructure utilities (events, tracing, logging, outbox helpers) reside in `backend/libs/*`, while the sample frontend sits in `frontend/`. Docker Compose files for local and production workflows are under `infra/compose/`, and each service’s `project.json` wires Nx targets.

## Architecture Overview

Service-1 applies hexagonal architecture with DDD and CQRS. Domain entities, value objects, and repository contracts live in `domain/`. Application commands, queries, and domain-event handlers sit in `application/`, orchestrating behaviour without transport concerns. Adapters in `interfaces/` expose REST endpoints and integration-event handlers, while `infrastructure/` supplies MongoDB and in-memory repositories that can be swapped via Nest injection tokens. The shared libs provide cross-cutting primitives such as the Outbox pattern, distributed tracing, and integration-event publishing.

## Build, Test & Development Commands

- `npm run dev:start` provisions prerequisites and git hooks, creates `.env` files, and brings up the full stack via `infra/scripts/start-dev.sh` (MongoDB, Redis, Kafka, monitoring, Caddy). Stop it with `npm run dev:down`.
- `npm run dev:restart <service>` recreates a single service (e.g. `npm run dev:restart service-1`); `npm run dev:restart:all` does a full down + up. Tail logs with `npm run dev:logs`.
- `npm run build` runs `nx run-many -t build`; target a single service with `nx build service-1`.
- `npm run typecheck` runs TypeScript checking across the monorepo.
- `npm run lint` enforces the shared ESLint + Prettier rules (including the custom architectural rules); `npm run lint:fix` autofixes. Fix violations before committing.
- `npm run test` executes the Jest suites; `npm run test:watch` for watch mode and `npm run test:nocache` to bypass the Nx cache.
- `npm run prod:update` builds images and deploys the production docker-compose stack via the interactive menu.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation. Follow NestJS conventions: modules/services/controllers in PascalCase filenames, camelCase methods, and UPPER_SNAKE env constants. Keep reusable DTOs and domain primitives in `backend/libs` and re-export from `index.ts`. Run linting or `nx format` before commits; the root `eslint.config.mjs` is authoritative.

## Testing Guidelines

Unit specs live beside implementation files (`*.spec.ts`). Repositories, converters and services are exercised through shared **contract tests** (see `backend/libs/common/src/test-exports`), so a single contract is reused across the in-memory, MongoDB and Redis adapters. Watch coverage in `coverage/` and prevent regressions when touching business logic or adapters.

## Commit & Pull Request Guidelines

Commits follow the conventional format visible in history (`refactor: ...`, `feat: ...`); include scopes when helpful (`feat(auth): add refresh handler`). Pull requests should summarize behavioural changes, note impacted services/libs, link issues, and attach UI screenshots. Call out migrations or env vars, and confirm `npm run test` plus `npm run lint` before requesting review.
