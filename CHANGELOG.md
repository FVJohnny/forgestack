# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Three audit passes of hardening across the stack. The full item-by-item record
is in `IMPROVEMENTS.md`, `IMPROVEMENTS-PHASE2.md`, and `IMPROVEMENTS-PHASE3.md`;
the notable user-facing changes:

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
