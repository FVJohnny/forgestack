# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Several audit passes of hardening across the stack (the full item-by-item record
is in the git history). The notable user-facing changes:

### Security

- Auth moved to httpOnly cookies with a CSRF defense (`SameSite` plus an
  Origin/Sec-Fetch-Site check); removed admin-impersonation token storage.
- Added a global auth guard so endpoints are protected by default, with an
  explicit `@PublicApi()` opt-out.
- Restricted the production CSP `connect-src` to the configured API origins and
  gated `unsafe-eval` to dev only; the app now owns its framing and HSTS headers.
- Pinned the JWT signing algorithm (HS256) on sign and verify.
- Fixed per-user rate limiting that had silently fallen back to per-IP.

### Fixed

- Poison Kafka messages no longer wedge a partition forever (skip-and-log with
  a commit instead of infinite redelivery).
- Mongo inbox stuck-event reclaim is now race-safe and cannot resurrect a
  completed event.
- `JwtAuthGuard` no longer turns infrastructure outages into 401s.
- Corrected the inbox event tracker double-counting a failed event, and the
  outbox false "max retries" dead-letter on a transient post-publish save.
- HTTP error responses are now recorded with their real status code in metrics.
- Prod Mongo connection URIs include credentials; the prod healthcheck gates on
  readiness, not liveness.

### Changed

- The signed-in frontend is now a simple user-facing app (home with sign-in
  activity, a tasks list, account, and admin) instead of a developer console;
  operational stats moved to Grafana. Service-2's example bounded context is
  now `tasks` (a per-user todo list that consumes the auth user events); the
  analytics context, the dashboard stats endpoints, and the in-memory event
  tracker were removed.
- Every service is served under a path prefix on the frontend's origin
  (`/svc1`, `/svc2`) instead of a subdomain, so the auth cookies are
  first-party (`SameSite=Lax`, no `COOKIE_DOMAIN`) and browser login works in
  dev.
- Dev now uses the project's Loki config (retention/compactor), matching prod.
- CI validates the deploy path: compose config, shell syntax, and the
  Prometheus/Loki/Tempo/Promtail/Caddy configs.

### Added

- Tests for the Google OAuth flow, the frontend API/auth layer, and all custom
  ESLint rules.

## [1.0.0]

Initial public version of the ForgeStack template: a NestJS microservices
starter with hexagonal architecture, DDD, CQRS, a transactional outbox/inbox
over Kafka, a Next.js frontend, full observability (Prometheus, Grafana, Loki,
Tempo), TLS-terminated Docker Compose deploys, and custom ESLint rules that
enforce the architectural boundaries.
