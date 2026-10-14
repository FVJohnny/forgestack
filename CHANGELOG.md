# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-14

First tagged release of the ForgeStack template: a NestJS microservices starter
with hexagonal architecture, DDD, CQRS, a transactional outbox/inbox over Kafka,
a Next.js frontend, full observability (Prometheus, Grafana, Loki, Tempo),
TLS-terminated Docker Compose deploys, and custom ESLint rules that enforce the
architectural boundaries. It follows several audit passes of hardening across
the stack (the item-by-item record is in the git history). The notable changes
since the first public commit:

### Security

- Auth moved to httpOnly cookies with a CSRF defense (`SameSite` plus an
  Origin/Sec-Fetch-Site check); removed admin-impersonation token storage.
- Added a global auth guard so endpoints are protected by default, with an
  explicit `@PublicApi()` opt-out. Generated services get the guard fully wired.
- Production refuses to boot with weak or example JWT secrets (too short, the
  `change-in-production` marker in any case, or any value shipped in this repo).
- Restricted the production CSP `connect-src` to the configured API origins and
  gated `unsafe-eval` to dev only; the app now owns its framing and HSTS headers.
- Pinned the JWT signing algorithm (HS256) on sign and verify.
- Fixed per-user rate limiting that had silently fallen back to per-IP.

### Fixed

- Poison Kafka messages no longer wedge a partition forever (skip-and-log with
  a commit instead of infinite redelivery).
- Mongo inbox stuck-event reclaim is now race-safe and cannot resurrect a
  completed event.
- Deleting a user removes it and writes the `UserDeleted` integration event in
  one transaction, and registration publishes its domain events only after the
  user is committed, so downstream projections are never orphaned or phantom.
- The frontend refreshes the session through the auth service for every API
  client, so the tasks page no longer logs users out when the access token
  expires.
- `JwtAuthGuard` no longer turns infrastructure outages into 401s.
- The outbox no longer dead-letters an event with a false "max retries" after a
  transient post-publish save failure.
- HTTP error responses are now recorded with their real status code in metrics.
- Prod Mongo connection URIs include credentials; the prod healthcheck gates on
  readiness, not liveness.
- Swagger's "Try it out" works behind the `/svcN` path prefix (`PROXY_BASE_PATH`).

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
  dev. The service generator maps `service-N` to `/svcN` and any other name to
  `/svc<name>`, and prints the resulting URLs.
- `deploy.sh` logs in to whatever registry `DOCKER_REGISTRY` points at (Docker
  Hub, GHCR, ECR, ...), and configures Prometheus' production scrape key from
  the services' shared `INTERNAL_API_KEY` (it refuses to deploy placeholder or
  mismatched keys).
- Dev now uses the project's Loki config (retention/compactor), matching prod.
- CI validates the deploy path: compose config, shell syntax, and the
  Prometheus/Loki/Tempo/Promtail/Caddy configs.
- The README and docs were reworked for first-time users: quick start, local
  URLs and logins, a glossary, and one ordered first-deploy checklist.

### Added

- Tests for the Google OAuth flow, the frontend API/auth layer, all custom
  ESLint rules, the production secret checks, and repository contract tests
  for the tasks context (in-memory and MongoDB).

### Upgrading from a pre-1.0 checkout

- Services moved to `/svc1` and `/svc2`: update `NEXT_PUBLIC_API_URL` and
  `NEXT_PUBLIC_SERVICE2_API_URL` (re-copy `frontend/public-page/.env.local` from
  its example in dev), set the new `NEXT_PUBLIC_SITE_URL` in prod, and drop the
  `service1.` / `service2.` DNS records.
- Add `PROXY_BASE_PATH=/svc1` (or `/svc2`) to each service's `.env` and prod env
  file.
- Every service's prod env file must share the same real `INTERNAL_API_KEY`
  (`deploy.sh` checks it) and the same JWT secrets (each service refuses
  placeholder secrets at startup).
- The tasks context builds its user projection from `UserCreated` events, so
  accounts created before it existed need a one-off copy from service-1's
  `auth_users` into service-2's `tasks_users`.

[Unreleased]: https://github.com/FVJohnny/forgestack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/FVJohnny/forgestack/releases/tag/v1.0.0
