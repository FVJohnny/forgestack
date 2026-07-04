# Service-1 Architecture

## Hexagonal + DDD + CQRS

Service-1 is organized into **bounded contexts** under `src/bounded-contexts/`:

```
src/bounded-contexts/<context>/
  application/      # Command handlers, query handlers, domain-event handlers
  domain/           # Entities, value objects, repository interfaces, domain events, domain services
  infrastructure/   # Specific implementations of the repository interfaces (in-memory, mongo, redis...), external service adapters (adapters out)
  interfaces/       # REST controllers, integration-event consumers (adapters in)
```

**Bounded contexts:** `auth`, `notifications`, `shared`

The shipped contexts are a working demo of the pattern: `auth` publishes user-lifecycle integration events (e.g. `UserCreated`), and `notifications` consumes them to send emails. `shared` holds value objects reused across contexts. Add your own contexts by following the same four-layer layout.

## Key patterns

- Commands mutate state; queries read state — both are handled by dedicated classes extending base classes from `@libs/nestjs-common`
- Domain entities are mutated **only through behavior methods**, never by direct property assignment — the custom ESLint rule `no-direct-entity-mutation` enforces this
- Integration events flow out with the **Outbox pattern** for delivery guarantees.
- Repository contracts are defined in `domain/` and implemented in `infrastructure/`
- Dependency injection uses NestJS tokens so implementations are swappable (e.g., in-memory repos for tests)

## ESLint architectural enforcement

Run `npm run lint` to catch violations:

- `hexagonal-architecture` — domain cannot import application/infrastructure; application cannot import infrastructure
- `no-direct-entity-mutation` — aggregates must be mutated via behavior methods, not direct property assignment
- `no-direct-cqrs-decorators` — use `Base_*` handler classes instead of raw NestJS CQRS decorators
- `cqrs-handler-collocation` — commands/queries/events must be imported from the same directory as their handlers
- `value-object-naming` — `.vo.ts` files must implement `IValueObject` and vice versa
- `aggregate-base`, `aggregate-dto-base`, `command-handler-base`, `query-handler-base`, `domain-event-handler-base`, `domain-event-base`, `repository-base` — enforce base class extension

## TypeScript Path Aliases

Defined in `tsconfig.base.json`:

- `@libs/nestjs-common` → `backend/libs/common/src`
- `@libs/nestjs-kafka` → `backend/libs/kafka/src`
- `@libs/nestjs-mongodb` → `backend/libs/mongodb/src`
- `@libs/nestjs-redis` → `backend/libs/redis/src`
- `@bc/*` → `backend/services/service-1/src/bounded-contexts/*`

Always prefer these aliases over relative imports when importing across bounded contexts or from libs. Use relative imports only within the same module/folder.

## Testing Approach

- Unit specs live beside implementation files (`*.spec.ts`)
- Repositories, converters and services are tested with shared **contract tests** (`backend/libs/common/src/test-exports`), reused across the in-memory, MongoDB and Redis adapters
