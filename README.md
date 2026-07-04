# ForgeStack

**A solid foundation for production-ready apps.**

ForgeStack is an opinionated, batteries-included starting point for building real applications — not just a backend framework. It ships a hexagonal architecture with Domain-Driven Design (DDD) and CQRS, an outbox/inbox pattern for reliable integration events over Kafka, a Next.js dev-console frontend, full observability (metrics, logs, traces), TLS-terminated deploys, and a set of custom ESLint rules that enforce the architectural boundaries so the design stays intact as the codebase grows.

Because the structure is consistent and the boundaries are enforced, the codebase is unusually **legible to both engineers and AI coding agents** — patterns are predictable, so generated code lands in the right place. A demo `auth` → `notifications` event flow shows the end-to-end wiring you can copy for your own bounded contexts.

## Features

- **Hexagonal architecture + DDD + CQRS** — clear separation of `domain`, `application`, `infrastructure`, and `interfaces` layers, with command/query handlers built on shared base classes.
- **Reliable event-driven messaging** — outbox/inbox pattern over Kafka guarantees at-least-once delivery of integration events between bounded contexts.
- **Architecture enforced by ESLint** — custom rules block illegal cross-layer and cross-context imports, direct entity mutation, raw CQRS decorators, and more, so violations fail lint instead of review.
- **Built for AI agents** — predictable structure and enforced patterns mean coding agents (and new teammates) can navigate and extend the codebase without guesswork.
- **Full observability out of the box** — Prometheus metrics, Grafana dashboards, Loki logs, and Tempo distributed traces, all pre-wired via Docker Compose.
- **Deployable day one** — Docker Compose, a Caddy reverse proxy with automatic TLS, and one-command deploy + server-provisioning scripts.
- **Pluggable infrastructure** — repository contracts live in the domain and are bound to MongoDB, Redis, or in-memory implementations via NestJS injection tokens, making tests fast and adapters swappable.
- **Nx monorepo** — shared libraries, per-project targets, caching, and a single dependency graph across backend services and the frontend.
- **Auth + a dev-console frontend** — a Next.js 16 / React 19 app with login, registration, password reset, and a live dashboard (system health + event throughput + admin), internationalized with `next-intl`.

## Monorepo structure

```
.
├── backend/
│   ├── libs/                       # Shared, framework-agnostic infrastructure
│   │   ├── common/                 # CQRS base classes, outbox/inbox, integration events, tracing, metrics, error handling
│   │   ├── kafka/                  # Kafka publishing & consuming for integration events
│   │   ├── mongodb/                # MongoDB repository base classes + outbox storage
│   │   └── redis/                  # Redis caching & session helpers
│   └── services/
│       └── service-1/              # The NestJS API (hexagonal + DDD + CQRS)
│           └── src/bounded-contexts/
│               ├── auth/           # Registration, login, JWT, password reset
│               ├── notifications/  # Consumes auth events, sends emails (minimal user projection)
│               └── shared/         # Cross-context value objects
├── frontend/
│   └── public-page/                # Next.js 16 / React 19 auth shell (Tailwind, Radix UI, next-intl)
├── infra/
│   ├── docker/                     # Docker Compose (dev/prod), Caddy, env files, deploy scripts
│   └── monitoring/                 # Prometheus, Grafana, Loki, Tempo, Promtail configs
└── eslint/rules/                   # Custom ESLint rules enforcing DDD/CQRS/hexagonal boundaries
```

## Getting started

### Prerequisites

- **Node.js 22**
- **Docker** (Docker Desktop on macOS/Windows)

### Install

```bash
npm install
```

### Start the local dev stack

`dev:start` provisions prerequisites (Node, Docker), installs git hooks, creates `.env` files from the `.example` templates, and brings up the full stack via Docker Compose.

```bash
npm run dev:start     # start API, frontend, Mongo, Redis, Kafka, monitoring, Caddy
```

The stack is served through Caddy with local HTTPS. The first run installs Caddy's local CA certificate so your browser trusts the self-signed certs; if it was skipped, run `npm run dev:trust-cert`. Default URLs use placeholder hostnames such as `https://localhost`, `https://grafana.localhost`, etc. — configure the domain in `infra/env/`.

Useful dev scripts:

| Command | Description |
|---------|-------------|
| `npm run dev:start` | Provision prerequisites, install git hooks, create `.env` files, and start all services |
| `npm run dev:down` | Stop development services |
| `npm run dev:restart` | Recreate one or more services (e.g. `npm run dev:restart service-1`) |
| `npm run dev:restart:all` | Full down + up (clean slate) |
| `npm run dev:logs` | Tail logs from all services |
| `npm run dev:trust-cert` | Trust Caddy's local CA certificate |

### Verify your changes

```bash
npm run typecheck     # TypeScript across the monorepo
npm run lint          # ESLint (includes the custom architectural rules)
npm run test          # Jest test suites
```

Other useful scripts: `npm run lint:fix`, `npm run test:watch`, `npm run test:nocache`, `npm run build`.

## Architecture

`service-1` is organized into **bounded contexts** under `src/bounded-contexts/`, each split into the four hexagonal layers:

```
src/bounded-contexts/<context>/
  domain/           # Entities, value objects, repository interfaces, domain events, domain services
  application/      # Command handlers, query handlers, domain-event handlers
  infrastructure/   # Repository implementations (mongo, in-memory…) and outbound adapters
  interfaces/       # REST controllers and inbound integration-event consumers
```

Key patterns:

- **Commands mutate, queries read** — both extend shared base classes from `@libs/nestjs-common`.
- **Entities are mutated only through behavior methods** — direct property assignment is blocked by lint.
- **Dependency inversion** — repository contracts are defined in `domain/` and bound to implementations in `infrastructure/` via NestJS injection tokens, so in-memory adapters can be swapped in for tests.

### Event flow (outbox → Kafka → inbox)

Bounded contexts never call each other directly. They communicate through integration events with delivery guarantees:

```
[auth] domain event ─▶ Outbox (same DB txn) ─▶ Kafka ─▶ Inbox (dedupe) ─▶ [notifications] handler
```

1. An aggregate in `auth` raises a domain event (e.g. `UserCreated`).
2. The event is written to the **outbox** within the same transaction that persists the aggregate, then relayed to **Kafka**.
3. The `notifications` context consumes it via the **inbox** (which deduplicates) and reacts — e.g. sending a welcome email.

This gives at-least-once delivery and exactly-once processing without distributed transactions.

## Bounded contexts (demo)

Two contexts ship as a working reference for the pattern:

- **`auth`** — user registration, login, JWT issuance, and password reset. Publishes user-lifecycle integration events.
- **`notifications`** — consumes `auth` integration events and sends emails. Keeps a minimal local user projection rather than reaching into another context's data.
- **`shared`** — value objects reused across contexts.

Add your own contexts by following the same four-layer layout; the ESLint rules will keep the boundaries honest.

## Observability

The Docker Compose stack wires a complete observability pipeline:

- **Prometheus** — scrapes service metrics.
- **Grafana** — dashboards over Prometheus, Loki, and Tempo.
- **Loki** + **Promtail** — log aggregation and shipping.
- **Tempo** — distributed tracing (OpenTelemetry from the services).

Each is exposed behind Caddy at a placeholder subdomain (e.g. `https://grafana.localhost`).

## Deployment

Production runs the same services via `infra/compose/docker-compose.prod.yml`. Deploys are driven by an interactive, menu-based script:

```bash
npm run prod:update          # interactive menu
npm run prod:update -- 3     # or pass the option number directly
```

The script builds `linux/amd64` images, pushes them to your Docker registry (configure in `infra/env/infra.env.prod`), auto-increments the image version tags in the prod compose file, then syncs the compose + env files to the server and runs `docker compose up -d`. Menu options:

1. Update frontend
2. Update service-1
3. Update ALL apps
4. Update Caddy (reverse proxy)
5. Update monitoring stack
6. Update ALL (apps + proxy + monitoring)
7. Deploy only (no builds — re-deploy current image versions)

Production env files live in `infra/env/*.env.prod` (gitignored); the matching `*.env.prod.example` files document the required keys. See [`docs/deployment.md`](docs/deployment.md) and [`docs/infrastructure.md`](docs/infrastructure.md) for details.

## Custom ESLint rules

The rules in `eslint/rules/` are what keep the architecture from eroding. They run as part of `npm run lint` and include:

- `hexagonal-architecture` — domain can't import application/infrastructure; application can't import infrastructure.
- `no-cross-bc-imports` — bounded contexts may not import each other's internals.
- `no-direct-entity-mutation` — aggregates are changed only through behavior methods.
- `no-direct-cqrs-decorators` — use the provided `Base_*` handler classes, not raw NestJS CQRS decorators.
- `cqrs-handler-collocation` / `handler-naming` — commands, queries, and events live and are named consistently with their handlers.
- `value-object-naming` — `.vo.ts` files implement the value-object contract.
- `*-base` rules (`aggregate-base`, `command-handler-base`, `query-handler-base`, `domain-event-handler-base`, `repository-base`, …) — enforce extension of the shared base classes.

## Documentation

More detailed guides live in [`docs/`](docs/): architecture, code style, commands, frontend, infrastructure, and deployment.

## License

[MIT](LICENSE)
</content>
</invoke>
