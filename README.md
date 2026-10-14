# ForgeStack

[![CI](https://github.com/FVJohnny/forgestack/actions/workflows/ci.yml/badge.svg)](https://github.com/FVJohnny/forgestack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-22-brightgreen.svg)

**A solid foundation for production-ready apps.**

**[Live demo](https://forgestack.fvjohnny.com)** · **[Documentation](https://forgestack.fvjohnny.com/docs)** · [Quick start](#quick-start) · [Deployment](#deployment)

ForgeStack is an opinionated, batteries-included starting point for building real applications, not just a backend framework. It ships a hexagonal architecture with Domain-Driven Design (DDD) and CQRS, an outbox/inbox pattern for reliable integration events over Kafka, a Next.js frontend (landing page, auth, docs, and a simple signed-in app to build on), full observability in Grafana (metrics, logs, traces), TLS-terminated deploys, and a set of custom ESLint rules that enforce the architectural boundaries so the design stays intact as the codebase grows. New to these terms? See [Key concepts](#key-concepts).

Because the structure is consistent and the boundaries are enforced, the codebase is unusually **legible to both engineers and AI coding agents**: patterns are predictable, so generated code lands in the right place. Demo event flows (`auth` → `notifications` inside service-1, and `auth` → `tasks` across services) show the end-to-end wiring you can copy for your own bounded contexts.

## Quick start

On macOS or Linux (Windows: use WSL2), with Docker running and [nvm](https://github.com/nvm-sh/nvm) (or Node 22 installed some other way):

```bash
git clone https://github.com/FVJohnny/forgestack.git && cd forgestack   # or click "Use this template" on GitHub
nvm install          # installs and switches to Node 22 (pinned in .nvmrc)
npm run dev:start    # first run takes several minutes: it installs and builds inside the containers
```

Then open **https://localhost** and sign in with the seeded dev admin, `admin@example.com` / `Admin123!!??`. Every other local URL and login is listed in [Local URLs and logins](#local-urls-and-logins).

## Who it's for

ForgeStack fits when you are starting a product that will grow into several bounded contexts or services, and you want the architecture, messaging, observability and deploy path settled from day one, in a codebase that people and AI coding agents can extend without eroding it.

It is probably not the right pick when:

- **You are building a small CRUD app or a quick prototype.** The dev stack runs about 16 containers (Kafka, ZooKeeper, MongoDB, Redis, the monitoring stack, …). That is a lot of moving parts if nothing needs events between contexts.
- **You need a relational database today.** MongoDB is the only primary datastore that ships. PostgreSQL support is planned, not shipped.
- **You want serverless or a managed platform.** The deploy path targets a single Linux server running Docker Compose.

## Features

- **Hexagonal architecture + DDD + CQRS**: clear separation of `domain`, `application`, `infrastructure`, and `interfaces` layers, with command/query handlers built on shared base classes.
- **Reliable event-driven messaging**: outbox/inbox pattern over Kafka guarantees at-least-once delivery of integration events between bounded contexts, with deduplication on the consuming side.
- **Architecture enforced by ESLint**: custom rules block illegal cross-layer and cross-context imports, direct entity mutation, raw CQRS decorators, and more, so violations fail lint instead of review.
- **Built for AI agents**: predictable structure and enforced patterns mean coding agents (and new teammates) can navigate and extend the codebase without guesswork.
- **Full observability out of the box**: Prometheus metrics, Grafana dashboards, Loki logs, and Tempo distributed traces, all pre-wired via Docker Compose.
- **Deploy on the first day**: Docker Compose, a Caddy reverse proxy with automatic TLS, and one-command deploy + server-provisioning scripts.
- **Pluggable infrastructure**: repository contracts live in the domain and are bound to MongoDB, Redis, or in-memory implementations via NestJS injection tokens, making tests fast and adapters swappable.
- **Nx monorepo**: shared libraries, per-project targets, caching, and a single dependency graph across backend services and the frontend.
- **Auth + a frontend**: a Next.js 16 / React 19 app with login, registration, password reset, and a simple signed-in app (home with sign-in activity, a tasks list backed by the second service, account, and admin), internationalized with `next-intl`. Operational stats live in Grafana, not in the app.

## Key concepts

One line each, with the docs page that explains it properly:

- **Bounded context**: a self-contained slice of the business (`auth`, `tasks`, …) with its own model and code. Contexts never import each other; they talk through integration events. → [Backend](https://forgestack.fvjohnny.com/docs/backend)
- **DDD (Domain-Driven Design)**: the business rules live in one `domain/` layer per context, written in the business's own words. → [DDD](https://forgestack.fvjohnny.com/docs/backend/ddd)
- **Aggregate / value object**: an aggregate is an entity that guards its own rules (`User`, `Task`); a value object is a small, validated, immutable value (`Email`, `TaskTitle`). → [DDD](https://forgestack.fvjohnny.com/docs/backend/ddd#aggregates)
- **Hexagonal architecture (ports and adapters)**: the domain declares interfaces (ports) and infrastructure implements them (adapters), so MongoDB, Kafka or SMTP can be swapped without touching business logic. → [Hexagonal](https://forgestack.fvjohnny.com/docs/backend/hexagonal)
- **CQRS**: every use case is either a command (changes state, returns nothing) or a query (reads, changes nothing), each with its own handler. → [CQRS](https://forgestack.fvjohnny.com/docs/backend/cqrs)
- **Domain event**: raised by an aggregate when something happened inside its context (`UserRegistered_DomainEvent`) and handled in the same process. → [Events](https://forgestack.fvjohnny.com/docs/backend/events#two-kinds-of-events)
- **Integration event**: a plain, versioned message a context publishes over Kafka for other contexts and services (`UserCreated_IntegrationEvent`). → [Events](https://forgestack.fvjohnny.com/docs/backend/events#two-kinds-of-events)
- **Outbox**: integration events are saved in the same database transaction as the state change, then relayed to Kafka, so a committed change never loses its event. → [The outbox](https://forgestack.fvjohnny.com/docs/backend/events#the-outbox-publish-side)
- **Inbox**: incoming messages are recorded and deduplicated before their handler runs, so a redelivered message is not processed twice. → [The inbox](https://forgestack.fvjohnny.com/docs/backend/events#the-inbox-consume-side)

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
│       ├── service-1/              # The main NestJS API (hexagonal + DDD + CQRS)
│       │   └── src/bounded-contexts/
│       │       ├── auth/           # Registration, login, JWT, password reset
│       │       ├── notifications/  # Consumes auth events, sends emails (minimal user projection)
│       │       └── shared/         # Cross-context value objects
│       └── service-2/              # A second service showing cross-SERVICE events
│           └── src/bounded-contexts/
│               └── tasks/          # Per-user todo list; consumes service-1 user events
├── frontend/
│   └── public-page/                # Next.js 16 / React 19 app (Tailwind, Radix UI, next-intl)
├── infra/
│   ├── compose/                    # Docker Compose files (dev/prod)
│   ├── caddy/                      # Caddy reverse-proxy config (automatic TLS)
│   ├── dockerfiles/                # Dockerfiles for services and monitoring images
│   ├── env/                        # Production env templates (*.env.prod.example)
│   ├── mongo/                      # MongoDB replica-set init
│   ├── scripts/                    # dev-start, deploy, server-provisioning scripts
│   └── monitoring/                 # Prometheus, Grafana, Loki, Tempo, Promtail configs
├── tools/
│   └── forgestack/                 # Nx generator CLI (scaffolds new services)
└── eslint/rules/                   # Custom ESLint rules enforcing DDD/CQRS/hexagonal boundaries
```

## Getting started

### Prerequisites

- **macOS or Linux.** On Windows, work inside **WSL2**: every script is bash, and the certificate-trust step only supports macOS and Linux (under WSL2 it trusts the certificate inside Linux, so a Windows browser keeps warning until you import Caddy's CA into Windows yourself).
- **Node.js 22**, pinned in `.nvmrc` (`nvm install` picks it up). `dev:start` checks the version but never installs Node for you.
- **Docker** with Compose v2: Docker Desktop on macOS, Docker Engine + the compose plugin on Linux (on Linux, `dev:start` installs Docker if it is missing).
- **Memory**: the dev stack runs about 16 containers. As a rough guide, give Docker at least 8 GB of RAM; a 16 GB machine is comfortable.
- **Free ports**: 80 and 443 (Caddy), plus 27017 and 6379 on 127.0.0.1 (MongoDB and Redis, published for tests and local tools).
- **pnpm**, only to run the checks on your machine; see [Package managers](#package-managers).

### Package managers

This repo uses two package managers on purpose, each pinned via `packageManager`:

- **npm** at the root, for the backend Nx workspace (`backend/libs/*`, `backend/services/*`, `tools/*`). `npm run dev:start` runs `npm install` for you.
- **pnpm** inside `frontend/public-page`, which is a standalone Next.js app excluded from the npm workspaces.

The dev stack installs the frontend's dependencies inside its own container, so you don't need pnpm just to run the app. You do need them on your machine for `npm run lint`, `typecheck`, `test` and `build`, because those run Nx targets for every project, the frontend included (CI does the same):

```bash
corepack enable                         # provides the pnpm version pinned by the frontend
pnpm -C frontend/public-page install
```

### Start the local dev stack

```bash
npm run dev:start
```

`dev:start` checks Node and Docker, installs git hooks and the root dependencies, creates the `.env` files from their `.example` templates (plus the dev-only Prometheus `internal-api-key`), and brings up the whole stack with Docker Compose. It then prints the local URLs and follows service-1's logs; Ctrl+C stops following, and the stack keeps running.

The **first start takes several minutes**: each backend container runs `npm install` and an Nx build before it starts, and the frontend container installs its own dependencies. Until a service is ready, Caddy answers 502 for it; watch progress with `npm run dev:logs`.

Everything is served by Caddy over local HTTPS on `localhost`, so there is no domain to configure in dev (`infra/env/` is for production only). `dev:start` adds Caddy's local CA to your system trust store, which asks for your sudo password once; restart the browser afterwards. If that step was skipped or failed, run `npm run dev:trust-cert`.

### Local URLs and logins

| What                            | URL                                                                                               | Login                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| App                             | https://localhost                                                                                 | `admin@example.com` / `Admin123!!??` (the seeded admin, see below), or register   |
| service-1 API (auth, users)     | https://localhost/svc1/api/v1                                                                     | The auth cookies set when you sign in                                             |
| service-2 API (tasks)           | https://localhost/svc2/api/v1                                                                     | Same cookies                                                                      |
| Swagger UI                      | https://localhost/svc1/docs, https://localhost/svc2/docs                                          | None                                                                              |
| Grafana (metrics, logs, traces) | https://grafana.localhost                                                                         | `admin` / `admin`                                                                 |
| Mongo Express                   | https://mongo.localhost                                                                           | `admin` / `admin` (override with `MONGO_EXPRESS_USER` / `MONGO_EXPRESS_PASSWORD`) |
| Portainer                       | https://portainer.localhost                                                                       | Create the admin account on first visit (within a few minutes of startup)         |
| MongoDB (for Compass or tests)  | `mongodb://admin:password@localhost:27017/?replicaSet=rs0&directConnection=true&authSource=admin` | `admin` / `password`                                                              |

- **Seeded admin.** On an empty database, service-1 creates a verified admin from `DEFAULT_USER_EMAIL` and `DEFAULT_USER_PASSWORD` in `backend/services/service-1/.env`. The values above are the dev defaults from `.env.example`; change them there.
- **Emails in dev.** `SMTP_HOST` is empty by default, so service-1 sends nothing: it prints the emails it would send (welcome and password-reset emails, links included) to its logs. Read them with `docker compose -f infra/compose/docker-compose.dev.yml logs -f service-1`. Fill in the `SMTP_*` variables to send real mail.
- **Swagger** is on in dev and off in production unless you set `SWAGGER_ENABLED=true`. It relies on `PROXY_BASE_PATH` (`/svc1`, `/svc2`) in each service's `.env`; if your `.env` was created before that variable existed, add it.

Useful dev scripts:

| Command                   | Description                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev:start`       | Check prerequisites, install git hooks, create `.env` files, and start all services                 |
| `npm run dev:down`        | Stop the dev stack (data volumes are kept)                                                          |
| `npm run dev:restart`     | Recreate one or more containers so they re-read their `.env` (e.g. `npm run dev:restart service-1`) |
| `npm run dev:restart:all` | Full down + up of the whole stack (data volumes are kept)                                           |
| `npm run dev:logs`        | Tail logs from all services                                                                         |
| `npm run dev:trust-cert`  | Trust Caddy's local CA certificate                                                                  |

To wipe local data (MongoDB, Redis, Kafka, metrics), run `docker compose -f infra/compose/docker-compose.dev.yml down -v`, then `npm run dev:start`.

### Verify your changes

```bash
npm run typecheck     # TypeScript across every project, frontend included
npm run lint          # ESLint + Prettier, including the custom architectural rules
npm run test          # every project's test suite
```

These run Nx targets for every project, so install the frontend's dependencies first (see [Package managers](#package-managers)). `npm run test` also needs **MongoDB and Redis** on localhost, because the repository contract tests hit real datastores. Keep the dev stack up, or start just those two:

```bash
docker compose -f infra/compose/docker-compose.dev.yml up -d mongodb redis
```

CI also runs `npm run test:eslint-rules` (the custom rules' own tests) and `npm --prefix frontend/public-page run check:locales` (every locale file has the same keys), so run those before opening a PR. Other useful scripts: `npm run lint:fix`, `npm run test:watch`, `npm run test:nocache`, `npm run build`.

## Architecture

Each service is organized into **bounded contexts** under `src/bounded-contexts/`, each split into the four hexagonal layers:

```
src/bounded-contexts/<context>/
  domain/           # Entities, value objects, repository interfaces, domain events, domain services
  application/      # Command handlers, query handlers, domain-event handlers
  infrastructure/   # Repository implementations (mongo, in-memory…) and outbound adapters
  interfaces/       # REST controllers and inbound integration-event consumers
```

Key patterns:

- **Commands change state and queries read it**: both extend shared base classes from `@libs/nestjs-common`.
- **Entities are mutated only through behavior methods**: direct property assignment is blocked by lint.
- **Dependency inversion**: repository contracts are defined in `domain/` and bound to implementations in `infrastructure/` via NestJS injection tokens, so in-memory adapters can be swapped in for tests.

The [Architecture docs page](https://forgestack.fvjohnny.com/docs/architecture) shows the whole system as a diagram.

### Event flow (outbox → Kafka → inbox)

Bounded contexts never call each other directly. They communicate through integration events with delivery guarantees. This is what happens when a user registers:

```
[auth] UserRegistered (domain event) ─▶ UserCreated (integration event) ─▶ Outbox (same DB txn)
       ─▶ Kafka ─▶ Inbox (dedupe) ─▶ [notifications] in service-1 and [tasks] in service-2
```

1. The `User` aggregate in `auth` raises a **domain event**, `UserRegistered_DomainEvent`, which is handled inside `auth`.
2. That handler dispatches a command which writes `UserCreated_IntegrationEvent` (plus an email-verification event) to the **outbox** in one database transaction. A relay then publishes it to **Kafka**.
3. Each consumer receives it through its **inbox**, which records and deduplicates messages before running the handler: `notifications` (service-1) stores a minimal user projection, and `tasks` (service-2) stores its own copy of the user.

This gives **at-least-once delivery with inbox deduplication** (effectively-once processing) without distributed transactions. A handler can still run more than once (for example, when it fails partway and the inbox retries), so **integration-event handlers must be idempotent**.

## Example bounded contexts

The shipped contexts are a working reference for the patterns. Rename or replace them when you build your product (see [Make it yours](https://forgestack.fvjohnny.com/docs/guides/make-it-yours)).

**service-1**

- **`auth`**: registration, login, JWT issuance, email verification (off by default so new users can sign in right away; the comment in `User.create` shows the one-line switch to require it), password reset, Google sign-in, and admin user management. Publishes user-lifecycle integration events (`UserCreated`, `UserDeleted`, `EmailVerified`, …).
- **`notifications`**: consumes `auth` integration events and sends emails. Keeps a minimal local user projection rather than reaching into another context's data.
- **`shared`**: value objects reused across service-1's contexts (the one exception to the no-cross-imports rule).

**service-2**

- **`tasks`**: a per-user todo list (the dashboard's Tasks page). Consumes service-1's `UserCreated` and `UserDeleted` events to keep its own list of users: the worked example of events crossing services.

Add your own contexts by following the same four-layer layout; the ESLint rules will keep the boundaries honest.

### Scaffolding

The `@forgestack/tools` Nx generator scaffolds the two units of growth:

```bash
# A whole new service (wires compose, the Caddy route, env templates, and
# installs it into the workspace)
npx nx g @forgestack/tools:service billing

# A bounded context inside an existing service (module + starter command +
# controller, wired into the service's app.module.ts)
npx nx g @forgestack/tools:bounded-context billing --service=service-1

# ...with a named starter command
npx nx g @forgestack/tools:bounded-context billing --service=service-1 --command=charge-card
```

New services are served on the same origin under a path prefix: `service-<N>` at `/svc<N>` (e.g. `service-3` → `https://localhost/svc3/api/v1`), any other name at `/svc<name without dashes>` (`billing` → `/svcbilling`). The generator prints the exact URLs. Both generators print next steps and pass typecheck/lint out of the box. Flesh the context out with an aggregate, repository, queries, and events, using a shipped context such as `auth` (in service-1) as a worked reference. Full walkthrough: [Adding a Service](https://forgestack.fvjohnny.com/docs/guides/adding-a-service).

## Observability

The Docker Compose stack wires a complete observability pipeline:

- **Prometheus**: scrapes service metrics.
- **Grafana**: dashboards over Prometheus, Loki, and Tempo.
- **Loki** + **Promtail**: log aggregation and shipping.
- **Tempo**: distributed tracing (OpenTelemetry from the services).
- **cAdvisor**: per-container CPU and memory. It needs a Linux host, so the container dashboard stays empty on Docker Desktop for macOS.

Grafana is the one UI you open (https://grafana.localhost in dev, `https://grafana.<your-domain>` in production). Prometheus, Loki and Tempo are internal to the Docker network and are queried through Grafana. See [Monitoring](https://forgestack.fvjohnny.com/docs/monitoring).

## Deployment

Production runs the same services from pre-built images on one Linux server with Docker Compose (`infra/compose/docker-compose.prod.yml`), behind Caddy with automatic Let's Encrypt certificates. The full guide is the [Deployment docs page](https://forgestack.fvjohnny.com/docs/deployment) (in-repo: [`docs/deployment.md`](docs/deployment.md)).

You need a fresh Ubuntu server (as a rough guide, at least 4 GB of RAM; the setup adds 4 GB of swap, and 8 GB is comfortable), a domain, an account on a container registry (Docker Hub, GHCR, ECR, …), and an SSH key (`~/.ssh/id_ed25519.pub` by default). The first deploy, in order:

1. **Infra env file.** Copy each `infra/env/*.env.prod.example` to `*.env.prod` (gitignored), then fill in `infra.env.prod`: domain, registry, server IP, `SERVER_USER` (the deploy user step 2 creates, e.g. `deploy`), and the datastore, Grafana and Portainer credentials.
2. **Provision the server**: `npm run prod:setup` installs Docker, creates the deploy user with your SSH key, hardens SSH, and sets up the firewall, fail2ban, swap and a daily MongoDB backup. Then verify SSH with `ssh deploy@<server-ip> 'docker ps'`.
3. **Service and frontend env files.** Fill in each `service-*.env.prod` and `public-page.env.prod`, with the same Mongo and Redis passwords as `infra.env.prod`. Generate strong secrets (`openssl rand -base64 48`). `JWT_SECRET` and `JWT_REFRESH_SECRET` must be **identical in every service** (service-2 verifies the tokens service-1 issues), and every service must use **one shared, real `INTERNAL_API_KEY`**: `deploy.sh` checks this and configures Prometheus with it. A service refuses to boot in production with an example JWT secret.
4. **DNS.** Point A records for your domain, `www.`, `grafana.` and `portainer.` at the server. Caddy needs them resolving to issue the TLS certificates.
5. **Deploy**: `npm run prod:update -- 5` (Update ALL), so the proxy and monitoring images are built and pushed too. Commit the bumped image tags in `infra/compose/docker-compose.prod.yml` afterwards.
6. **First admin.** Either set `DEFAULT_USER_EMAIL` / `DEFAULT_USER_PASSWORD` in `service-1.env.prod` before the first deploy (an admin is seeded only into an empty database, and only when both are set), or register on the site and promote yourself in MongoDB ([how](docs/deployment.md#6-create-the-first-admin)).

Redeploys use the same interactive, menu-based script:

```bash
npm run prod:update          # interactive menu
npm run prod:update -- 2     # or pass the option number directly
```

It builds `linux/amd64` images, pushes them to `DOCKER_REGISTRY`, bumps the image version tags in the prod compose file, then syncs the compose and env files to the server and runs `docker compose up -d`. Menu options:

```
1) Update frontend
2) Update ALL apps (frontend + services)
3) Update Caddy (reverse proxy)
4) Update monitoring stack
5) Update ALL (apps + proxy + monitoring)
6) Deploy only (no builds, re-deploy current image versions)
0) Exit
```

To deploy a single backend service, type its name at the prompt (e.g. `service-1`) instead of a number.

## Custom ESLint rules

The rules in `eslint/rules/` are what keep the architecture from eroding. They run as part of `npm run lint`. The names below are the rule ids registered in `eslint.config.mjs`, so you can search for or override them directly:

- hexagonal-architecture (a `no-restricted-imports` config, not a single named rule): domain can't import application/infrastructure; application can't import infrastructure.
- `bounded-context/no-cross-imports`: bounded contexts may not import each other's internals.
- `entity-domain/no-direct-entity-mutation`: aggregates are changed only through behavior methods.
- `cqrs/no-direct-decorators`: use the provided `Base_*` handler classes, not raw NestJS CQRS decorators.
- `cqrs/handler-collocation` / `handler/naming`: commands, queries, and events live and are named consistently with their handlers.
- `value-object/naming`: `.vo.ts` files implement the value-object contract.
- `*/must-extend-base` rules (`aggregate/must-extend-base`, `aggregate-dto/must-extend-base`, `command-handler/must-extend-base`, `query-handler/must-extend-base`, `domain-event/must-extend-base`, `domain-event-handler/must-extend-base`, `integration-event/must-extend-base`, `repository/must-extend-base`): enforce extension of the shared base classes.

Each rule is explained on the [Enforced Boundaries](https://forgestack.fvjohnny.com/docs/backend/eslint-rules) docs page.

## Documentation

- **The docs site, [forgestack.fvjohnny.com/docs](https://forgestack.fvjohnny.com/docs)**, is the canonical and most complete reference: architecture, the backend patterns (DDD, CQRS, hexagonal, events, repositories, testing, ESLint rules), databases, the frontend, monitoring, deployment, and step-by-step guides ([Make it yours](https://forgestack.fvjohnny.com/docs/guides/make-it-yours), [Adding a Service](https://forgestack.fvjohnny.com/docs/guides/adding-a-service), [Login with Google](https://forgestack.fvjohnny.com/docs/guides/login-with-google)). Its source lives in `frontend/public-page/app/docs/`, and the dev stack serves it at https://localhost/docs.
- **The Markdown files in [`docs/`](docs/)** are short in-repo quick references for the same topics (architecture, code style, commands, frontend, infrastructure, deployment). Each one links to its page on the docs site; when the two disagree, the docs site wins.

## Contributing and support

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Ask questions in [GitHub Discussions](https://github.com/FVJohnny/forgestack/discussions), and report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
