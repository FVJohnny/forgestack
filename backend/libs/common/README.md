# @libs/nestjs-common

Shared building blocks for the services in this monorepo. The package mixes two
kinds of code, and it is worth knowing which is which before you adopt the
template for your own product.

## Framework vs example

Most of this library is **framework**: generic, reusable infrastructure with no
knowledge of any particular product. A smaller part is **example/product**
code: concrete event contracts and the demo's token model that make the
`auth` → `notifications` and `auth` → `tasks` flows work end to end. When you
build your own app you keep the framework and replace the example code.

### Framework (keep)

Reusable infrastructure, safe to depend on as-is:

- `bootstrap` — app bootstrap helpers (`configureApp`, shutdown hooks)
- `cqrs` — command/query/event base classes and buses
- `inbox`, `outbox` — the transactional inbox/outbox pattern
- `transactions` — the `Transaction` unit-of-work abstraction
- `integration-events/` (the base + listener + publisher, **not** the concrete
  events under `events/*.integration-event.ts` — see below)
- `auth/` **request-security infrastructure** (everything exported at the top
  of `auth/index.ts`): the global `JwtAuthGuard` with the `@Public()`
  decorator (and `@PublicApi()` from `swagger`), the CSRF middleware that `configureApp` installs, the auth-cookie
  helpers, `JwtTokenService`, `InternalApiKeyGuard` (protects `/metrics` and
  `/health` for Prometheus) and `AdminRoleGuard`. Every service relies on
  these; do not delete them when you replace the demo's auth model.
- `errors`, `logger`, `metrics`, `tracing` — cross-cutting concerns
- `heartbeat`, `security`, `swagger`, `general`, `utils`, `testing`,
  `test-exports`

### Example / product (replace)

Concrete to the demo app. Rename, gut, or delete these for your own product:

- `auth/domain`, `auth/application`, `auth/testing` — the demo's user-token
  model (`UserToken` aggregate, `StoreTokens` / `RevokeToken` commands,
  `GetUserTokenByToken` query, in-memory repository). It records issued tokens
  so logout and revocation work, and the framework `JwtAuthGuard` queries it
  (`GetUserTokenByToken_Query`) to reject revoked tokens. Replace it with your
  own token or session model, but if you remove it, update `jwt-auth.guard.ts`
  and the `GetUserTokenByToken_QueryHandler` / `USER_TOKEN_REPOSITORY`
  registrations in the services' modules at the same time.
- `integration-events/events/*.integration-event.ts` — the concrete
  `UserCreated`, `UserDeleted`, `EmailVerified`, `PasswordReset*`, etc.
  events. These are the demo's contracts, not framework types.
- `integration-events/events/topics.ts` — the app-specific Kafka topic/event
  name registry. Define your own topics here.

The concrete event files, `topics.ts` and the `auth/index.ts` barrel carry a
short header comment marking which part is which, so this split is visible in
the code too.
