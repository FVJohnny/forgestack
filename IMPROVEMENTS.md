# Improvement backlog

This file tracks the findings of a full repo audit (2026-07-04). We work through it item by item, one commit per item.

How to read an item:

- The checkbox shows whether the item is resolved.
- The tag after the title is severity: (High), (Medium), or (Low).
- The indented text describes the problem and the suggested fix.
- Items that have been worked on end with a **Status** line saying what was actually done, how it was verified, and any leftover caveats.

## Progress

| Section | Items | Done | Open |
|---|---|---|---|
| A. Security | 26 | 22 done, 1 partial | 8, 25, 26 |
| B. Backend reliability (outbox/inbox/Kafka) | 19 | 0 | all |
| C. Backend code quality | 15 | 0 | all |
| D. Backend testing | 2 | 0 | all |
| E. Frontend | 15 | 0 | all |
| F. Infra and deployment | 15 | 0 | all |
| G. Tooling, lint, DX | 18 | 0 | all |
| H. Docs, identity, positioning | 8 | 0 | all |

Item 5 needs manual secret rotation by the maintainer. Item 8 is intentionally saved for last because it is the largest change and needs the running dev stack to verify.

## A. Security

- [x] **1. Account takeover via email-verification lookup** (High)
  The `get-email-verification-by-user-id` endpoint had no auth guard and returned the verification id for any email. The verify flow then mints login tokens for whoever holds that id, so knowing a victim's email was enough to take over a fresh account.
  **Status: Done.** Deleted the endpoint. Nothing external used it: the frontend only calls `/email-verification/verify`, and the bootstrap service uses the query through the in-process query bus, which still works. Token minting stays safe because `EmailVerification.verify()` throws on expired or already-verified, so the verify endpoint is one-shot. Verified with typecheck and the service-1 test suite.

- [x] **2. Password-reset token leak** (High)
  The `get-password-reset-by-email` endpoint was unguarded and returned the reset token for any email, enabling account hijack through `password-reset/execute`.
  **Status: Done.** Deleted the endpoint and the whole backing query (handler, query, response, spec). Nothing else consumed it. Reset tokens are now only ever delivered by email. Verified with typecheck and the service-1 test suite.

- [x] **3. Google OAuth token audience not validated** (High)
  `google-oauth.service.ts` accepted any Google access token without checking who the token was issued for, so a token minted for a different Google app could log in as that email (token substitution).
  **Status: Done.** The service now calls Google's `tokeninfo` endpoint first and rejects tokens whose `aud`/`azp` does not match `GOOGLE_CLIENT_ID`. No new dependencies and the current frontend flow keeps working. The full switch to ID-token verification is coupled to item 66, still open.

- [x] **4. `authorize()` return value ignored in CQRS base handlers** (High)
  Both base handlers awaited `authorize()` but never checked the boolean, so a handler returning `false` still executed.
  **Status: Done.** Both handlers now throw the lib's `ForbiddenException` (403) when `authorize()` returns false. No existing handler returned false, so nothing changes for current code. JSDoc documents the contract. Verified with the full test run.

- [ ] **5. Rotate the live secrets in the working tree** (High)
  The untracked files `infra/env/*.env.prod`, `.env`, `.env.local`, and `infra/monitoring/prometheus/internal-api-key` hold a real Docker Hub PAT, DB passwords, JWT secrets, a Google client id, and a plaintext basic-auth password in a comment.
  **Status: Partial, remainder is a manual task.** Verified the repo itself is clean: every tracked `.example` file holds placeholders only, and git history never included a real secret (the audit's claim about a real client id in `.env.example` was wrong). The real files were left untouched so deploys keep working. Still to do by the maintainer: rotate the Docker Hub PAT, Mongo/Redis/Grafana passwords, JWT secrets, internal API key, Google client secret, and SMTP password, update the local env files, and delete the plaintext basic-auth password comment from `infra/env/infra.env.prod` after storing it in a password manager. Rotation matters extra because previously pushed images contain the old internal API key (see item 6).

- [x] **6. Internal API key baked into the Prometheus image** (High)
  `Dockerfile.prometheus` copied the real key into an image that gets pushed to Docker Hub, where it is world-readable if the repo is public.
  **Status: Done.** The Dockerfile now copies only `prometheus.yml`. The prod compose mounts the key read-only at runtime (same as dev), and `deploy.sh` stages the key file to the server with a fail-fast check if it is missing. Verified by building the image and listing its contents. Old pushed images still contain the old key, which is one more reason to rotate it (item 5).

- [x] **7. Portainer exposed publicly in prod with root-equivalent Docker socket access** (High)
  Portainer was reverse-proxied at `portainer.<domain>` with no auth, so the first visitor after a fresh deploy could claim its admin account.
  **Status: Done (gated, not removed).** The previously dead `CADDY_BASIC_AUTH_HASH` is now wired to the Portainer site through `admin-auth-<TLS_ENV>` snippets: prod requires basic auth and Caddy refuses to start without the hash, dev stays open on localhost. Added `CADDY_BASIC_AUTH_USER` and clearer guidance to the env example. Validated with `caddy validate` in dev mode, prod mode with a hash, and prod mode without one. Takes effect after the next caddy image build and deploy. This also resolves most of item 91.

- [ ] **8. Frontend stores access, refresh, and admin-impersonation tokens in localStorage** (High)
  Any XSS can exfiltrate full sessions, including admin credentials saved during impersonation. Fix: move refresh tokens to httpOnly cookies (or at minimum keep them in memory and document the tradeoff).
  **Status: Open, saved for last on purpose.** The real fix is a cookie/BFF rework that touches auth flows across both frontend and backend (login, Google, verify-email, refresh, logout, impersonation), and it should be verified against the running dev stack in one go.

- [x] **9. Refresh tokens never rotated or revoked on use** (Medium)
  A leaked refresh token stayed valid until natural expiry.
  **Status: Done.** A new `RevokeToken` command in `libs/common` revokes the presented refresh token before the new pair is stored, so refresh tokens are single-use. The Redis user-token repository's `remove()` now also cleans its lookup index and per-user set, which the base remove left orphaned. Known tradeoff: two browser tabs racing to refresh with the same token can log one out; the frontend already dedups concurrent refreshes per tab. Covered by a new spec.

- [x] **10. Duplicate password-reset controllers, one pair unvalidated** (Medium)
  Password reset was exposed on two routes: `auth/*` and `password-reset/*`.
  **Status: Done, with two corrections to the audit.** First, the frontend calls the `auth/*` routes, not `password-reset/*`, so the fix was the inverse of the suggestion: the validated DTO classes moved onto the `auth/*` controllers and the unused `password-reset/*` duplicates were deleted. Second, interface-typed bodies are not "stripped to empty": ValidationPipe skips them entirely, so the routes worked but accepted any shape. Both routes now validate (`@IsEmail`, `@IsString`, `@MinLength(8)`).

- [x] **11. Change-password body had no validation DTO** (Medium)
  The body was a plain interface, which ValidationPipe skips, so the endpoint accepted any shape.
  **Status: Done.** Added `ChangePassword_ControllerParams` with `@IsString @IsNotEmpty` on the old password and `@IsString @MinLength(8)` on the new one.

- [x] **12. Weak and inconsistent password policy** (Medium)
  The backend only checked length >= 8 while the three frontend forms enforced 6, 8, and nothing.
  **Status: Done.** One policy everywhere: at least 8 characters with a letter and a number, at most 72 bytes (bcrypt silently truncates longer input). The backend `Password` value object enforces it with new spec cases, and the register, change-password, and reset-password forms share one client-side validator. Error messages were updated in all 8 locales. Existing users still log in because login verifies via bcrypt compare, not the creation-time policy.

- [x] **13. Login and register accepted any string as email** (Medium)
  **Status: Done.** Both params classes now use `@IsEmail()`, so malformed emails get a clean 400 at the API boundary instead of a domain validation error later.

- [x] **14. `Base_RedisRepository.clear()` deleted every key in the Redis database** (Medium)
  It ran `KEYS *` plus `DEL`, wiping other repositories, sessions, and rate limits, and `KEYS` itself blocks Redis.
  **Status: Done.** `clear()` now deletes only keys matching the repository's own `itemKey('*')` pattern, iterating with SCAN in batches. Added a protected `deleteByPattern` helper, and the user-token repository also clears its secondary indexes. Verified against a real Redis in the lib test suite.

- [x] **15. Mongo health endpoint returned the connection string and never pinged** (Medium)
  `/mongodb/health` echoed the URI (which can contain credentials) and reported healthy without touching the database.
  **Status: Done.** It now runs `db.admin().ping()`, returns 503 on failure, and exposes only the database name and process uptime. The route was already behind the internal API key guard, which limited the exposure.

- [x] **16. Regex injection in the Mongo criteria converter** (Medium)
  CONTAINS filters passed raw user input into `$regex`, enabling regex injection and ReDoS through API-driven filters.
  **Status: Done.** Values are escaped so CONTAINS matches literal substrings, matching the in-memory converter's `String.includes` semantics. A shared contract test (".*" must match nothing) now runs against the in-memory, Mongo, and Redis converters.

- [x] **17. Rate limiting was per-instance and per-user mode silently degraded to per-IP** (Medium)
  Counters lived in process memory (wrong for multiple instances), and because the throttler runs as an APP_GUARD before route guards set `request.tokenData`, every `type: 'user'` limit (used by all the preset decorators) actually keyed by IP.
  **Status: Done, both parts.** A new `ThrottlerStorageRedis` in `@libs/nestjs-redis` (atomic Lua script, mirrors the built-in storage semantics) is wired into both services through a new storage option on `ApiRateLimitModule.forRoot`; in-memory remains the default for anyone not using Redis. The guard now verifies the bearer token itself to extract the user id when `tokenData` is not yet set. Covered by a storage spec against real Redis and a DI wiring spec.

- [x] **18. All infra secrets injected into the Caddy and Grafana containers** (Medium)
  Both containers received the whole `infra.env.prod`, including the Docker Hub PAT and database passwords they have no use for.
  **Status: Done.** Removed `env_file` from both. Caddy gets an explicit environment list (domain, protocol, TLS env, basic-auth user/hash) and Grafana keeps only its explicit GF_* list; both interpolate from `compose/.env`, which deploy.sh already writes. Validated with `docker compose config`.

- [x] **19. `.dockerignore` whitelisted `infra/env/**` into every build context** (Medium)
  One stray `COPY . .` would have baked the prod secrets into a pushed image.
  **Status: Done.** The whitelist now covers `infra/caddy/**`, `infra/monitoring/**`, and only `infra/env/public-page.env.prod(.example)`, the one file a Dockerfile actually copies (build-time NEXT_PUBLIC values). The real `internal-api-key` is excluded explicitly. Verified by building a probe image and listing the context.

- [x] **20. JWT secret handling was inconsistent** (Medium)
  The auth module fell back to a published dev secret while the token service required the env var. Worse, the module read the secret at import time, before `.env` loading, so bare local runs could verify tokens with a different secret than they were signed with.
  **Status: Done.** Both now use one `requiredEnv` helper (no fallback in any environment) and the JwtModule secret is resolved lazily via `registerAsync`, after ConfigModule loads `.env`. Dev `.env.example` and `jest.env.js` already set the secrets everywhere, so nothing breaks.

- [x] **21. No SSH hardening, and the deploy user had passwordless sudo ALL** (Medium)
  **Status: Done.** The deploy user gets no sudo at all (deploys only need the docker group and rsync into the deploy dir; re-running the script removes the legacy grant). SSH hardening lands after the deploy key is installed so it cannot lock you out: password auth off, root reachable by key only. fail2ban (sshd jail) and unattended security upgrades are installed and enabled. Also fixed the wrong "choose 7 = ALL" menu hint and added a warning that Docker published ports bypass UFW. Verified with `bash -n` and by confirming deploy.sh uses no sudo; not yet exercised against a live server, so watch the first re-provision run.

- [x] **22. API key comparison was not constant-time** (Low)
  **Status: Done.** The internal API key guard compares SHA-256 digests with `crypto.timingSafeEqual` (hashing first yields equal-length buffers without leaking key length).

- [x] **23. Frontend had no security headers or CSP** (Low)
  The only `headers()` rule targeted `.mp4` files that do not exist in the app.
  **Status: Done.** All routes now get a Content-Security-Policy, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, and HSTS. The CSP is pragmatic rather than nonce-strict (Next inline scripts, Google Sign-In, flagcdn images, and the cross-origin API in prod plus http://localhost in bare dev are allowed), with a comment telling forkers to tighten `connect-src`. Verified by serving the standalone build and curling the headers.

- [x] **24. `record-identity` trusted the client-supplied `X-Forwarded-For`** (Low)
  Clients could spoof the IP recorded by the identity/audit feature.
  **Status: Done.** `configureApp` sets Express `trust proxy` to `TRUSTED_PROXY_HOPS` (default 1, matching the single Caddy hop; with no proxy the socket address wins) and the controller uses `req.ip`. This also improves the throttler's per-IP keys, which use the same resolution.

- [ ] **25. Redis password visible in `docker inspect`; user tokens stored without TTL** (Low)
  The compose file interpolates the real Redis password into the container command and healthcheck, and stored user tokens are keyed by the raw JWT with no expiry, so they accumulate forever. Fix: use `REDISCLI_AUTH` for the healthcheck and a config file or secret for `requirepass`; set TTLs matching token expiry and consider hashing the token used as a key.

- [ ] **26. Dev Mongo/Redis published on all interfaces with default credentials** (Low)
  Fine on a laptop, risky on a shared or remote dev box; mongo-express also hardcodes admin/admin. Fix: bind dev port mappings to 127.0.0.1.

## B. Backend reliability (outbox, inbox, Kafka)

- [ ] **27. Inbox is in-memory only and cannot be swapped** (High)
  `InboxModule` hardcodes the in-memory repository, the Mongo inbox repository exists but is never wired, and Kafka offsets are committed after the in-memory save. A restart loses accepted-but-unprocessed events, which defeats the advertised inbox pattern. Fix: add `forRoot({ repository })` like the outbox has.

- [ ] **28. Poison outbox events retry forever** (High)
  Events that exhaust their retries sit in the PROCESSING state, and the 5-minute stuck-reclaim resets them endlessly. Fix: add a terminal FAILED / dead-letter state that both claim and reclaim respect.

- [ ] **29. Outbox retry-reset is clobbered by the following `save()`** (High)
  The service resets the claim in the database, then saves the in-memory event which still carries the PROCESSING marker, writing it right back. Retries therefore only ever happen via the 5-minute reclaim path. Fix: make the reset plus retry-count one atomic update.

- [ ] **30. `OutboxService.processEvent` drops its promise** (High)
  The traced call is neither awaited nor returned, so batch processing is not actually sequential, the `isProcessing` flag releases while publishes are in flight, and per-topic ordering is lost. One missing `return`.

- [ ] **31. No recovery path for PROCESSING or FAILED inbox events** (High)
  A crash between claim and completion strands events forever; FAILED events are never retried. Fix: add stuck-reclaim plus bounded retry, like the outbox side.

- [ ] **32. `CircuitBreakerInterceptor` replays the first request's handler** (High)
  The opossum breaker is cached with the first request's closure and fires that same closure for every later request. Fundamentally broken. Fix: pass the current handler as a fire argument (`new CircuitBreaker((fn) => fn())` pattern).

- [ ] **33. Inbox dedup is check-then-act, not atomic** (Medium)
  Two concurrent deliveries of the same message both pass the null check and can double-process. Fix: insert against the unique id index and treat duplicate-key as "already seen".

- [ ] **34. Events with no registered handler are marked FAILED permanently** (Medium)
  Any event on a subscribed topic that this service does not handle becomes permanent FAILED noise. Fix: skip or ack unknown events, like the non-inbox listener path already does.

- [ ] **35. Nothing ever calls the outbox/inbox cleanup methods** (Medium)
  `cleanupProcessedEvents` / `deleteProcessed` have no callers, so the collections grow unbounded. Fix: schedule cleanup inside the services.

- [ ] **36. Kafka consumer readiness is wrong** (Medium)
  Readiness flips true when `consumer.run()` resolves, which happens before partitions are assigned, and a failed `startConsumer` only logs and never retries. Fix: listen for GROUP_JOIN / CRASH events and add retry.

- [ ] **37. Kafka group id defaults to `default-group`** (Medium)
  Services with `KAFKA_SERVICE_ID` unset share one consumer group and steal each other's messages. Fix: fail fast on the missing env var. Also, a consumer is created and connected even for publish-only services.

- [ ] **38. Kafka SSL/SASL config conflates auth with tuning** (Medium)
  Connection timeouts and retry policy only apply when credentials are set; TLS-without-SASL is unsupported. Fix: split `KAFKA_SSL` from credentials and always apply the retry config.

- [ ] **39. Outbox claim does up to 100 sequential `findOneAndUpdate` calls every 100 ms** (Medium)
  Fix: batch-claim with a per-instance token, and make the interval and batch size configurable. The inbox's 10/500ms values are hardcoded too.

- [ ] **40. `outbox_queue_size` metric reports the claimed batch size, not the backlog** (Medium)
  Fix: report a real pending count or rename the metric. The inbox has the same issue.

- [ ] **41. Redis outbox index maintenance is non-atomic** (Medium)
  `save`, `resetClaimedEvent`, and `reclaimStuckEvents` run multiple commands without a Lua script, so a crash can leave the zset indexes inconsistent with item state. The claim path already uses Lua; do the same for reset and reclaim.

- [ ] **42. "Distributed transaction" is sequential best-effort, not two-phase commit** (Medium)
  Participants commit in a loop with no rollback of earlier commits. The Redis participant also ignores per-command errors in `exec()`, calls `quit()` on a pipeline, and reads bypass the pipeline so a transaction cannot read its own writes. Fix: document the real guarantee and fix the participant.

- [ ] **43. `handleEventFailure` is un-awaited in the inbox catch path** (Medium)
  A floating promise: if the failure-save rejects it becomes an unhandled rejection, and processing continues before the status is persisted. There is also a leftover commented-out `throw`.

- [ ] **44. Outbox uses magic sentinel dates for state** (Low)
  `new Date(0)` / `new Date(1)` encode NEVER / PROCESSING inside a timestamp while the inbox uses a proper status enum. Unify on the enum.

- [ ] **45. Small Kafka/inbox leftovers** (Low)
  `unsubscribeFromTopic` logs success but does nothing; the fallback message-id logic is dead and misleading; the inbox DTO has a `messageId` field that is never set.

## C. Backend code quality

- [ ] **46. `EntityExample` loses identity on rehydration** (Medium)
  The constructor drops `props.id` and timestamps, so `fromValue()` returns a different aggregate every time. This is the example everyone copies. Fix: pass them to `super()`.

- [ ] **47. The default "admin" bootstrap user is a regular user** (Medium)
  It cannot use any admin endpoint, contradicting its name and intent. Fix: assign the admin role during bootstrap.

- [ ] **48. `RuntimeAutoDiscovery` is fragile** (Medium)
  Runtime `require()` by naming convention, swallowed load errors, breaks under bundlers, and typos become silently missing handlers. Prefer explicit imports or Nest's `DiscoveryService`.

- [ ] **49. EventTracker monkey-patches the EventBus and duplicates metrics** (Medium)
  It overwrites `publish`/`publishAll` at construction, records success before handlers run, and overlaps entirely with the Prometheus CQRS metrics. Consider removing the subsystem.

- [ ] **50. HTTP duration histogram is double-counted** (Medium)
  The metrics interceptor records every request twice into `http_request_duration_seconds`. Drop one of the two observations.

- [ ] **51. OTel SIGTERM handler hijacks shutdown** (Medium)
  It calls `process.exit(0)`, racing Nest's shutdown hooks (Kafka/Mongo/Redis disconnect, outbox drain). Let Nest own the shutdown.

- [ ] **52. Product features live inside the shared framework lib** (Medium)
  The user-token auth context, app-specific Kafka topics, and example events sit in `libs/common`. Separate "framework" from "example app" or mark them clearly as examples.

- [ ] **53. `Data.parseFromString('')` returns 0** (Medium)
  Empty-string filter values are treated as the number 0 in Mongo EQUAL/IN conditions. Guard for empty and whitespace strings.

- [ ] **54. `@IntegrationEventHandler` constructs a random event to read metadata** (Medium)
  It instantiates `eventClass.random()` (running validation on random data) just to read topic and name. Make those static.

- [ ] **55. Mongo config typed as Mongoose options but passed to the native client** (Medium)
  `dbName` is silently ignored, and the mongoose peer dependencies exist only because of this. Use `MongoClientOptions` and drop the deps.

- [ ] **56. Fire-and-forget `RecordUserLogin` command** (Low)
  Login and Google OAuth controllers dispatch it without `await`, so failures vanish. Await it or make it an explicit background job with logging.

- [ ] **57. Value-object equality is shallow and fragile** (Low)
  `ValueObject.equals` uses reference equality plus `constructor.name` (breaks under minification), `DateVO` accepts Invalid Date, and `Id` validates twice.

- [ ] **58. Duplicated types and unsafe casts** (Low)
  Two parallel pagination type modules, `IdentityEntry` declared identically in three layers, and `as` casts in the impersonate controller.

- [ ] **59. `Password.random()` is predictable outside tests** (Low)
  It generates sequential `passwordN` values, used as placeholder passwords for Google-signup users. Use a cryptographically random value.

- [ ] **60. Small backend cleanups** (Low)
  - `initializeIndexes` swallows errors, so the unique id index may silently not exist.
  - `exists()` fetches the whole document instead of a count.
  - `NotFoundException` with no args prints "Entity undefined not found. undefined".
  - The error response is labeled `application/problem+json` but is not RFC 7807; `error.stack` is declared and never populated.
  - `console.*` is used instead of the structured logger in main.ts, the OTel bootstrap, and the discovery utils.
  - `RedisService` logs "will not be available" then throws anyway. Pick one behavior.
  - `RedisTestService` db selection `(pid + counter) % 16` can collide between Jest workers.

## D. Backend testing

- [ ] **61. No e2e or controller tests in service-1** (Medium)
  The auth flows (including everything section A fixed) have no HTTP-level tests, and there are no coverage thresholds. Add a few e2e tests for login/register/refresh/password-reset and set a coverage floor.

- [ ] **62. Zero tests exactly where the risk is** (Medium)
  No tests for the outbox/inbox processing loops, the Kafka listener/publisher, the guards, the exception filter, or the circuit breaker (which would have caught item 32). `kafka.spec.ts` is a placeholder asserting `true`.

## E. Frontend (website and dev console)

- [ ] **63. English landing hero subtitle is "Idk what to write here yet"** (High)
  All 7 other locales have real copy; only the default locale shows the placeholder. Write the English subtitle.

- [ ] **64. No refresh-and-retry on 401** (High)
  Any non-auth 401 clears tokens and hard-redirects to `/login`, even though a valid refresh token exists. The first access-token expiry mid-session kicks the user out. Fix: refresh and retry the request before logging out. (Related to item 8.)

- [ ] **65. `typescript.ignoreBuildErrors: true` in next.config** (High)
  Type errors are silently ignored during `next build`. `tsc --noEmit` currently passes, so just remove the flag and add a typecheck script.

- [ ] **66. Google sign-in sends an access token labeled `idToken`** (Medium)
  Switch to the credential flow (a real ID token with verifiable audience). Pairs with the backend fix in item 3, which already validates audience for the current access-token flow.

- [ ] **67. Two parallel auth service implementations** (Medium)
  `lib/contexts/auth-service.ts` and `lib/api/services/auth.service.ts` both implement register/login/verify/refresh/logout, and the former also duplicates the admin service. Consolidate into one service layer.

- [ ] **68. Dead code to delete** (Medium)
  `notifications.tsx` (~160 lines, zero imports), `login-background.tsx`, the shadcn leftover `styles/globals.css`, unused `logo.png`/`logo-dark.png`, the unused `IDENTITY.RECORD` endpoint, and unused message keys.

- [ ] **69. Dependencies pinned to `latest`** (Medium)
  Five `@radix-ui/*` packages and `sonner` float on `latest`, so fresh installs can pick up breaking majors. Pin real versions.

- [ ] **70. Docker build depends on a gitignored env file** (Medium)
  `Dockerfile` copies `infra/env/public-page.env.prod`, which only exists locally, so `docker build` fails on a fresh clone. Fall back to the `.example` file or use build args.

- [ ] **71. Zero frontend tests** (Medium)
  The landing page sells "Tests that run in seconds" and the app has none. Add Vitest plus Testing Library with a few examples (api client, auth service, one form).

- [ ] **72. `auth.resetPassword` missing from 6 of 8 locales** (Medium)
  Those locales silently fall back to English. Translate the section and add a CI check that locale key sets match.

- [ ] **73. Register / verify-email flow contradiction** (Medium)
  A comment says verification is disabled with auto-login, yet a full verify-email flow and "check your email" copy exist, plus a dead `?registered=true` handler. Pick one story or make it a documented toggle.

- [ ] **74. SEO essentials missing** (Medium)
  Per-page metadata, `not-found.tsx`, robots.txt, a sitemap, and Open Graph / Twitter cards.

- [ ] **75. `fmf.*` translation namespace is unexplained legacy naming** (Medium)
  Rename it to match the ForgeStack brand.

- [ ] **76. Language switcher rough edges** (Low)
  Flags load from flagcdn.com (external dependency), switching does a full page reload, blocked cookies can cause an infinite reload loop, flags-for-languages is an i18n anti-pattern, and the Accept-Language parsing is duplicated.

- [ ] **77. Small frontend cleanups** (Low)
  - `ngrok-skip-browser-warning` header sent on every API request.
  - The 401 redirect path returns `{} as T` to in-flight callers.
  - Hardcoded English in the error page and several aria-labels.
  - Accessibility gaps in the admin table and mobile drawers (no aria-labels, no focus trap, no Escape).
  - Register-then-auto-login failure shows "Registration failed" even though the account was created.
  - `window.location.href` used where the router would do.
  - `app/error.tsx` is named `GlobalError` but is a route boundary; there is no real `global-error.tsx`.
  - `components.json` aliases a nonexistent `hooks` directory.
  - The frontend `lint` script only runs prettier.

## F. Infra and deployment

- [ ] **78. `wait || exit` never detects failed parallel builds in deploy.sh** (High)
  Bare `wait` always returns 0, so a failed image build silently proceeds to deploy. Fix: collect PIDs and check each, or use `wait -n` in a loop.

- [ ] **79. Version bump happens before the build** (High)
  A failed build leaves the compose file pointing at a tag that was never pushed. Bump after a successful push, or tag by git SHA.

- [ ] **80. No log rotation in prod** (High)
  The prod compose has no `logging:` options and the server has no daemon defaults, so a chatty service eventually fills the disk. Dev already caps logs; add the same to prod or write `/etc/docker/daemon.json` during provisioning.

- [ ] **81. No rollback or post-deploy health verification** (Medium)
  Use `docker compose up -d --wait`, keep the previous tag, and revert on failure.

- [ ] **82. Deploy sed-mutates a tracked compose file with counter tags (v4, v5, v10)** (Medium)
  The committed tags are meaningless to anyone cloning the template and every deploy dirties the repo. Use `${TAG}` interpolation written to the server-side `.env`.

- [ ] **83. `deploy.sh` hardcodes `/opt/forgestack` in the remote heredoc** (Medium)
  A customized `REMOTE_PATH` rsyncs to one place and deploys from another. Use `cd "$REMOTE_PATH"`.

- [ ] **84. No alerting anywhere in the monitoring stack** (Medium)
  No rules, no Alertmanager, and the Loki ruler points at a host that does not exist. Add minimal alerts: instance down, disk, container restarts, 5xx rate.

- [ ] **85. No backup story for Mongo/Grafana volumes** (Medium)
  Add a scheduled mongodump script with off-host copies and document restore.

- [ ] **86. Tempo metrics_generator writes to Prometheus, but the receiver is off** (Medium)
  Prometheus rejects remote write unless started with `--web.enable-remote-write-receiver`, so service-graph metrics silently fail. Add the flag.

- [ ] **87. Promtail positions file lives in `/tmp` and is not persisted** (Medium)
  Every restart re-ingests all container logs into Loki as duplicates. Mount a small volume for it.

- [ ] **88. No resource limits on any prod container** (Medium)
  Kafka, Mongo, and the monitoring stack on one small VPS with no memory limits means one runaway service can OOM the box. Add limits at least for the heavy services.

- [ ] **89. Dev persists ZooKeeper data but not Kafka data** (Medium)
  Guaranteed cluster-ID mismatch on recreate. The recovery logic in `start-dev.sh` greps stale container/volume names (dead code from an old layout) and then falls back to `down -v`, destroying all dev data without asking. Fix the volumes and scope the recovery.

- [ ] **90. Grafana 10.4 (EOL, known CVEs) and cp-kafka 7.4.0 (2023, ZooKeeper)** (Medium)
  Bump Grafana to a current LTS and consider migrating Kafka to KRaft, which deletes the zookeeper container entirely.

- [ ] **91. `CADDY_BASIC_AUTH_HASH` was dead config** (Medium)
  **Mostly resolved by item 7**, which wired it to the Portainer site and documented it. Remaining: decide whether any other admin surface should sit behind the same snippet.

- [ ] **92. Small infra cleanups** (Low)
  - Caddy healthcheck only checks the binary runs, not that it serves.
  - Docker socket mounted read-write for promtail; make it `:ro`.
  - Prometheus and Tempo run as root to dodge permissions; prefer `group_add` / chown.
  - 5s scrape and cAdvisor housekeeping intervals are aggressive for one VPS; 15-30s is the norm.
  - No explicit retention for Prometheus, Loki, or Tempo.
  - Dev Prometheus has no data volume, so metrics vanish on recreate.
  - cAdvisor version and flags differ between dev and prod.
  - One Grafana dashboard has no `uid`, breaking stable links.
  - The NestJS Dockerfile uses deprecated `npm prune --production`, a shell-form CMD (signal forwarding), and hardcoded per-lib COPY lines.
  - The Caddyfile lacks compression and security headers.
  - `flock` is missing on stock macOS although the script supports Darwin.
  - The deploy uses `sleep 3` instead of `up -d --wait`.
  - Stale mongo-express variables sit in the prod env template.

## G. Tooling, lint, DX

- [ ] **93. No CI at all** (High)
  No `.github/` directory: no workflows, badges, issue/PR templates, or dependabot. Flagged independently by three audit passes; the single highest-leverage addition. Add a workflow running lint, typecheck, test, and build.

- [ ] **94. The `no-direct-entity-mutation` ESLint rule never fires** (High)
  It looks for a base class named `SharedAggregateRoot`, but the real class is `SharedAggregate`. Empirically verified dead, and it is a headline feature of the template. Fix the name and add a regression test.

- [ ] **95. The pre-commit hook stages everything** (High)
  After `lint:fix` it runs `git add` on all modified files, destroying intentionally scoped commits. Use lint-staged (already a devDependency, unused).

- [ ] **96. Hooks are not installed on plain `npm install`** (High)
  There is no `prepare` script, and `start-dev.sh` uses the deprecated `npx husky install` (removed in husky v10).

- [ ] **97. Pre-commit is slow and not portable** (Medium)
  It runs full-repo typecheck, lint, and tests on every commit, and uses bashisms (`${PIPESTATUS[0]}`) that break under dash on Linux. Use `nx affected` and POSIX sh.

- [ ] **98. Zero tests for the 14 custom ESLint rules** (Medium)
  Which is exactly how item 94 shipped broken. Add RuleTester suites.

- [ ] **99. The Nx lint cache ignores `eslint/rules/**`** (Medium)
  Editing a rule serves stale cached lint results. Add the rules directory to the lint target inputs.

- [ ] **100. Boundary rules are bypassable** (Medium)
  `no-cross-bc-imports` misses relative paths, `export from`, and dynamic `import()`; `handler-collocation` is bypassed by alias imports.

- [ ] **101. No lint rule for integration events** (Medium)
  Domain events must extend their base class by lint; integration events have no equivalent rule. Add the symmetric rule.

- [ ] **102. ESLint dependency clutter and missing frontend rules** (Medium)
  Around 11 unused ESLint devDependencies, `eslint-plugin-import` registered with zero rules, and the frontend is linted with the backend config: no React/Next plugins, and a dead `react-hooks` override references a plugin that is never registered.

- [ ] **103. Toolchain not pinned** (Medium)
  `eslint` and `prettier` are only transitive dependencies, and root package.json has no `engines` or `packageManager` fields.

- [ ] **104. `check-typescript.sh` skips the shared libs and greps output** (Medium)
  `backend/libs/*` are never directly typechecked, and success is determined by grepping for "error TS" instead of exit codes. Convert to cached Nx typecheck targets.

- [ ] **105. Two package managers in one repo** (Medium)
  npm at the root, pnpm in `frontend/public-page` (excluded from workspaces, no `packageManager` field). Pick one or pin and document the split.

- [ ] **106. No bounded-context generator** (Medium)
  The forgestack CLI scaffolds whole services well, but the day-to-day unit of growth is the bounded context (and commands/queries inside it), which is fully manual. Extend the CLI.

- [ ] **107. Generator prints commands and links that do not exist** (Medium)
  Its next-steps output suggests `npm run dev` (not a script) and `/docs/guides/adding-a-service` (not a path in `docs/`). Fix both.

- [ ] **108. `tsconfig.base.json` is not actually strict** (Medium)
  Only some strict flags are on, `lib` is older than `target`, and `dom` leaks browser globals into backend code. Enable `strict` and align `lib`.

- [ ] **109. Duplicate Nx installations** (Medium)
  The nx wrapper, the `installation` key in nx.json, and the devDependency coexist. Drop the wrapper and the key.

- [ ] **110. Small DX cleanups** (Low)
  - Custom rule doc URLs point at a 404 repo name.
  - `nx.json` references a `jest.preset.js` that does not exist.
  - `analyze-test-performance.sh` is referenced nowhere and its parsing is fragile.
  - `.gitattributes` does not normalize line endings (`* text=auto eol=lf`).
  - The root nx project forces `--exclude=forgestack` on every script and `test` uses the deprecated `--all` flag.
  - The generated service template says `UNLICENSED` in an MIT repo and pairs `@types/jest@30` with `jest@29`.
  - Lib spec/contract files and the forgestack tool itself are never linted.
  - Spec files are exempt from ALL boundary rules, not just the in-memory repository imports they need.

## H. Docs, identity, positioning

- [ ] **111. Three conflicting identities** (High)
  Repo dir/remote say `nestjs-microservices-framework`, package.json points at `forgestack.git`, and the brand is ForgeStack. Also: `service-1`/`service-2` as names, the `fmf` i18n prefix, "dev-console" vs `public-page`, AGENTS.md never says ForgeStack, and the SMTP from-name defaults to "NestJS Framework". Decide the identity once and apply it everywhere.

- [ ] **112. `service-2` exists but no doc mentions it** (High)
  README, architecture.md, and AGENTS.md describe a one-service repo while `backend/services/service-2` (analytics), its env files, and a Caddy route all exist. Document it or remove it.

- [ ] **113. README and deployment docs contradict the scripts** (High)
  The README tree shows a nonexistent `infra/docker/` and omits `tools/forgestack/`; the deployment menu numbers in README and `docs/deployment.md` do not match `deploy.sh`. Note: the wrong hint inside `setup-server.sh` was already fixed with item 21; `prod-setup.sh` still prints a wrong option number.

- [ ] **114. Two documentation sites that do not know about each other** (Medium)
  Root `docs/` and the MDX site under `frontend/public-page/app/docs/` will drift. Cross-link them and declare one canonical. `docs/frontend.md` still calls the app an "auth-only shell", and `commands.md` cites a docs page with no link.

- [ ] **115. Missing adoption docs** (Medium)
  No "make it yours" guide (rename service-1, rebrand, set domain and registry), no "add a bounded context" walkthrough, no troubleshooting section, the one-command `npm run prod:setup` path is undocumented, and pnpm is missing from the prerequisites.

- [ ] **116. No screenshots or demo** (Medium)
  The template ships a dashboard, Grafana boards, and a docs site but the README is text-only. Visuals drive starter-template adoption.

- [ ] **117. Docs violate the repo's own style rules** (Medium)
  Dozens of em-dashes and clever-parallelism marketing lines ("Commands mutate, queries read", "Deployable day one") across README and docs/. Flatten to plain sentences.

- [ ] **118. Community files** (Low)
  No CODE_OF_CONDUCT, SECURITY.md has no concrete contact or supported-versions statement, no CHANGELOG or release process, no README badges (add after CI exists), "provisions prerequisites" overstates what `start-dev.sh` does, and the LICENSE copyright says "FVJohnny" instead of a legal name.
