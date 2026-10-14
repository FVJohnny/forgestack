# @libs/nestjs-common

Shared building blocks for the services in this monorepo. The package mixes two
kinds of code, and it is worth knowing which is which before you adopt the
template for your own product.

## Framework vs example

Most of this library is **framework**: generic, reusable infrastructure with no
knowledge of any particular product. A smaller part is **example/product**
code: concrete auth and event types that exist to make the demo `auth` →
`notifications` flow work end to end. When you build your own app you keep the
framework and replace the example code.

### Framework (keep)

Reusable infrastructure, safe to depend on as-is:

- `bootstrap` — app bootstrap helpers (`configureApp`, shutdown hooks)
- `cqrs` — command/query/event base classes and buses
- `inbox`, `outbox` — the transactional inbox/outbox pattern
- `transactions` — the `Transaction` unit-of-work abstraction
- `integration-events/` (the base + listener + decorator, **not** the concrete
  events under `events/*.integration-event.ts` — see below)
- `errors`, `logger`, `metrics`, `tracing` — cross-cutting concerns
- `heartbeat`, `security`, `swagger`, `general`, `utils`, `testing`

### Example / product (replace)

Concrete to the demo app. Rename, gut, or delete these for your own product:

- `auth/` — the shared user-token auth context (JWT/token domain used by the
  demo). Your app's auth model goes here instead.
- `integration-events/events/*.integration-event.ts` — the concrete
  `UserCreated`, `EmailVerified`, `PasswordReset*`, etc. events. These are the
  demo's contracts, not framework types.
- `integration-events/events/topics.ts` — the app-specific Kafka topic/event
  name registry. Define your own topics here.

The files listed under "example" carry a short header comment marking them as
such, so this split is visible in the code too.
