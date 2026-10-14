# Backend Architecture

> Quick in-repo reference. The canonical pages are **[Architecture](https://forgestack.fvjohnny.com/docs/architecture)** and the **[Backend](https://forgestack.fvjohnny.com/docs/backend)** section on the docs site; when the two disagree, the docs site wins.

## Hexagonal + DDD + CQRS

Every service is organized into **bounded contexts** under `src/bounded-contexts/`, each split into four layers:

```
src/bounded-contexts/<context>/
  application/      # Command handlers, query handlers, domain-event handlers
  domain/           # Entities, value objects, repository interfaces, domain events, domain services
  infrastructure/   # Specific implementations of the repository interfaces (in-memory, mongo, redis...), external service adapters (adapters out)
  interfaces/       # REST controllers, integration-event consumers (adapters in)
```

The shipped contexts are a working demo of the pattern:

| Service     | Context         | What it does                                                                                                                                                        |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service-1` | `auth`          | Registration, login, JWT, email verification, password reset, admin user management. Publishes user-lifecycle integration events (`UserCreated`, `UserDeleted`, …). |
| `service-1` | `notifications` | Consumes `auth`'s integration events and sends emails, keeping a minimal local user projection.                                                                     |
| `service-1` | `shared`        | Value objects reused across service-1's contexts.                                                                                                                   |
| `service-2` | `tasks`         | A per-user todo list. Consumes service-1's `UserCreated` / `UserDeleted` events to keep its own users: the cross-service example.                                   |

Add your own contexts by following the same four-layer layout, or scaffold one with `npx nx g @forgestack/tools:bounded-context <name> --service=<service>`.

## Key patterns

- Commands mutate state; queries read state. Both are handled by dedicated classes extending base classes from `@libs/nestjs-common`.
- Domain entities are mutated **only through behavior methods**, never by direct property assignment. The custom ESLint rule `entity-domain/no-direct-entity-mutation` enforces this.
- An aggregate raises **domain events** (e.g. `UserRegistered_DomainEvent`) that are handled inside its own context. Other contexts and services only see **integration events** (e.g. `UserCreated_IntegrationEvent`).
- Integration events leave through the **outbox** (written in the same transaction as the state change, then relayed to Kafka) and arrive through the **inbox** (recorded and deduplicated before the handler runs). Delivery is at-least-once with deduplication, so integration-event handlers must be idempotent.
- Repository contracts are defined in `domain/` and implemented in `infrastructure/`.
- Dependency injection uses NestJS tokens so implementations are swappable (e.g., in-memory repos for tests).
- Handlers and controllers are discovered at runtime by file suffix (`*.command-handler.ts`, `*.query-handler.ts`, `*.domain-event-handler.ts`, `*.integration-event-handler.ts`, `*.controller.ts`), so the naming in [`code-style.md`](code-style.md) is load-bearing.

## ESLint architectural enforcement

Run `npm run lint` to catch violations. The names below are the rule ids as registered in `eslint.config.mjs`; each is explained on the [Enforced Boundaries](https://forgestack.fvjohnny.com/docs/backend/eslint-rules) page.

- hexagonal-architecture (a `no-restricted-imports` config, not a single named rule): domain cannot import application/infrastructure; application cannot import infrastructure
- `entity-domain/no-direct-entity-mutation`: aggregates must be mutated via behavior methods, not direct property assignment
- `cqrs/no-direct-decorators`: use `Base_*` handler classes instead of raw NestJS CQRS decorators
- `cqrs/handler-collocation`: commands/queries/events must be imported from the same directory as their handlers
- `handler/naming`: handler classes end in `_CommandHandler`, `_QueryHandler`, `_DomainEventHandler` or `_IntegrationEventHandler`, matching their file suffix
- `bounded-context/no-cross-imports`: bounded contexts may not import each other's internals
- `value-object/naming`: `.vo.ts` files must implement `IValueObject` and vice versa
- `aggregate/must-extend-base`, `aggregate-dto/must-extend-base`, `command-handler/must-extend-base`, `query-handler/must-extend-base`, `domain-event-handler/must-extend-base`, `domain-event/must-extend-base`, `integration-event/must-extend-base`, `repository/must-extend-base`: enforce base class extension

## TypeScript Path Aliases

Defined in `tsconfig.base.json`:

- `@libs/nestjs-common` → `backend/libs/common/src`
- `@libs/nestjs-kafka` → `backend/libs/kafka/src`
- `@libs/nestjs-mongodb` → `backend/libs/mongodb/src`
- `@libs/nestjs-redis` → `backend/libs/redis/src`
- `@bc/*` → `<service>/src/bounded-contexts/*` (per service: the base config uses TypeScript's `${configDir}`, so each service resolves the alias against its own source tree)

Use the `@libs/*` aliases when importing from the shared libs, and `@bc/*` for absolute imports within a bounded context (or from the `shared` context). Importing across bounded contexts is forbidden by the `bounded-context/no-cross-imports` lint rule, with `shared` as the only exception. Use relative imports only within the same module/folder.

## Testing Approach

- Unit specs live beside implementation files (`*.spec.ts`).
- Repositories, converters and services are tested with shared **contract tests** (`backend/libs/common/src/test-exports`), reused across the in-memory, MongoDB and Redis adapters. The MongoDB and Redis variants run against real datastores, so `npm run test` needs both running on localhost (the dev stack, or `docker compose -f infra/compose/docker-compose.dev.yml up -d mongodb redis`).

More on the [Testing](https://forgestack.fvjohnny.com/docs/backend/testing) page.
