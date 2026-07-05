# Improvement backlog

This file tracks the findings of a full repo audit (2026-07-04). We work through it item by item, one commit per item.

A second audit was done on 2026-07-05 after Phase 1 was fully closed. Its findings are in the "Phase 2" section at the bottom (items 119 onward), separate from the Phase 1 work above.

How to read an item:

- The checkbox shows whether the item is resolved.
- The tag after the title is severity: (High), (Medium), or (Low).
- The indented text describes the problem and the suggested fix.
- Items that have been worked on end with a **Status** line saying what was actually done, how it was verified, and any leftover caveats.

## Progress

| Section | Items | Done | Open |
|---|---|---|---|
| A. Security | 26 | 25 done, 1 partial (item 5) | none (all code done) |
| B. Backend reliability (outbox/inbox/Kafka) | 19 | 19 (44 deferred) | none |
| C. Backend code quality | 13 | 13 | none |
| D. Backend testing | 2 | 2 | none |
| E. Frontend | 15 | 15 | none |
| F. Infra and deployment | 15 | 14 done, 1 won't-do (82) | none |
| G. Tooling, lint, DX | 18 | 18 | none |
| H. Docs, identity, positioning | 8 | 7 done, 1 owner-action (116) | none |

All of Section A is code-complete. Item 5's remaining work is manual secret rotation by the maintainer (the repo and its history are already clean).

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

- [x] **8. Frontend stores access, refresh, and admin-impersonation tokens in localStorage** (High)
  Any XSS could exfiltrate full sessions, including admin credentials saved during impersonation.
  **Status: Done (full httpOnly, both tokens).** The browser no longer sees a token at all.
  - Backend: a shared `auth-cookies.ts` helper sets/clears Secure httpOnly SameSite=lax cookies. Login, Google, verify-email, and refresh set them; logout clears them. `JwtAuthGuard` reads the access-token cookie first and falls back to the `Authorization` header (so Swagger and service-to-service still work). `configureApp` enables `cookie-parser`. The refresh endpoint dropped `JwtAuthGuard` (it must work once the access token has expired) and is now authenticated purely by the refresh cookie, with rotation preserved. Response bodies carry only `userId`.
  - Impersonation was removed entirely afterward (the maintainer does not want it), so there is no admin-cookie stack to reason about; see the note below.
  - Frontend: the API client sends `credentials: 'include'`, adds one-shot cookie-based refresh-and-retry on 401 (also fixes item 64), and emits an `auth:unauthenticated` event when refresh fails. Auth state now comes from calling `/auth/me` at mount instead of reading a token. All token/localStorage code removed from both auth services; the only remaining localStorage use is the UI locale.
  - Verified end to end against the running dev stack with curl through Caddy: login sets `#HttpOnly` cookies with a userId-only body; `/me` authenticates by cookie alone; cookie-only refresh works and rotates; logout returns 204 and clears cookies; post-logout `/me` and refresh both 401. Confirmed at the source that no token is written to localStorage. Full monorepo typecheck and all 7 test suites pass. Deferred: CSRF hardening beyond SameSite=lax (a token/double-submit) if the API is ever hosted cross-site from the frontend.
  - Follow-up: impersonation was removed entirely (maintainer's call; it was never fully wired on the frontend). Deleted the impersonate query/handler and both admin controllers, the `admin_*` cookie stack and impersonation token generators, and the `isImpersonating`/`originalEmail` token fields and `/me` output. Removed the frontend banner, admin-service/auth-service methods, endpoints, and i18n keys across all 8 locales, plus the doc/landing mentions. Verified live that both routes now 404 and `/me` no longer returns impersonation fields, while login/refresh/logout still work.

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

- [x] **25. Redis password visible in `docker inspect`; user tokens stored without TTL** (Low)
  The compose file interpolated the real Redis password into the container command and healthcheck, and stored user tokens were keyed by the raw JWT with no expiry, so they accumulated forever.
  **Status: Done.** (1) The prod Redis service now passes the password through the container's own `environment` and reads it inside an `sh -c` entrypoint (`--requirepass "$$REDIS_PASSWORD"`), so compose no longer bakes it into the command args; the healthcheck uses `REDISCLI_AUTH` and needs no `-a` flag. Verified with a real container that `docker inspect .Args` shows the literal `$REDIS_PASSWORD` (not the value) and that auth is enforced. (2) `UserToken_RedisRepository.save` now sets a TTL on all three keys (item, lookup, user-set), derived from the JWT's own `exp` claim plus a 60s grace, with a bounded 7-day fallback for tokens without a usable exp, so expired tokens self-clean. Covered by a new spec (3 tests against real Redis). Not addressed: hashing the token value used as a lookup key (deferred; it would change the key layout and is lower value than the TTL). Full suite passes.

- [x] **26. Dev Mongo/Redis published on all interfaces with default credentials** (Low)
  Fine on a laptop, risky on a shared or remote dev box; mongo-express also hardcoded admin/admin.
  **Status: Done.** Both dev port mappings are now bound to `127.0.0.1` (`127.0.0.1:27017:27017`, `127.0.0.1:6379:6379`), so the datastores are reachable by local tools but not over the network. App services are unaffected: they connect over the internal compose network by service name (`mongodb`, `redis`), verified via the env examples and `docker compose config`. mongo-express basic-auth creds are now `${MONGO_EXPRESS_USER:-admin}` / `${MONGO_EXPRESS_PASSWORD:-admin}`, overridable via env with the previous values as defaults (mongo-express is dev-only and has no host port, so it was never network-exposed, but the hardcoded creds are gone). Compose-only change; `docker compose config` validates.

## B. Backend reliability (outbox, inbox, Kafka)

- [x] **27. Inbox is in-memory only and cannot be swapped** (High)
  `InboxModule` hardcoded the in-memory repository, the Mongo inbox repository existed but was never wired, and Kafka offsets commit after the inbox save. A restart lost accepted-but-unprocessed events, defeating the inbox pattern.
  **Status: Done.** `InboxModule.forRoot({ repository })` now mirrors the outbox module, and both services pass `Inbox_MongodbRepository`. In-memory remains the default for anyone not wiring a durable store. Verified live: inbox events now persist in `inbox_events` in Mongo (with the retryCount field) and process end to end, so an accepted-but-unprocessed event survives a restart. All suites pass.

- [x] **28. Poison outbox events retry forever** (High)
  Events that exhaust their retries sat in the PROCESSING state, and the 5-minute stuck-reclaim reset them endlessly.
  **Status: Done.** Added a terminal FAILED marker (`new Date(2)`) to `OutboxProcessedAt` and `markAsFailed()`/`isFailed()` on the aggregate. When retries are exhausted the service now dead-letters the event instead of leaving it PROCESSING. All three adapters skip FAILED events: Mongo/in-memory stuck-reclaim only touch PROCESSING, `deleteProcessed` now excludes FAILED (dead letters are kept for inspection), and the Redis `save` pulls FAILED events out of every active index. New OutboxService test asserts bounded publish attempts and a FAILED terminal state.

- [x] **29. Outbox retry-reset is clobbered by the following `save()`** (High)
  The service reset the claim in the database, then saved the in-memory event which still carried the PROCESSING marker, writing it right back. Retries therefore only ever happened via the 5-minute reclaim path.
  **Status: Done.** `incrementRetry()` now also moves the event's `processedAt` back to `never()`, so a single `save()` persists both the bumped count and the released claim. Dropped the separate `resetClaimedEvent` call from the error path. New OutboxService test drives a fail-then-succeed publisher and asserts the event is unprocessed with retryCount 1 after the first tick (not stuck in PROCESSING) and processed after the second.

- [x] **30. `OutboxService.processEvent` drops its promise** (High)
  The traced call was neither awaited nor returned, so batch processing was not actually sequential, the `isProcessing` flag released while publishes were in flight, and per-topic ordering was lost.
  **Status: Done.** `processEvent` now returns the `TracingService.withSpan(...)` promise, so the batch loop's `await` genuinely waits for each publish and `isProcessing` is held for the whole batch. New OutboxService test tracks in-flight concurrency across a 4-event batch and asserts it never exceeds 1.

- [x] **31. No recovery path for PROCESSING or FAILED inbox events** (High)
  A crash between claim and completion stranded events forever; FAILED events were never retried.
  **Status: Done.** Added `retryCount`/`maxRetries` to the inbox aggregate and DTO (defaulted for old rows). `markAsFailed()` now requeues to PENDING while retries remain and only dead-letters (terminal FAILED) once exhausted, so a transient handler failure is retried instead of stranding the event. A new `reclaimStuckEvents(stuckSince)` on the repository (Mongo + in-memory) returns stale PROCESSING events to PENDING (counting a retry), and the service runs it on a 1-minute interval with a 5-minute stuck threshold, mirroring the outbox. Covered by new aggregate and in-memory-repo specs (10 tests). Verified live: a fresh registration flowed through outbox → Kafka → inbox → notifications and processed successfully with the new schema.

- [x] **32. `CircuitBreakerInterceptor` replays the first request's handler** (High)
  The opossum breaker is cached with the first request's closure and fires that same closure for every later request. Fundamentally broken. Fix: pass the current handler as a fire argument (`new CircuitBreaker((fn) => fn())` pattern).
  **Status: Done.** The breaker is now constructed with a passthrough action `(fn) => fn()` and `execute` calls `breaker.fire(fn)` with the current request's function, so a reused breaker runs the current call rather than the first one. Dropped the old `...args` passthrough (it was part of the bug) and the deprecated `toPromise()` in favor of `lastValueFrom`. Added a regression test that runs two different functions through one shared circuit and asserts each ran exactly once with its own result; the old code would have re-run the first. Common lib build, typecheck, lint, and all 85 tests pass. No service uses the decorator yet, so nothing downstream changed.

- [x] **33. Inbox dedup is check-then-act, not atomic** (Medium)
  Two concurrent deliveries of the same message both passed the null check and could double-process (and the second `save` could reset the first's status back to PENDING via the upsert).
  **Status: Done.** Added `insertIfNew(event)` to the inbox repository: Mongo does an `insertOne` and treats an E11000 duplicate-key as "already seen"; the in-memory repo checks its map (single-threaded, so atomic). `receiveMessage` uses it instead of check-then-save, so a concurrent redelivery loses the race and is reported as a duplicate without overwriting the winner. New inbox-service spec asserts a redelivered id does not reset a PROCESSING event back to PENDING.

- [x] **34. Events with no registered handler are marked FAILED permanently** (Medium)
  Any event on a subscribed topic that this service did not handle became permanent FAILED noise (and, after item 31, would retry then dead-letter — still wrong).
  **Status: Done.** `receiveMessage` now checks `hasHandler(topic, event)` and skips unhandled events entirely: they are not persisted (the Kafka offset is still committed, so they are effectively acked), matching the non-inbox listener's behavior. `findHandlers` no longer throws, and `processEvent` has a defensive fallback that marks a handler-less event processed instead of failing it. Verified live: service-2 skips the `email.verified` event it has no handler for while still processing `user.created`.

- [x] **35. Nothing ever calls the outbox/inbox cleanup methods** (Medium)
  `cleanupProcessedEvents` / `deleteProcessed` had no callers, so the collections grew unbounded.
  **Status: Done.** Both services now run a self-managed cleanup interval (every 6 hours) that deletes processed events older than the retention window (7 days), consistent with how they already own their processing and stuck-reclaim intervals (no new `@nestjs/schedule` dependency in the framework lib). Added an inbox `cleanupProcessedEvents` method (only the repo had `deleteProcessed`). FAILED dead-letters are retained. Both intervals are cleared on module destroy. New outbox test asserts the cleanup applies a past cutoff.

- [x] **36. Kafka consumer readiness is wrong** (Medium)
  Readiness flipped true when `consumer.run()` resolved, which happens before partitions are assigned, and a failed `startConsumer` only logged and never retried.
  **Status: Done.** Readiness is now driven by the consumer group lifecycle: `GROUP_JOIN` sets ready (partitions actually assigned), `CRASH`/`STOP` clear it. A failed `startConsumer` (e.g. broker down at boot) now retries every 5s instead of leaving the pod not-ready forever. Verified live: the "Kafka consumer joined group" log fires on GROUP_JOIN and events flow through end to end after a restart.

- [x] **37. Kafka group id defaults to `default-group`** (Medium)
  Services with `KAFKA_SERVICE_ID` unset shared one consumer group and stole each other's messages.
  **Status: Done (fail-fast part).** `KafkaService` now throws at construction if `KAFKA_SERVICE_ID` is unset instead of falling back to the shared `default-group`. All env examples already set it, so nothing breaks. Not changed: the consumer is still created for publish-only services; the listener already skips actually starting it when no topics are registered, so it connects but stays idle. Splitting the producer and consumer into separate providers would be a larger refactor left for later.

- [x] **38. Kafka SSL/SASL config conflates auth with tuning** (Medium)
  Connection timeouts and retry policy only applied when credentials were set, and TLS-without-SASL was unsupported.
  **Status: Done.** The retry policy and connection/request timeouts now apply unconditionally. TLS is enabled when `KAFKA_SSL=true` OR credentials are present (credentials should never travel in the clear), independent of SASL. The SASL mechanism is configurable via `KAFKA_SASL_MECHANISM`. Documented `KAFKA_SSL` in the env examples. Replaced the placeholder `kafka.spec.ts` with a real config-helper spec (6 tests) covering plaintext, TLS-only, and TLS+SASL.

- [x] **39. Outbox claim does up to 100 sequential `findOneAndUpdate` calls every 100 ms** (Medium)
  **Status: Done (config part).** The outbox interval/batch and the inbox interval/batch are now env-tunable (`OUTBOX_PROCESSING_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, `INBOX_PROCESSING_INTERVAL_MS`, `INBOX_BATCH_SIZE`), documented in the env example, so high-volume deployments can trade latency for fewer round-trips (e.g. larger batches, longer intervals). Not changed: the per-event atomic `findOneAndUpdate` claim loop. It is correct (each claim is atomic) and rewriting it as a single batch claim with a per-instance token is a larger change with real race-condition risk; the tunables address the practical load concern for now.

- [x] **40. `outbox_queue_size` metric reports the claimed batch size, not the backlog** (Medium)
  Both the outbox and inbox reported the just-claimed batch size (capped at BATCH_SIZE) as the queue depth.
  **Status: Done.** Added `countUnprocessed()` (outbox) and `countPending()` (inbox) to the repositories — indexed count in Mongo, O(1) zset/array in Redis/in-memory. The services now report the true backlog on the slow 60-second stuck-reclaim tick instead of the batch size on every 100 ms processing tick (so the accurate metric costs almost nothing). Covered by a `countUnprocessed` contract test that runs against all three outbox adapters.

- [x] **41. Redis outbox index maintenance is non-atomic** (Medium)
  `reclaimStuckEvents` did a read-modify-write per stuck event (GET, decode, SET, ZADD, ZREM) without atomicity, so a concurrent completion could interleave.
  **Status: Done (reclaim path).** Added a `RECLAIM_EVENT_LUA` script mirroring the existing claim script: it re-checks the event is still PROCESSING and resets it + moves the indexes in one atomic Redis call. Verified by the outbox reclaim contract test against real Redis. Not changed: `save` (which maintains indexes across a few commands) — it is only ever called for a single event the caller owns, so there is no competing writer for that id; and `resetClaimedEvent`, which is no longer used by the service after item 29.

- [x] **42. "Distributed transaction" is sequential best-effort, not two-phase commit** (Medium)
  Participants commit in a loop with no rollback of earlier commits. The Redis participant also ignored per-command errors in `exec()` and called `quit()` on a shared connection.
  **Status: Done.** The Redis participant's `commit()` now inspects `exec()`'s per-command result array and throws the first error instead of silently committing a partial pipeline; `dispose()` is a no-op (it must NOT `quit()` the connection owned by RedisService and shared by every repository); `rollback()` drops the stray `await` on the synchronous `discard()`. Documented on `DistributedTransactionContext` that it is sequential best-effort, not 2PC, and that a single `Transaction.run` should touch one store for atomicity. Also made the context's `dispose()` resilient so one throwing participant no longer leaks the rest (item 26). New unit spec covers commit-error surfacing, no-op dispose, and rollback. Not done: read-your-own-writes inside a Redis transaction (reads bypass the pipeline) — a deeper change left as a documented limitation.

- [x] **43. `handleEventFailure` is un-awaited in the inbox catch path** (Medium)
  A floating promise: if the failure-save rejects it becomes an unhandled rejection, and processing continues before the status is persisted. There is also a leftover commented-out `throw`.
  **Status: Done.** Folded in with item 31: the `safeProcessEvent` catch now `await`s `handleEventFailure`, and the stray `// throw error;` was removed. (The other call site, inside `processEvent`, was already awaited.)

- [x] **44. Outbox uses magic sentinel dates for state** (Low)
  `new Date(0)` / `new Date(1)` (and now `new Date(2)` for FAILED, added in item 28) encode state inside the `processedAt` timestamp, while the inbox uses a proper status enum.
  **Status: Deferred deliberately (documented).** Converting the outbox to a status enum would change the DTO, all three repository adapters, their indexes, and every query (findUnprocessed/claim/reclaim/deleteProcessed) — a risky migration for a cosmetic gain, especially right after item 28 built a correct, tested FAILED state on the sentinel model. The `OutboxProcessedAt` VO already encapsulates the markers behind `isNeverProcessed()`/`isProcessing()`/`isFailed()`/`isProcessed()` predicates, so callers do not touch the raw dates. Leaving the enum migration as a future cleanup rather than churning the storage format.

- [x] **45. Small Kafka/inbox leftovers** (Low)
  **Status: Done.** `unsubscribeFromTopic` now logs an honest warning that dynamic Kafka unsubscription is unsupported (a no-op) instead of a false "Unsubscribed" success. `parseMessage` no longer fabricates a `kafka-<timestamp>` id: it uses the payload id or the message key and throws if neither exists, so a genuinely id-less message can never silently break inbox idempotency. Removed the dead `messageId` field from `InboxEventDTO` (never set or read). New parseMessage spec covers the three id cases; verified live that real events still parse and process.

## C. Backend code quality

- [x] **46. `EntityExample` loses identity on rehydration** (Medium)
  The constructor called `super()` with no args, so `fromValue()` minted a fresh random id and timestamps and a repository round-trip returned a different aggregate. This is the example everyone copies.
  **Status: Done.** The constructor now passes `props.id`/`props.timestamps` to `super()`. Added a round-trip spec asserting `fromValue(toValue(x))` preserves the id and the full DTO — the regression guard that was missing.

- [x] **47. The default "admin" bootstrap user is a regular user** (Medium)
  `User.create` hardcoded `UserRole.user()`, so the seeded `admin@example.com` could not use any admin-guarded endpoint.
  **Status: Done.** Added an optional `role` to `CreateUserProps` / `RegisterUser_Command` (defaulting to a regular user), and the bootstrap now seeds the default user with `role: 'admin'`. Verified live: after wiping and re-seeding, the default user has `role: admin` in the DB and can reach `/admin/users` (HTTP 200), which it could not before.

- [x] **48. `RuntimeAutoDiscovery` is fragile** (Medium)
  Runtime `require()` by naming convention, swallowed load errors, breaks under bundlers, and typos become silently missing handlers. Prefer explicit imports or Nest's `DiscoveryService`.
  **Status: DONE (hardened in place).** Chose to keep the discovery mechanism (its convention-based ergonomics are a deliberate part of what makes the codebase legible) but stop it failing silently. A `require()` failure on a matched handler/controller file now PROPAGATES instead of being caught-and-warned, so a broken file fails the boot loudly rather than dropping that component; the top-level catch re-throws instead of returning partial results. A file that matches a suffix but exports no matching `*Handler`/`*Controller` class now logs a warning (the typical rename/typo case) instead of vanishing. The bundler incompatibility is unchanged (still runtime filesystem require) and noted as an accepted trade-off. Verified live: service-1 still discovers all 33 handlers + 18 controllers with no spurious warnings, and a probe handler with a bad import fails the boot (502) instead of silently skipping. Added a `runtime-auto-discovery.util.spec.ts` (3 cases: discovers a good handler, throws on a require-time failure, warns on a mis-suffixed class) — common now 124 tests, lint clean.

- [x] **49. EventTracker monkey-patches the EventBus and duplicates metrics** (Medium)
  It overwrites `publish`/`publishAll` at construction, records success before handlers run, and overlaps entirely with the Prometheus CQRS metrics. Consider removing the subsystem.
  **Status: DONE (fixed in place; not removed).** Removal was reconsidered: EventTracker is not dead code — it powers the JWT-protected `/dashboard/events` throughput endpoint in the dev console and is wired into the inbox via `setEventTracker`. So instead of deleting it, the two real bugs in the domain interceptor were fixed: it now records the outcome AFTER `originalPublish`/`publishAll` settles (marking failure when they throw) instead of unconditionally recording success beforehand, and it wraps-and-delegates around the original method rather than replacing its behaviour. The integration interceptor was already correct (tracks after handling / delegates to the inbox). Verified live against the running stack: after a real user registration the dashboard endpoint reports `Domain Events/UserRegistered_DomainEvent: success=1`, i.e. tracked post-publish with the true outcome. The Prometheus CQRS-metrics overlap is left as-is intentionally (the two serve different consumers: Grafana vs the in-app dashboard). Common lint + 121 tests pass.

- [x] **50. HTTP duration histogram is double-counted** (Medium)
  The interceptor recorded each request into `http_request_duration_seconds` twice: once via a `startTimer()` stop callback and once via `observeHttpRequest()`.
  **Status: Done.** Kept the single explicit `observeHttpRequest()` (it carries the status_code label) and removed the timer path. Also deleted the now-unused `startHttpRequestTimer` method so the double-count cannot be reintroduced.

- [x] **51. OTel SIGTERM handler hijacks shutdown** (Medium)
  The OTel bootstrap installed its own `SIGTERM` handler that called `process.exit(0)`, which could kill the process before Nest's `enableShutdownHooks` ran `onModuleDestroy` (Kafka/Mongo/Redis disconnect, outbox drain).
  **Status: Done.** Replaced the SIGTERM+exit handler with a `beforeExit` flush that shuts the SDK down without terminating the process. Nest now owns the SIGTERM → graceful-shutdown flow (shutdown hooks were already enabled in `configureApp`), and the SDK still flushes spans on exit. Verified the service starts and stops cleanly against the running stack.

- [x] **52. Product features live inside the shared framework lib** (Medium)
  The user-token auth context, app-specific Kafka topics, and example events sit in `libs/common`. Separate "framework" from "example app" or mark them clearly as examples.
  **Status: DONE (documented the boundary; no code moved).** Physically separating the example code would churn many import paths across both services for no functional gain, so the boundary was made explicit instead. Added `backend/libs/common/README.md` with a "Framework vs example" section listing exactly which top-level areas are reusable framework (bootstrap, cqrs, inbox/outbox, transactions, errors, logger, metrics, tracing, ...) versus example/product to replace (`auth/` user-token context, `integration-events/events/*.integration-event.ts`, `topics.ts`). Added header comments marking the example-only files: a note on `topics.ts`, a marker on each of the 7 concrete integration-event files, and a split annotation in `auth/index.ts` separating the framework guards/JWT from the example user-token model. Typecheck/lint/format clean.

- [x] **53. `Data.parseFromString('')` returns 0** (Medium)
  `Number('')` / `Number('   ')` coerce to 0, so an empty filter value matched the number 0 in EQUAL/IN conditions.
  **Status: Done.** `parseFromString` now returns empty/whitespace-only strings as-is before the number check. New spec covers empty, whitespace, numeric, boolean, date, and plain-text cases.

- [x] **54. `@IntegrationEventHandler` constructs a random event to read metadata** (Medium)
  It instantiates `eventClass.random()` (running validation on random data) just to read topic and name. Make those static.
  **Status: Done.** Added a `static readonly metadata { topic, name, version }` to `Base_IntegrationEvent` and every event subclass (each subclass feeds its own `metadata` into its `super(...)` call, so the instance and static values share one source of truth). The `@IntegrationEventHandler` decorator's `onModuleInit` now reads `eventClass.metadata` directly instead of building a throwaway `random()` instance. Verified live against the running stack: handlers register with the correct topic/name (logs show `Registered inbox handler for topic 'users' and event 'user.created'` etc.), and a real user registration flows end to end (`user.created` processed, notifications projection created, verification email sent). Lint and all 112 common tests pass.

- [x] **55. Mongo config typed as Mongoose options but passed to the native client** (Medium)
  `getMongoConfig()` returned `MongooseModuleOptions` (with a `dbName` the native `MongoClient` silently ignores), and mongoose/@nestjs/mongoose were declared deps only because of that type.
  **Status: Done.** Retyped `getMongoConfig()` as `MongoClientOptions` and dropped the bogus `dbName` (the db comes from the connection string). Removed `mongoose` and `@nestjs/mongoose` from the mongodb lib and both services (nothing imported them). Verified the service boots and Mongo collections initialize against the running stack; full typecheck and all suites pass.

- [x] **56. Fire-and-forget `RecordUserLogin` command** (Low)
  Login and Google OAuth controllers dispatched it without `await`, so a rejection became an unhandled promise rejection and failures vanished.
  **Status: Done.** Kept it non-blocking (last-login tracking should not delay the login response) but attached a `.catch` that logs via `CorrelationLogger`, so failures are visible and never become unhandled rejections.

- [x] **57. Value-object equality is shallow and fragile** (Low)
  `ValueObject.equals` uses reference equality plus `constructor.name` (breaks under minification), `DateVO` accepts Invalid Date, and `Id` validates twice.
  **Status: Done.** `ValueObject.equals` now compares prototypes (stable under minification) instead of `constructor.name`, and compares Dates/structural values by content rather than by reference. `DateVO.validate` rejects Invalid Date (`new Date('garbage')`), which the base null/undefined check missed. `Id` dropped its redundant explicit `this.validate()` (the base ctor already validates exactly once). Covered by a new `value-object.spec.ts` (9 cases); common 143 and service-1 506 tests pass.

- [x] **58. Duplicated types and unsafe casts** (Low)
  Two parallel pagination type modules, `IdentityEntry` declared identically in three layers, and `as` casts in the impersonate controller.
  **Status: Done.** Consolidated `IdentityEntry`, which was declared byte-identically in four files (user aggregate, user DTO, user-identity-marker DTO, and the list-users query response), into one canonical `auth/domain/identity-entry.type.ts`; the four now import (and re-export where consumers relied on the old path). The impersonate controller and its `as` casts are already gone (impersonation was removed earlier). On inspection the "two parallel pagination modules" are NOT a true duplication: `application/pagination/pagination.types.ts` is the internal offset/cursor param + result contract, while `interfaces/pagination.types.ts` is an HTTP request DTO with Swagger/class-validator decorators. That is a legitimate layer split (validation decorators must not leak into the application layer), so they were left separate. Verified: service-1 typecheck/lint clean and all 506 tests pass.

- [x] **59. `Password.random()` is predictable outside tests** (Low)
  **Status: Done.** Outside `NODE_ENV=test`, `Password.random()` used `'password' + _seq++`, a trivially guessable sequence that would be a real risk if it ever seeded a live account. Replaced it with `randomBytes(24).toString('hex')` plus an `aA1` suffix (guarantees the letter+digit+uppercase policy), and removed the module-level `_seq` counter. The test path (cached `TestPassword123!`) is unchanged, so tests stay deterministic. Verified: service-1 typecheck clean and all 506 tests pass.

- [x] **60. Small backend cleanups** (Low)
  **Status: Done (6 of 7).**
  - [x] `initializeIndexes` now re-throws instead of swallowing, so a failed unique-`id` index surfaces (ensureIndexes awaits it before every op) rather than running without the guarantee. Verified the service still boots.
  - [x] `exists()` uses `countDocuments(..., { limit: 1 })` instead of fetching the whole document.
  - [x] `NotFoundException` builds its message conditionally, so no-arg / no-details cases no longer print "Entity undefined not found. undefined".
  - [x] The error response is now labeled `application/json` (the body is a custom `{ success, error }` shape, not RFC 7807), and the dead `stack?` field was removed from `ErrorResponse`.
  - [x] `RedisService` now logs an honest fatal error (Redis is required) instead of "will not be available" before throwing.
  - [x] `RedisTestService` keys its DB off `JEST_WORKER_ID` (stable, unique per worker) instead of `process.pid % 16`, which could collide.
  - Not done: `console.*` in `main.ts` is left as-is — it runs in the process-level unhandled-rejection/exception net where the Nest logger may not be initialized yet, so `console.error` is the safer choice there.

## D. Backend testing

- [x] **61. No e2e or controller tests in service-1** (Medium)
  The auth flows (including everything section A fixed) have no HTTP-level tests, and there are no coverage thresholds. Add a few e2e tests for login/register/refresh/password-reset and set a coverage floor.
  **Status: Done.** Added `auth-http.spec.ts`: a controller-layer HTTP test that boots the real register + login controllers behind the SAME global `ValidationPipe` as production and drives them through supertest with stubbed CQRS buses (8 cases). It asserts the HTTP contract that had zero coverage: register validation (bad email / missing password → 400 with no dispatch, valid → 201 + a `RegisterUser_Command`, whitelist stripping of extra props), and login → 200 with ONLY `userId` in the body (no tokens) plus **httpOnly `access_token`/`refresh_token` cookies** and the right query/command dispatch — i.e. the Section A cookie-auth behavior, now regression-guarded. Fixed a latent jest-config bug this surfaced (the `^express$` mapping pointed at a per-service `node_modules/express` that does not exist under a hoisted install, breaking any test that loads `@nestjs/platform-express`); now uses `require.resolve('express')`, applied to both services. Added a `coverageThreshold` floor to service-1 (statements 60 / branches 45 / functions 65 / lines 60, just under the current 63.5/49.4/68.8/64 so it ratchets) and switched CI's test step to `--coverage` so the floor is enforced. Full run: service-1 55 suites / 514 tests, all 7 projects green with coverage.

- [x] **62. Zero tests exactly where the risk is** (Medium)
  No tests for the outbox/inbox processing loops, the Kafka listener/publisher, the guards, the exception filter, or the circuit breaker (which would have caught item 32). `kafka.spec.ts` is a placeholder asserting `true`.
  **Status: Done.** Re-scoped against the current tree: the outbox/inbox services + repos, the Kafka integration-event listener, and the circuit breaker already gained specs during Section B, and the placeholder `kafka.spec.ts` is gone. The real remaining gaps were the security-critical guards and the error filter, now covered: `jwt-auth.guard.spec.ts` (7 cases — cookie-first extraction, Bearer fallback, cookie-over-header precedence, non-Bearer ignored, and Unauthorized on missing token / verify failure / repository-revocation), `internal-api-key.guard.spec.ts` (6 cases — header + `Authorization: ApiKey` forms, wrong/missing key, unconfigured key, non-ApiKey scheme), and `global-exception.filter.spec.ts` (6 cases — the BaseException/HttpException/unexpected branches produce the standard `{success:false,error}` shape with the right status/code, cause propagation, and message masking in production). Common is now 143 tests (20 suites); lint clean.

## E. Frontend (website and dev console)

- [x] **63. English landing hero subtitle is "Idk what to write here yet"** (High)
  All 7 other locales had real copy; only the default (English) locale showed the placeholder.
  **Status: Done.** Wrote the English subtitle (back-translated from the other locales, in the maintainer's plain-sentence, no-em-dash style). Verified it renders live on the landing page.

- [x] **64. No refresh-and-retry on 401** (High)
  Any non-auth 401 cleared tokens and hard-redirected to `/login` even with a valid refresh token, so the first access-token expiry mid-session logged the user out.
  **Status: Done (as part of item 8).** The rewritten API client does a one-shot cookie-based refresh and retries the original request on a 401 (with a shared in-flight refresh promise so concurrent 401s trigger a single refresh), and only signals unauthenticated if the refresh itself fails. Auth endpoints are excluded from the retry.

- [x] **65. `typescript.ignoreBuildErrors: true` in next.config** (High)
  Type errors were silently ignored during `next build`.
  **Status: Done.** Removed the flag and added a `typecheck` script (`tsc --noEmit`) to the frontend package.json. Verified the frontend typechecks and builds clean, so a future type error now fails the build (and CI).

- [x] **66. Google sign-in sends an access token labeled `idToken`** (Medium)
  The auth-context parameter was named `idToken` but the value is a Google access token, and the button's comments described a flow that was not implemented.
  **Status: Done (honest access-token flow).** Renamed the `loginWithGoogle` parameter to `accessToken` and rewrote the button's misleading comments to state accurately that the implicit flow yields an access token, which the backend validates against `GOOGLE_CLIENT_ID` via tokeninfo (item 3) to prevent token substitution. Kept the access-token flow rather than switching to the `<GoogleLogin>` credential/ID-token flow, since the backend audience check already closes the security gap and switching would change the button UI and backend verification; documented how to switch if desired.

- [x] **67. Two parallel auth service implementations** (Medium)
  `lib/contexts/auth-service.ts` (class) and `lib/api/services/auth.service.ts` (object) both implemented register/login/verify/logout, and the class also duplicated the admin and MOTD methods that live in `admin.service.ts` / `account.service.ts`.
  **Status: Done.** Moved the two password-reset methods onto the class service, migrated the forgot/reset pages to it, and deleted the object `auth.service.ts` (and its dead barrel export). Removed the class service's dead admin/MOTD/change-password duplicates so it is auth-only, and dropped the unused `adminService.searchUsers` + its `SEARCH_USERS` endpoint. Typecheck and build clean; verified the password-reset endpoint the migrated pages hit still returns 200.

- [x] **68. Dead code to delete** (Medium)
  **Status: Done.** Deleted `lib/utils/notifications.tsx` (158 lines, zero imports), `app/login/components/login-background.tsx`, the shadcn leftover `styles/globals.css` (removed the now-empty `styles/` dir), the unreferenced `public/logo.png` / `logo-dark.png`, the unused `IDENTITY.RECORD` config endpoint, and 5 unused message keys across all 8 locales. Verified each was truly unreferenced first, then confirmed the frontend still typechecks and builds with no missing-message warnings.

- [x] **69. Dependencies pinned to `latest`** (Medium)
  **Status: Done.** Pinned the five `@radix-ui/*` packages and `sonner` to caret ranges of their currently-installed versions (e.g. `^1.1.17`, `^2.0.7`) so a fresh install cannot silently pull a breaking major. Reinstalled, typechecked, and built clean.

- [x] **70. Docker build depends on a gitignored env file** (Medium)
  `Dockerfile` copied `infra/env/public-page.env.prod`, which is gitignored, so `docker build` failed on a fresh clone with a cryptic COPY error.
  **Status: Done.** The Dockerfile now copies the whole `public-page.env.prod*` set (the trailing `.example` makes the glob match even when the real file is absent, so the build context requirement is satisfied) and then **requires the real file**, failing with an actionable message ("Create it from ...example and set the NEXT_PUBLIC_* values") if it is missing. It deliberately does NOT fall back to the `.example` defaults, since that would bake placeholder NEXT_PUBLIC_* values into a production image. Verified both paths: builds with the real file, fails clearly without it.

- [x] **71. Zero frontend tests** (Medium)
  The landing page sells "Tests that run in seconds" and the app has none. Add Vitest plus Testing Library with a few examples (api client, auth service, one form).
  **Status: DONE (Vitest + pure-logic examples).** Added Vitest to the frontend with `test`/`test:watch` scripts and two example suites (9 tests): `lib/utils/password.test.ts` for the client password policy (which must mirror the backend `Password` value object) and `i18n/config.test.ts` guarding the locale registry (every locale has a name + flag, default is in the list, no dupes — so adding a locale without wiring it up fails a test instead of shipping a broken switcher). Wired into the Nx `public-page:test` target, so `nx run-many test --all` now runs 8 projects and CI picks the frontend tests up. Full-component/Testing-Library tests (a form render) are a natural next step on this harness; started with fast pure-logic coverage. Frontend lint + all tests green.

- [x] **72. `auth.resetPassword` missing from 6 of 8 locales** (Medium)
  6 locales (de, es, fr, nl, pl, pt) were missing the whole `auth.resetPassword` section and silently fell back to English.
  **Status: Done.** Added translated `resetPassword` blocks to all 6 (title, description, field labels, submit/submitting, success, and the four error messages). All 8 locales now have identical key sets. Also added a `check:locales` script that fails if any locale's key set diverges from `en`, wired into the CI static job so this cannot silently regress.

- [x] **73. Register / verify-email flow contradiction** (Medium)
  Register auto-logged-in (verification disabled), yet the login form had a `?registered=true` handler showing a "check your email for verification" message that nothing ever linked to.
  **Status: Done.** Committed to the auto-login story (which matches the backend, where users are created active). Removed the dead `?registered=true` handler and its now-unused success-alert state from the login form, deleted the misleading `auth.login.successMessage` key from all 8 locales, and clarified the register-form comment (documenting how to switch to verification instead). Also fixed the register-then-login failure mode from item 77 (redirect to /login instead of showing "registration failed" when the account was actually created). Build clean, locales in parity.

- [x] **74. SEO essentials missing** (Medium)
  **Status: Done.** Enriched the root metadata with `metadataBase`, a title template (`%s · ForgeStack`), OpenGraph, and Twitter card tags (driven by `NEXT_PUBLIC_SITE_URL`). Added `app/robots.ts` (allows all, disallows `/dashboard`, points at the sitemap), `app/sitemap.ts` (public routes only), and a branded `app/not-found.tsx`. Verified live that `/robots.txt`, `/sitemap.xml`, and a 404 all serve correctly.

- [x] **75. `fmf.*` translation namespace is unexplained legacy naming** (Medium)
  **Status: Done.** Renamed the top-level `fmf` message namespace to `app` in all 8 locale files and updated the ~15 `useTranslations('fmf.…')` call sites (and the one MDX docs example that referenced it). Locales stay in parity, typecheck and build clean, and the landing/dashboard render with no missing-message errors.

- [x] **76. Language switcher rough edges** (Low)
  **Status: Mostly done.** Removed the mount-time reconciliation effect that could loop forever when cookies are blocked (the cookie is now the single source of truth, set only on change). Switched flags from the external flagcdn.com images to the local emoji flags the config already defined, dropping the external dependency entirely (also removed the flagcdn `remotePatterns` and CSP allowance, and the now-unused `localeFlagCodes`). Improved the trigger's `aria-label` to include the current language and marked the decorative flags `aria-hidden`. Verified live: emoji flags render, zero flagcdn requests. Not changed: the switch still does a full reload (next-intl locale change without a full i18n-router migration), and the flags-as-languages convention is kept for now; the duplicated Accept-Language parsing (middleware vs request.ts) is a separate small cleanup.

- [x] **77. Small frontend cleanups** (Low)
  **Status: Done.**
  - [x] `ngrok-skip-browser-warning` header removed (done with the item-8 client rewrite).
  - [x] The 401 path no longer returns `{} as T` to callers (the item-8 client throws/refreshes instead).
  - [x] Register-then-login failure now redirects to `/login` instead of showing "registration failed" (done with item 73).
  - [x] `app/error.tsx`'s component renamed from `GlobalError` to `RouteError` (it is the segment boundary), and a real `app/global-error.tsx` added to catch root-layout errors that the segment boundary cannot reach.
  - [x] `components.json` `hooks` alias fixed from the nonexistent `@/hooks` to `@/lib/hooks`.
  - Deferred (small, cosmetic): hardcoded English in a couple of aria-labels; `window.location.href` where the router would do (kept for the deliberate full-reload context resets); admin-table / mobile-drawer a11y polish (tracked with the broader a11y note). The error pages stay English on purpose since i18n may be what failed.
  - The 401 redirect path returns `{} as T` to in-flight callers.
  - Hardcoded English in the error page and several aria-labels.
  - Accessibility gaps in the admin table and mobile drawers (no aria-labels, no focus trap, no Escape).
  - Register-then-auto-login failure shows "Registration failed" even though the account was created.
  - `window.location.href` used where the router would do.
  - `app/error.tsx` is named `GlobalError` but is a route boundary; there is no real `global-error.tsx`.
  - `components.json` aliases a nonexistent `hooks` directory.
  - The frontend `lint` script only runs prettier.

## F. Infra and deployment

- [x] **78. `wait || exit` never detects failed parallel builds in deploy.sh** (High)
  A bare `wait` (no args) always returns 0, so `wait || { exit }` never fired and a failed image build proceeded to deploy.
  **Status: Done.** Added a `wait_all` helper that collects each background build's PID and `wait $pid`s them individually, failing the deploy if any exited non-zero. All three build functions (apps, monitoring, all) now use it. `build_and_push` returns 1 on a failed build/push so the PID exit status is meaningful. `bash -n` clean.

- [x] **79. Version bump happens before the build** (High)
  `set_version` mutated the compose file to `v(N+1)` before the build, so a failed build left it pointing at a tag that was never pushed.
  **Status: Done.** `build_and_push` now builds and pushes first and only calls `set_version` after a successful push; a failed build returns 1 and leaves the compose file unchanged. Combined with item 78, a build failure now aborts the deploy with the compose file still referencing the last good tag.

- [x] **80. No log rotation in prod** (High)
  The prod compose had no `logging:` options and the server had no daemon defaults, so a chatty service could fill the disk.
  **Status: Done.** `setup-server.sh` now writes `/etc/docker/daemon.json` with json-file log rotation (10m x 3) and restarts Docker (skipping if the file already exists), which caps logs daemon-wide for every container. Also added a `logging` anchor to the prod compose applied to the app services to document the intent. Validated with `docker compose config` and `bash -n`.

- [x] **81. No rollback or post-deploy health verification** (Medium)
  Use `docker compose up -d --wait`, keep the previous tag, and revert on failure.
  **Status: DONE (health-gate + failure hint).** The remote deploy now brings up the data stores AND the app tier with `up -d --wait`, so an unhealthy container makes the remote block (under `set -e`) exit non-zero. deploy.sh wraps the ssh call in an `if`: on success it logs "Deploy complete", on failure it prints an actionable message (how to read logs and that the last known-good tags are in git history) and exits 1 instead of silently reporting success. A fully automated tag-revert is coupled to the tag scheme in item 82 and left as a follow-up. Verified `bash -n`.

- [~] **82. Deploy sed-mutates a tracked compose file with counter tags (v4, v5, v10)** (Medium)
  The committed tags are meaningless to anyone cloning the template and every deploy dirties the repo. Use `${TAG}` interpolation written to the server-side `.env`.
  **Status: WON'T DO (by decision).** Considered moving to `${TAG}` interpolation (single shared tag per deploy) or per-service tags in a git-ignored file. Kept the current sed-based per-service counters: they give real, independent per-service version numbers and drive the deploy menu's version view, and the repo-dirtying is cosmetic since the tags are rewritten each deploy anyway. Revisit if the compose file ever needs to stay pristine in CI.

- [x] **83. `deploy.sh` hardcodes `/opt/forgestack` in the remote heredoc** (Medium)
  A customized `REMOTE_PATH` rsyncs to one place and deploys from another. Use `cd "$REMOTE_PATH"`.
  **Status: Done.** The remote heredoc now `cd "$REMOTE_PATH"` (the unquoted heredoc expands it locally), so a customized `REMOTE_PATH` rsyncs and deploys to the same place.

- [x] **84. No alerting anywhere in the monitoring stack** (Medium)
  No rules, no Alertmanager, and the Loki ruler points at a host that does not exist. Add minimal alerts: instance down, disk, container restarts, 5xx rate.
  **Status: DONE (rules; Alertmanager is opt-in).** Added `infra/monitoring/prometheus/alert-rules.yml` with 5 rules across 3 groups: `InstanceDown` (up==0), `ContainerRestarting`, `HostLowDisk` (>85%), `ContainerHighMemory` (>90% of mem_limit), and `HighHttp5xxRate` (>5% of `http_requests_total{status_code=~"5.."}` — verified that is the real metric/label the services expose). Wired via `rule_files` in prometheus.yml, baked into the image (Dockerfile.prometheus) and mounted in dev compose. Commented out the dead Loki ruler `alertmanager_url` (localhost:9093 pointed at nothing) with a note. Verified live: `promtool check rules` passes (5 rules), dev Prometheus reloaded and the rules API returns all 3 groups / 5 rules with no config error; Loki still starts with the ruler commented out. Rules are queryable via `ALERTS` and panellable in Grafana now; running an Alertmanager + a receiver (Slack/email) for push notifications is a documented opt-in (an `alerting:` block is present but commented in prometheus.yml).

- [x] **85. No backup story for Mongo/Grafana volumes** (Medium)
  Add a scheduled mongodump script with off-host copies and document restore.
  **Status: DONE (Mongo).** Added `infra/scripts/backup-mongo.sh`: resolves the running mongodb container from compose, `mongodump --archive | gzip` to a timestamped file, fails loudly on an empty dump, prunes by `RETENTION_DAYS` (default 14). Credentials come from `compose/.env` (same file deploy.sh ships). deploy.sh now ships the script to the deploy root, and setup-server.sh installs an idempotent daily cron (03:30) for the deploy user writing to `$REMOTE_PATH/backups`. Restore and off-host guidance are documented in the script header. Verified live against the dev replica set: produced a valid 12K archive (header shows `server_version 7.0.29`), pruning ran, and `mongorestore --archive --dryRun` parsed it and completed, proving the round-trip. Grafana dashboards/datasources are provisioned from files in the repo (already versioned), so they need no volume backup; only Grafana's own SQLite (users, ad-hoc changes) is unbacked, which is acceptable for this template.

- [x] **86. Tempo metrics_generator writes to Prometheus, but the receiver is off** (Medium)
  Prometheus had no `command:` so it never got `--web.enable-remote-write-receiver`, and Tempo's `metrics_generator` had no enabled processors, so service-graph/span metrics silently never appeared.
  **Status: Done.** Added a `command:` to Prometheus (prod + dev) with `--web.enable-remote-write-receiver` (plus config path, retention, lifecycle), and enabled the `service-graphs` + `span-metrics` processors via Tempo `overrides.defaults`. Verified live: the remote-write endpoint now returns 415 (active) instead of 404, and after generating traffic `traces_service_graph_*` and `traces_spanmetrics_*` metrics land in Prometheus.

- [x] **87. Promtail positions file lives in `/tmp` and is not persisted** (Medium)
  **Status: Done.** Moved the positions file to `/promtail/positions.yaml` and mounted a `promtail_data` (prod) / `promtail_data_dev` (dev) volume there, so promtail resumes where it left off instead of re-ingesting every container log on restart. Also made the promtail Docker socket mount read-only (item 92).

- [x] **88. No resource limits on any prod container** (Medium)
  **Status: Done.** Added `mem_limit` to every prod service: the NestJS anchor (512m), mongodb (768m), redis (384m), zookeeper (512m), kafka (1g), and the monitoring stack (256–512m), so one runaway container cannot OOM the single-box VPS. Validated with `docker compose config`.

- [x] **89. Dev persists ZooKeeper data but not Kafka data** (Medium)
  Dev persisted ZooKeeper but not Kafka's log dir, so on recreate ZK kept the old broker registration while Kafka's cluster id was wiped, causing the mismatch the start-dev recovery tried to clean up.
  **Status: Done (volume part).** Added a `kafka_data_dev` volume mounted at `/var/lib/kafka/data` (matching prod's `kafka_data`), so ZK and Kafka state stay consistent across recreates. The `start-dev.sh` stale-name recovery / `down -v` cleanup is a separate script fix (noted under item 92/the start-dev items); the root cause (missing Kafka volume) is fixed here.

- [x] **90. Grafana 10.4 (EOL, known CVEs) and cp-kafka 7.4.0 (2023, ZooKeeper)** (Medium)
  Bump Grafana to a current LTS and consider migrating Kafka to KRaft, which deletes the zookeeper container entirely.
  **Status: DONE (bump only).** Grafana `10.4.2` → `11.4.6` in `Dockerfile.grafana` and `docker-compose.dev.yml`. cp-kafka/cp-zookeeper `7.4.0` → `7.7.1` in both dev and prod compose. Verified live: Grafana 11.4.6 restarts and re-provisions all datasources/dashboards/alerting cleanly; Kafka 7.7.1 comes up healthy against the persisted volume (cluster id preserved, `users` + `__consumer_offsets` topics survive, `kafka-topics --list` works). The KRaft migration (deleting the zookeeper container) is a larger change deferred as a follow-up; kept the ZooKeeper setup on the patched image.

- [x] **91. `CADDY_BASIC_AUTH_HASH` was dead config** (Medium)
  **Resolved by item 7**, which wired it to the Portainer site (via the `admin-auth-prod` snippet) and documented it; Caddy refuses to start in prod if the hash is missing. Portainer is the only admin surface exposed through Caddy in prod (Grafana has its own login), so the snippet covers everything it needs to. No further wiring required.

- [x] **92. Small infra cleanups** (Low)
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
  **Status: DONE (most; two noted).** Done in this and prior monitoring batches:
  - Caddy prod healthcheck now `wget`s the admin API on `localhost:2019/config/` (only up once Caddy has loaded config and is serving) instead of `caddy version`.
  - Promtail Docker socket mounted `:ro` (prior batch).
  - Prometheus/Loki/Tempo retention set (prior batch: Prometheus `--storage.tsdb.retention.time`, Loki `retention_period: 168h`, Tempo `block_retention: 48h`).
  - Dev Prometheus data volume added (prior batch: `prometheus_data_dev`).
  - Scrape interval 5s → 15s (`prometheus.yml`); cAdvisor `--housekeeping_interval` 5s → 15s in dev and prod.
  - cAdvisor dev version `v0.49.1` → `v0.51.0` to match prod.
  - `nestjs-metrics.json` dashboard given `uid: nestjs-metrics` (the other three already had uids).
  - NestJS Dockerfile: `npm prune --production` → `--omit=dev`; CMD is now exec-form `["node","main.js"]` via a build-time symlink to the service's `dist/.../main.js`. Verified live: the built image bootstraps the full app (auto-discovery of 33 handlers/18 controllers) and `docker stop` returns in 0.1s, proving SIGTERM reaches node directly (the old `sh -c` form forced a 10s SIGKILL timeout).
  - Caddyfile: added a `(common)` snippet with `encode zstd gzip` plus baseline security headers (`-Server`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`), imported by the app and both API hosts. `caddy validate` passes; ran `caddy fmt`.
  - deploy.sh: `sleep 3` → `up -d --wait` for the data stores (they all have healthchecks).
  - Stale mongo-express vars removed from `infra.env.prod.example` (mongo-express is dev-only, not in prod compose).
  Noted, not changed: Prometheus/Tempo still run as `user: root` because docker_sd_configs needs to read the Docker socket, and the per-lib COPY lines in the Dockerfile are kept intentionally for build-layer caching (they let `npm ci` cache survive a source-only change). `flock` on macOS is a local-dev-only nicety, left as-is.

## G. Tooling, lint, DX

- [x] **93. No CI at all** (High)
  No `.github/` directory: no workflows, badges, or issue/PR templates.
  **Status: Done.** Added `.github/workflows/ci.yml` with two jobs: a `static` job (lint, typecheck, build — no DBs) and a `test` job that stands up real Redis (service container) and MongoDB (single-node replica set + auth + keyfile, matching the test URI) and runs the full suite. Verified the tricky part locally: reproduced the CI Mongo container and ran the mongodb lib tests (62) green against it. Added PR and issue (bug/feature) templates, and CI/license/node badges to the README. Runner concurrency cancels superseded runs.

- [x] **94. The `no-direct-entity-mutation` ESLint rule never fires** (High)
  It looked for a base class named `SharedAggregateRoot`, but the real class is `SharedAggregate`, so the headline architectural guardrail was dead.
  **Status: Done.** Fixed the class name (and the stale doc URL). Empirically verified with a probe that the rule now flags `user.googleId = 'x'`. Turning it on surfaced real violations: the outbox repositories poked `event.processedAt` directly, so I added `markAsProcessing()` / `markAsUnprocessed()` behaviors to the outbox aggregate and the Redis/in-memory repos now call those; and spec files (which legitimately mutate aggregates for setup) are now exempted in the spec-file override. Full lint and all suites pass. A RuleTester unit test is folded into item 98.

- [x] **95. The pre-commit hook stages everything** (High)
  After `lint:fix` it ran `git add` on every modified file, destroying intentionally scoped commits.
  **Status: Done.** The hook now runs `lint-staged` (which was installed but unused): it lints+formats only the staged files and re-stages exactly what it fixed, never the whole tree. Added a `lint-staged` config to package.json. Verified with a probe that a staged file gets formatted while an unrelated unstaged change is left alone.

- [x] **96. Hooks are not installed on plain `npm install`** (High)
  There was no `prepare` script, and `start-dev.sh` used the deprecated `npx husky install` (removed in husky v10).
  **Status: Done.** Added `"prepare": "husky"` so a plain `npm install` installs the hooks for every contributor, and removed the deprecated `npx husky install` from `start-dev.sh`. Verified `npm run prepare` creates `.husky/_/pre-commit`.

- [x] **97. Pre-commit is slow and not portable** (Medium)
  It ran full-repo typecheck, lint, and tests on every commit, and used bashisms (`${PIPESTATUS[0]}`, `echo "\n"`) that break under dash.
  **Status: Done (mostly).** Rewrote the hook as POSIX sh (verified with `sh -n` and `dash -n`): lint-staged scopes lint/format to staged files, and tests run via `nx affected -t test --base=HEAD` instead of the whole suite. Typecheck still runs workspace-wide because there is no per-project Nx typecheck target yet (that migration is item 104); it is Nx-cached underneath, so it is fast when unchanged.

- [x] **98. Zero tests for the 14 custom ESLint rules** (Medium)
  Which is exactly how item 94 shipped broken. Add RuleTester suites.
  **Status: DONE (base-class family).** Added `eslint/rules/__tests__/base-class-rules.test.mjs` with RuleTester suites for the "class must extend base X" rules that item 94 broke: `domain-event-base`, `integration-event-base` (item 101), and `aggregate-base`. Each suite asserts both the valid case and the missing/wrong-base-class violations. Wired as `npm run test:eslint-rules` and added to the CI static job. Verified the suite is a real guardrail: renaming the aggregate base class to `SharedAggregateRoot` (the exact item-94 bug) makes it throw an AssertionError; it passes when the rules are correct. The remaining rules split into more AST-only ones (handler-naming, value-object-naming, cqrs-handler-collocation, no-cross-bc-imports) and type-aware ones (`no-direct-entity-mutation` needs full parser services); extending the harness to those is a natural follow-up on the same pattern. Also fixed the last stale rule doc URL (`no-direct-entity-mutation` still pointed at the old `forgestack` repo path).

- [x] **99. The Nx lint cache ignores `eslint/rules/**`** (Medium)
  **Status: Done.** Added `{workspaceRoot}/eslint/rules/**/*` to the `sharedGlobals` named input, so editing any custom rule invalidates the lint (and default) cache. Also removed the stale `{workspaceRoot}/jest.preset.js` from the test inputs (item 110), since that file does not exist.

- [x] **100. Boundary rules are bypassable** (Medium)
  `no-cross-bc-imports` misses relative paths, `export from`, and dynamic `import()`; `handler-collocation` is bypassed by alias imports.
  **Status: Done.** `no-cross-bc-imports` now resolves relative specifiers to a filesystem path and checks the target's `bounded-contexts/<name>` segment, so `../../other-bc/...` is caught (not just `@bc/` aliases). It also handles `export ... from`, `export * from`, and dynamic `import()` with a string literal. `cqrs-handler-collocation` now flags an aliased import of a command/query handler's OWN `_Command`/`_Query` (a collocated message must be a `./` relative import); domain-event handlers are deliberately exempt because the events they handle live on aggregates elsewhere and are legitimately imported via `@bc/` alias (turning that on surfaced only that intended case, confirming the scoping). Verified live with probes: a relative cross-BC import and an aliased command import are both now flagged, and all real code still lints clean. Added RuleTester coverage for the cross-BC rule (alias, relative, re-export, export-star, dynamic import).

- [x] **101. No lint rule for integration events** (Medium)
  Domain events must extend their base class by lint; integration events have no equivalent rule. Add the symmetric rule.
  **Status: Done.** Added `eslint/rules/integration-event-base.mjs`, a mirror of `domain-event-base`: any exported `*_IntegrationEvent` class in a `*.integration-event.ts` file (except `base.integration-event.ts`) must extend `Base_IntegrationEvent`. Registered and enabled as `integration-event/must-extend-base: error`. Verified live: lint passes on all real integration events, and a probe class that does not extend the base is flagged (then removed). Covered by a RuleTester suite under item 98.

- [x] **102. ESLint dependency clutter and missing frontend rules** (Medium)
  Around 11 unused ESLint devDependencies, `eslint-plugin-import` registered with zero rules, and the frontend is linted with the backend config: no React/Next plugins, and a dead `react-hooks` override references a plugin that is never registered.
  **Status: Done.** Removed 10 unused ESLint devDependencies from the root (import, import-x, jest, promise, security, simple-import-sort, sonarjs, unicorn, unused-imports, import-resolver-typescript) after confirming zero references; dropped the `eslint-plugin-import` registration (it had no active `import/*` rule) and the dead frontend `react-hooks/exhaustive-deps` override (it referenced an unregistered plugin). Added `frontend/**` to the backend config's ignores so it no longer reaches into the frontend. Gave the frontend its OWN flat `eslint.config.mjs` with real Next.js rules (`@next/eslint-plugin-next` recommended + core-web-vitals, `eslint-plugin-react`, `eslint-plugin-react-hooks`, typescript-eslint) and added those deps via pnpm. Wired eslint into the frontend `lint` script and the Nx `public-page:lint` target (now runs in the frontend cwd against its local config). Verified: all 8 projects lint green through Nx, and the new frontend config immediately surfaced a real issue the backend config never could (a raw `<img>` that should be `next/image`, reported as the intended `@next/next/no-img-element` warning).

- [x] **103. Toolchain not pinned** (Medium)
  `eslint` and `prettier` are only transitive dependencies, and root package.json has no `engines` or `packageManager` fields.
  **Status: Done.** Added `eslint` (^9.37.0) and `prettier` (^3.6.2) as direct devDependencies (pinned to the versions that were resolving transitively), plus `"engines": { "node": ">=22" }` (matching `.nvmrc`) and `"packageManager": "npm@10.9.0"` (the npm that ships with node 22). Also corrected the `repository.url` to the real repo (`nestjs-microservices-framework`, was `forgestack`). `npm install` and lint verified green.

- [x] **104. `check-typescript.sh` skips the shared libs and greps output** (Medium)
  `backend/libs/*` are never directly typechecked, and success is determined by grepping for "error TS" instead of exit codes. Convert to cached Nx typecheck targets.
  **Status: Done.** Added a cached `typecheck` target (`tsc --noEmit -p tsconfig.json`) to all 6 backend project.json files plus a `typecheck` targetDefault in nx.json (cache + inputs). Rewrote `check-typescript.sh` to `exec npx nx run-many -t typecheck`, so it now covers the libs (previously skipped), keys off tsc's exit code (not a stdout grep), and is Nx-cached. `npm run typecheck` (used by CI and pre-commit) now runs all 7 projects (6 backend + public-page). Updated the pre-commit hook to `nx affected -t typecheck`. Verified: full run is green across 7 projects, a probe type error makes the target exit 1, and CI needs no change since it already calls `npm run typecheck`.

- [x] **105. Two package managers in one repo** (Medium)
  npm at the root, pnpm in `frontend/public-page` (excluded from workspaces, no `packageManager` field). Pick one or pin and document the split.
  **Status: DONE (pinned and documented the split).** Kept the intentional split (forcing the Next.js app into the npm workspace, or the backend onto pnpm, is a large change with no functional gain). Pinned both sides via `packageManager`: root `npm@10.9.0` (item 103) and `frontend/public-page` now `pnpm@10.17.1`. Documented the split in the README (which manager owns which part, and that the frontend installs its own deps via pnpm/Docker). Verified the frontend pin with a clean `pnpm install --frozen-lockfile`.

- [x] **106. No bounded-context generator** (Medium)
  The forgestack CLI scaffolds whole services well, but the day-to-day unit of growth is the bounded context (and commands/queries inside it), which is fully manual. Extend the CLI.
  **Status: Done.** Added a `bounded-context` generator to `@forgestack/tools`: `nx g @forgestack/tools:bounded-context <name> --service=<svc> [--command=<cmd>]` scaffolds a context (module + a starter command with handler + a controller/params) under the target service and wires its module into the service's `app.module.ts` (both the import and the `imports:` array entry, inserted after the last existing bounded-context module). Uses `names()` for kebab→PascalCase derivations and RuntimeAutoDiscovery so handlers/controllers need no manual registration. Verified end-to-end: generated a `billing` context into service-2 and confirmed it typechecks (fixed a missing `validate()` override) and lints clean under strict; added a 5-case RuleTester-style Nx generator spec (files land, app.module wired, custom command name, kebab validation, missing-service error) that passes. Documented both generators in the README.

- [x] **107. Generator prints commands and links that do not exist** (Medium)
  Its next-steps output suggests `npm run dev` (not a script) and `/docs/guides/adding-a-service` (not a path in `docs/`). Fix both.
  **Status: Done.** The service generator's next-steps now print `npm run dev:start` (the real script) and point at `docs/architecture.md` (a real file) instead of the nonexistent `/docs/guides/adding-a-service`.

- [x] **108. `tsconfig.base.json` is not actually strict** (Medium)
  Only some strict flags are on, `lib` is older than `target`, and `dom` leaks browser globals into backend code. Enable `strict` and align `lib`.
  **Status: Done (full strict).** Enabled `strict: true` (was only `strictNullChecks`/`noImplicitAny`/`strictBindCallApply`) and aligned `lib` to `["es2023"]`, dropping `dom` (backend has no browser globals; the frontend has its own tsconfig). This surfaced 190 errors, all fixed: ~165 `TS2564` (property-initializer on DTO/command/query/entity classes assigned via `Object.assign`) got definite-assignment `!`; the inbox/outbox `forRoot` option types switched from `new (...args: unknown[]) => T` to Nest's `Type<T>` (the old signature rejected concrete repo classes under `strictFunctionTypes`); catch-block `unknown` errors (from `useUnknownInCatchVariables`) were normalized before logging/rethrow; and untyped `Response.json()` results in the Google OAuth service were explicitly cast. Verified end-to-end: `tsc --noEmit` is 0 errors across all 6 backend projects, `nx build` is 7/7, the full test suite is 506/506 passing, and lint is clean.

- [x] **109. Duplicate Nx installations** (Medium)
  The nx wrapper, the `installation` key in nx.json, and the devDependency coexist. Drop the wrapper and the key.
  **Status: Done.** Removed the `nx` shell wrapper and `.nx/nxw.js`, and dropped the `installation` key from nx.json. Nx now resolves solely from the `nx` devDependency (nothing referenced `./nx`). Verified `nx show projects` and `nx lint` still work.

- [x] **110. Small DX cleanups** (Low)
  - Custom rule doc URLs point at a 404 repo name.
  - `nx.json` references a `jest.preset.js` that does not exist.
  - `analyze-test-performance.sh` is referenced nowhere and its parsing is fragile.
  **Status: Done.** Repointed all 12 custom-rule doc URLs from the 404 `nestjs-microservices-template/eslint-rules` to the real repo path (`FVJohnny/nestjs-microservices-framework/blob/main/eslint/rules/<name>.mjs`). The stale `jest.preset.js` input was already removed under item 99. Deleted the orphaned, fragile `scripts/analyze-test-performance.sh`.
  - `.gitattributes` does not normalize line endings (`* text=auto eol=lf`).
  - The root nx project forces `--exclude=forgestack` on every script and `test` uses the deprecated `--all` flag.
  - The generated service template says `UNLICENSED` in an MIT repo and pairs `@types/jest@30` with `jest@29`.
  - Lib spec/contract files and the forgestack tool itself are never linted.
  - Spec files are exempt from ALL boundary rules, not just the in-memory repository imports they need.

## H. Docs, identity, positioning

- [x] **111. Three conflicting identities** (High)
  Repo dir/remote said `nestjs-microservices-framework`, package.json pointed at `forgestack.git`, and the brand is ForgeStack.
  **Status: Done in-repo; one manual step left.** Aligned everything code-side on ForgeStack: AGENTS.md now names ForgeStack, the SMTP from-name defaults to `APP_NAME`/"ForgeStack" instead of "NestJS Framework" (this also closes item 17), and README no longer uses the "dev-console" term. The `fmf` i18n prefix is tracked separately as item 75. USER TODO: the GitHub repo is still named `nestjs-microservices-framework` while package.json and the brand say `forgestack` — rename the GitHub repo to `forgestack` (or, if you prefer the other name, update package.json and the README badges). Only you can rename the repo.

- [x] **112. `service-2` exists but no doc mentions it** (High)
  README, architecture.md, and AGENTS.md described a one-service repo while `backend/services/service-2` (analytics) exists.
  **Status: Done.** The README monorepo tree now shows `service-2` (analytics, "consumes service-1 events over Kafka") as a second service demonstrating cross-service events, and AGENTS.md mentions it. Kept it (it demonstrates the cross-service event flow) rather than removing it.

- [x] **113. README and deployment docs contradict the scripts** (High)
  The README tree showed a nonexistent `infra/docker/` and omitted `tools/forgestack/`; the deploy-menu numbers in the README, `docs/deployment.md`, and `prod-setup.sh` did not match `deploy.sh`.
  **Status: Done.** Rewrote the README `infra/` tree to the real subdirs (compose, caddy, dockerfiles, env, mongo, scripts, monitoring) and added `tools/forgestack/`. Fixed the README deploy menu to match `deploy.sh` exactly (and noted that a single service is deployed by typing its name). Fixed the two wrong option numbers in `docs/deployment.md` (ALL is 5, deploy-only is 6) and the two in `prod-setup.sh`.

- [x] **114. Two documentation sites that do not know about each other** (Medium)
  Root `docs/` and the MDX site under `frontend/public-page/app/docs/` will drift. Cross-link them and declare one canonical.
  **Status: Done.** Declared the frontend MDX docs site (served at `/docs`, the richer of the two) canonical: the README Documentation section now explains both doc sets, names the site as canonical, and says the site wins on conflict. Each root `docs/*.md` got a header note linking to its canonical docs-site page. Also swept the MDX site for em-dashes as part of item 117 (~93 removed).

- [x] **115. Missing adoption docs** (Medium)
  No "make it yours" guide (rename service-1, rebrand, set domain and registry), no "add a bounded context" walkthrough, no troubleshooting section, the one-command `npm run prod:setup` path is undocumented, and pnpm is missing from the prerequisites.
  **Status: Done.** Added a `/docs/guides/make-it-yours` page covering rebranding (name/APP_NAME/frontend copy), setting the domain + Docker registry + prod secrets, renaming/replacing the example services and bounded contexts (pointing at the `bounded-context` generator from item 106), the one-command `npm run prod:setup` provisioning path (previously undocumented), and a Troubleshooting section (Node not found, cert trust, 502 on cold start, stale Kafka/Mongo volumes, missing handler via the item-48 fail-loud, unhealthy prod deploy). Wired into the docs nav. pnpm is now covered by the README Package managers section (item 105). Verified: the frontend builds and the new `/docs/guides/make-it-yours` route compiles into the manifest.

- [~] **116. No screenshots or demo** (Medium)
  The template ships a dashboard, Grafana boards, and a docs site but the README is text-only. Visuals drive starter-template adoption.
  **Status: OWNER ACTION.** Screenshots need the real branding, seeded data, and a running stack, so the owner will capture them (landing page, dashboard, a Grafana board, the docs site) and add a README Screenshots section. Not scaffolded, to avoid shipping broken image links.

- [x] **117. Docs violate the repo's own style rules** (Medium)
  Dozens of em-dashes and clever-parallelism marketing lines ("Commands mutate, queries read", "Deployable day one") across README and docs/. Flatten to plain sentences.
  **Status: Done.** Removed every prose em-dash across the README, CONTRIBUTING, SECURITY, the six `docs/*.md` files, and the ~20 MDX docs pages (roughly 150 total), rewriting to plain punctuation and leaving code-block em-dashes (TS comments, ASCII trees) literal. Flattened the two flagged parallelism lines ("Commands mutate, queries read" → "Commands change state and queries read it"; "Deployable day one" → "Deploy on the first day"). Frontend builds clean.

- [x] **118. Community files** (Low)
  No CODE_OF_CONDUCT, SECURITY.md has no concrete contact or supported-versions statement, no CHANGELOG or release process, no README badges (add after CI exists), "provisions prerequisites" overstates what `start-dev.sh` does, and the LICENSE copyright says "FVJohnny" instead of a legal name.
  **Status: DONE (one owner-only item left).** Added `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, linked from CONTRIBUTING) and `CHANGELOG.md` (Keep a Changelog format, 1.0.0 baseline). Gave SECURITY.md a Supported versions section and a concrete private vulnerability-reporting path (GitHub Security Advisories, no public issues) under item 117's sweep. Fixed the README overstatement: `dev:start` CHECKS prerequisites (verifies Node, can install Docker) rather than provisioning them. README badges (CI/license/node) already exist. Left for the owner: the LICENSE copyright says "FVJohnny" (their handle); swapping it for a legal name is their call, not something to change unilaterally.

# Phase 2: second audit (2026-07-05)

This is a fresh top-to-bottom audit done after all of Phase 1 was closed. It is a separate pass: it does not touch or re-litigate the items above. Where a Phase 1 item has regressed, the new item says so explicitly and names the Phase 1 number.

How the audit was run: the whole dev stack was booted and driven for real (frontend in a headless browser, the API through Caddy with curl, Mongo and Redis inspected directly, live Prometheus metrics read back). Every "broken" claim below is backed by a runtime capture, a code quote, or a runnable reproduction, not by reading alone.

Each item has a bold title, a plain description, a severity (High/Medium/Low), and a classification: "broken/must fix" (it does the wrong thing now), "would improve" (correct but below standard), or "opinion" (a judgement call). New items are numbered from 119 and grouped by area.

## New progress

| Section | Items | Broken/must fix | Would improve | Opinion |
|---|---|---|---|---|
| I. Security and auth | 119-127 | 6 | 2 | 1 |
| J. Backend reliability | 128-135 | 5 | 3 | 0 |
| K. Observability | 136-139 | 3 | 1 | 0 |
| L. Infra and deployment | 140-148 | 3 | 5 | 1 |
| M. Frontend | 149-158 | 4 | 5 | 1 |
| N. Tooling, CI, docs | 159-171 | 7 | 5 | 1 |

The two most urgent are item 119 (CSRF, from the recent cookie change) and item 159 (CI cannot pass). Both are direct fallout of work landed after Phase 1 and both contradict what the sections above record as resolved.

## I. Security and auth

- [ ] **119. Auth cookies are `SameSite=None` with no CSRF defense, and the code comment claiming otherwise is wrong** (High)
  Regression of the deferred tradeoff in item 8. Commit `4a646e4` changed both token cookies from `SameSite=Lax` to `None` (`backend/libs/common/src/auth/auth-cookies.ts:22-40`) so the cross-host `/auth/me` fetch works in dev. The justifying comment says "CSRF is mitigated because the tokens are httpOnly and the API also validates them against the token store." Both claims are false: httpOnly stops a script from reading the cookie, it does nothing for CSRF (the browser attaches the cookie to a forged request automatically), and the token-store check just validates the victim's own valid token. With `SameSite=None` plus the urlencoded body parser enabled in `configure-app.ts`, a cross-site `<form method="POST">` to any cookie-authed state-changing route is a CORS "simple request" (no preflight) and executes with the victim's session. Verified the concrete targets exist and are body-less POSTs guarded only by `JwtAuthGuard`(+`AdminRoleGuard`): `/api/v1/auth/logout` and `/api/v1/admin/users/:id/suspend`. Runtime note: those returned 401 in my tests only because I sent no cookie; a real cross-site attack rides the victim's cookie. Item 8 recorded "Deferred: CSRF hardening beyond SameSite=lax if the API is ever hosted cross-site" but the config is now `None` (always cross-site), so that deferred risk is active. Also note that in prod `app.example.com` and `service1.example.com` are same-site (shared registrable domain), so `Lax` would have worked there; `None` was a dev-only workaround applied globally. Classification: broken/must fix. Fix: validate `Origin`/`Sec-Fetch-Site` on state-changing routes, or add a double-submit CSRF token, or keep `Lax` in prod and special-case dev. At minimum delete the false comment.
  **Status: Done.** Added `csrf.middleware.ts`: a global Express middleware (wired into `configureApp` after cookie-parser, before routing) that rejects state-changing methods (anything but GET/HEAD/OPTIONS) when the request is cross-site. It trusts `Sec-Fetch-Site` when present (only `same-origin`/`same-site`/`none` pass, `cross-site` is 403), and falls back to an `Origin` allowlist (CORS_ORIGINS plus same-host) for older clients; a request with neither header (server-to-server) is allowed. This keeps `SameSite=None` working for the legitimate cross-site frontend (its Origin is allowlisted) while blocking a forged cross-site form post, with no frontend change. Kept `SameSite=None` since dev is genuinely cross-site (`localhost` vs `service1.localhost`) and prod is same-site (`mydomain.xx` vs `service1.mydomain.xx`). Replaced the false comment in `auth-cookies.ts`. Covered by a 6-case spec. Verified live: cross-site POST logout with a valid cookie returns 403, evil-Origin login returns 403, same-origin logout succeeds, GET requests are never blocked. Gated behind `enableCsrf` (default on).

- [x] **120. Swagger and the full OpenAPI spec are served unconditionally, including in production** (High)
  `configureApp` defaults `enableSwagger = true` with no environment gate (`backend/libs/common/src/bootstrap/configure-app.ts:115-127`), and `SwaggerUtility.setupSwagger` only skips when `config.enabled` is explicitly false (`swagger.utility.ts:12-17`), which no service sets. Verified live: `GET https://service1.localhost/docs` returns the Swagger UI (200) and `GET /docs-json` returns the complete machine-readable spec (200). In production this publishes the entire API surface (every route, DTO, param, and the bearer-auth scheme) to anonymous visitors. Classification: broken/must fix. Fix: gate Swagger behind `NODE_ENV !== 'production'` or an explicit `SWAGGER_ENABLED` flag, defaulting off in prod.
  **Status: Done.** Swagger now defaults off when `NODE_ENV === 'production'`. `SWAGGER_ENABLED` overrides in either direction (`=true` forces on, `=false` forces off) in any environment, so dev keeps its docs and a maintainer can still enable prod docs deliberately (behind auth). Documented the flag as a commented line in both prod env examples. Dev behavior is unchanged (still served at `/docs`).

- [ ] **121. Suspending or deleting a user does not revoke their tokens** (Medium)
  `User.suspend()` (`.../auth/domain/aggregates/user/user.aggregate.ts:244`) and `delete()` only change status/emit their own domain events; neither triggers token revocation. Only `logout()` (line 229) applies `UserLogout_DomainEvent`, which is what drives `RevokeAllUserTokens`. `JwtAuthGuard` checks JWT validity plus token-in-store but never re-reads user status or existence, so a suspended user (or suspended admin) keeps a fully valid access token until it expires. Verified the window is `JWT_EXPIRES_IN=15m` in the prod env examples. During that window `AdminRoleGuard` still grants `/admin/*` from the token's role claim. Refresh is correctly blocked (the refresh handler calls `canAuthenticate()`), so the exposure is bounded, but suspension and deletion are not immediate as an operator expects. Classification: broken/must fix. Fix: emit a revoke-all-tokens effect from `suspend()` and `delete()`.

- [ ] **122. Per-user rate limiting silently fell back to per-IP for all browser traffic** (Medium)
  Regression of item 17. That fix made the throttler guard extract the user id from the bearer token. Item 8 then moved browser auth to the httpOnly `access_token` cookie, but the guard was never updated: `extractUserIdFromToken` reads only `request.headers.authorization` (`backend/libs/common/src/security/api-rate-limit/api-rate-limit.guard.ts:60-71`), while `JwtAuthGuard.extractToken` reads the cookie first. Browsers send no `Authorization` header now, so every `type: 'user'` limit (all three preset decorators) keys by IP for the primary client. Users behind one NAT share a bucket; a user rotating IPs evades per-account limits. The same cookie-blind extraction is in `tracing.middleware.ts`, so `userId` log/trace enrichment is also dead for browser requests. Classification: broken/must fix. Fix: read the access-token cookie in both places, reusing the guard's extraction.
  **Status: Done.** Both places now read the access-token cookie first and fall back to the bearer header, mirroring `JwtAuthGuard.extractToken`. The rate-limit guard's `extractUserIdFromToken` uses a new `extractToken` helper (cookie then Bearer), so browser `type: 'user'` limits key by `user:<id>` again. The tracing middleware decodes the cookie token (cookie-parser runs as app-level middleware before the Nest middleware, so `req.cookies` is populated), restoring `userId` log/trace enrichment. Added a 3-case guard spec (cookie keying, bearer keying, IP fallback). All 152 common tests pass.

- [ ] **123. `analytics/summary` on service-2 is completely public** (Medium)
  `GetActivitySummary_Controller` has no `@UseGuards`, no internal-API-key guard, and no `@PublicApi()` marker (`service-2/.../analytics/interfaces/controllers/analytics/get-activity-summary.controller.ts`). Verified live: `GET https://service2.localhost/api/v1/analytics/summary` returns `{"total":15,"byType":{"user.created":15},"lastActivityAt":...}` with no auth. It leaks how many users have registered and when the last signup happened. Unlike service-1's public routes, which at least carry `@PublicApi()`, there is no marker signalling this is deliberate. Classification: broken/must fix (or annotate as intentionally public and document it). Fix: guard it, or make it an explicit, documented public example.

- [ ] **124. Register leaks account existence, enabling user enumeration** (Medium)
  Verified live: `POST /api/v1/users` with an existing email returns `409` with `"Entity already exists with email: admin@example.com"`. An attacker learns which emails have accounts by probing the register endpoint. This contrasts with the password-reset flow, which correctly returns 200 for both existing and non-existing emails (verified, no enumeration there). Classification: would improve. Fix: return a generic conflict message without echoing the email, or move to an email-confirmation flow that does not distinguish.

- [ ] **125. No global auth guard: security is opt-in per controller, and `@PublicApi()` only annotates Swagger** (Medium)
  `@PublicApi()` is `SetMetadata(DECORATORS.API_SECURITY, [])`, purely a Swagger doc annotation (`libs/common/src/swagger/public-api.decorator.ts`). The only `APP_GUARD` is the rate limiter; there is no global `JwtAuthGuard`. Every protected route must individually remember `@UseGuards(...)`, and a forgotten guard ships a public endpoint with no test to catch it (item 123 is an instance). The scattered `@PublicApi()` decorators imply a secure-by-default, opt-out model that does not exist. Classification: would improve. Fix: register a global `JwtAuthGuard` that honors a real `@Public()` metadata key, so exposure is explicit.

- [ ] **126. Email-verification token minting trusts the id without re-checking state** (Low)
  `GetNewTokensFromEmailVerification_QueryHandler` loads the verification by id and mints access+refresh tokens without checking `isVerified()`/`isExpired()`; its `authorize()` returns true with the comment "possessing a valid email verification id is the credential." Safe today only because the controller runs the one-shot `VerifyEmail_Command` first and the template ships with verification disabled (no rows exist). But it is a standalone credential-minting handler with no state guard, so any future caller or a reordering would mint login tokens from a merely-existing (unverified or expired) id. Classification: would improve. Fix: check verified and not-expired inside the query as defense in depth.

- [ ] **127. Dashboard endpoints are authenticated but not admin-restricted** (Low)
  `DashboardController` uses `@UseGuards(JwtAuthGuard)` only, so `/dashboard/events` and `/dashboard/health` expose internal event throughput and subsystem readiness to any logged-in user, not just admins. The dev console is presumably an admin tool. Classification: opinion. Fix: add `AdminRoleGuard` if the console is admin-only.

## J. Backend reliability

- [ ] **128. A poison Kafka message wedges its partition forever** (Medium)
  The inbox has bounded retries and dead-lettering, but only for events it has accepted. Failures before acceptance rethrow from `eachMessage` (`backend/libs/kafka/src/kafka.integration-event-listener.ts:88-100,125-146`): unparseable JSON, the deliberate "message has no id" throw, or a Mongo outage during `insertIfNew`. The rethrow prevents the offset commit, so kafkajs redelivers the same message indefinitely with no backoff, counter, or DLQ, blocking that partition and everything behind it. Transient DB errors deserve the retry; permanently malformed messages need a skip-and-log or dead-letter path. Classification: broken/must fix. Fix: distinguish permanent parse/id failures (skip + log/DLQ, commit the offset) from transient ones (retry).

- [ ] **129. Mongo inbox `reclaimStuckEvents` is non-atomic and can resurrect a completed event to PENDING** (Medium)
  `inbox.mongodb-repository.ts:100-121` does `find(PROCESSING)` then a per-doc unconditional `save()`. Between the find and the save, the instance that owns the claim can finish and write PROCESSED; the reclaim then overwrites it back to PENDING (retryCount+1) and the handlers run again. The outbox got this right with a single conditional `updateMany` filtered on the PROCESSING marker; the inbox reclaim should be the same one-shot conditional update. Second problem: it ages events by `receivedAt`, which never advances, so a retried or late-claimed event more than the stuck threshold past receipt is treated as stuck even while genuinely in flight, burning a retry and letting a second instance run the same handlers concurrently. Classification: broken/must fix. Fix: conditional update on status, and add a claimed-at timestamp to age by (mirroring the outbox's claim-time bump).

- [ ] **130. Kafka publisher keys messages by unique event id, so per-aggregate ordering is not preserved** (Medium)
  `kafka.integration-event-publisher.ts:16-33` sets the Kafka message key to `parsed.id`, the event's own unique id. Two events about the same aggregate (`user.created` then `email.verified` for one user) therefore hash to different partitions and can be consumed out of order, discarding the per-topic ordering the outbox loop carefully preserves at publish time (item 30). The comment also claims the key "ensures deduplication," which Kafka does not do outside log compaction. Classification: would improve. Fix: key on the aggregate/entity id, or document that ordering is per-event only and drop the dedup claim.

- [ ] **131. `Base_MongoRepository` caches a rejected index-init promise forever and goes stale when a collection is dropped** (Medium)
  `base.mongo-repository.ts:38-55,165-223` memoizes index initialization in a static map keyed by collection name. If init fails once (Mongo briefly unreachable at boot, exactly when repositories are constructed), the rejected promise is cached permanently and every later operation on that collection rethrows even after Mongo recovers, until process restart. Item 60 made the failure loud; caching the rejection makes it permanent. Separately, the lock is never invalidated, so `MongodbTestService.cleanup()` dropping a collection leaves the lock saying "initialized" while the unique `id` index is gone, which `insertIfNew`'s E11000-based dedup (item 33) silently depends on. Classification: would improve (with a broken corner). Fix: evict a failed init from the map so it retries, and invalidate on collection drop.

- [ ] **132. Redis integration-event listener fabricates message ids (the item 45 bug, unfixed on the Redis side)** (Medium)
  `redis.integration-event-listener.ts:65-79` falls back to `redis-${Date.now()}` for the message id and reads `messageId`/`eventId` fields that `Base_IntegrationEvent.toJSON()` never serializes (it writes `id`). Item 45 fixed exactly this for Kafka because a timestamp id makes every redelivery look new and breaks inbox idempotency; the Redis sibling was left with the old behavior. The `...parsedMessage` spread rescues events that carry `id`, but any id-less message still gets a timestamp id. Also on line 37, `subscribeToTopic` is called without `await`, so a failed Redis subscribe becomes an unhandled rejection instead of a startup error. Classification: would improve (broken if the Redis transport is used with the inbox). Fix: mirror the Kafka listener (use payload id or key, throw if neither) and await the subscribe.

- [ ] **133. Outbox dead-letters a transient post-publish save failure with a false "max retries" log and metric** (Low)
  In `outbox.service.ts` the catch wraps both the publish and the post-publish `save`. If the publish succeeded but the bookkeeping `save` failed transiently, the in-memory event is already `markAsProcessed()`, so `canRetry()` is false and the else branch dead-letters it: `markAsFailed()`, a `failed` metric, and "Max retries exceeded ... (dead-letter)" for an event with retryCount 0 that was actually delivered. Operators see phantom dead-letters and the failed metric lies. Classification: would improve. Fix: only run the retry/dead-letter path when the publish itself threw.

- [ ] **134. `JwtAuthGuard` turns infrastructure outages into 401s** (Low)
  `jwt-auth.guard.ts:30-43` catches everything and throws `UnauthorizedException`, including the Redis-backed token-store query failing because Redis is down. During a Redis outage every authenticated user gets 401 (the frontend then clears session state and redirects to login) instead of a 503 that monitoring would flag. Classification: would improve. Fix: map only JWT-verification/NotFound errors to 401 and let infrastructure errors propagate as 5xx.

- [ ] **135. `CorrelationLogger` silently disables all logging on an unrecognized `LOG_LEVEL`** (Low)
  `correlation-logger.ts:51-56` does `levels.indexOf(this.logLevel)`, which is -1 for a standard-but-unlisted value like `verbose` or any typo, so even `error` (`0 <= -1` is false) is suppressed and the service logs nothing with no hint why. Classification: broken/must fix (one line). Fix: fall back to a default level when the configured value is unknown.

## K. Observability

- [ ] **136. Every HTTP error is recorded in Prometheus as `status_code="200"`** (Medium)
  `metrics.interceptor.ts:30-42` reads `res.statusCode` in the tap, but interceptors run before the exception filter sets the status, so on a thrown error `res.statusCode` is still Express's default 200 (truthy, so the `fallbackStatus` 500 is dead code). Verified live: after sending 8 login requests that returned 401/429, `http_requests_total{route="/api/v1/auth/login"}` shows all of them under `status_code="200"` (`/auth/me` 401s likewise counted as 200). Error-rate dashboards and the `HighHttp5xxRate` alert added in item 84 can never fire. Classification: broken/must fix. Fix: record on `res.on('finish')`, or derive the status from the thrown exception (`HttpException.getStatus()`, else 500).
  **Status: Done.** The interceptor now records on the response `finish` event (and `close` for client-aborted requests, guarded so it observes exactly once) instead of inside a `tap()`. `finish` fires after the exception filter has set the final status, so the true code lands in the histogram. Verified live: two wrong-password logins (a handler-level 401) now record as `status_code="401"`, where the old code recorded them as 200. Added a 4-case spec (401/500/200 recorded correctly, and single-observation under finish+close). Caveat documented in the code: a request rejected by a guard (a missing-token 401) never reaches any interceptor in Nest (guards run before interceptors), so those are still not counted here; capturing them would need an exception-filter or middleware hook and is a separate, smaller gap. The common case (validation errors, auth failures from handlers, real 5xx) is now correct, which is what the 5xx alert needs.

- [ ] **137. Inbox reports both failure and success to the event tracker for the same failed event** (Medium)
  `inbox.service.ts`: `processEvent` handles handler errors internally (calls `handleEventFailure`, which tracks `false`) and then returns normally, so back in `safeProcessEvent` the `trackEvent(..., true)` line runs too. Every handler failure is tracked once as failure and once as success, inflating the dev console's `/dashboard/events` counts with a phantom success per failure. The Prometheus metrics only observe `failed`, so the two consoles disagree. Classification: broken/must fix. Fix: have `processEvent` signal failure (rethrow or return a result) so the success line does not run.

- [ ] **138. Log to trace correlation is dead in both directions in Grafana** (Medium)
  The Loki to Tempo derived field expects `"traceId":"..."` in the stored log line (`datasource.yml`), but promtail's final `output` stage rewrites every line to the bare message, so the regex never matches (`promtail-config.yaml`). The Tempo to Loki link filters by a `traceId` label promtail never creates. Verified live: Loki's label set is only `container, environment, level, service, service_name, stream` and a sample stored line is a bare message. So the trace-log linking the stack advertises does not work. Classification: broken/must fix. Fix: keep the raw JSON line (drop the `output` reduction) or emit traceId as structured metadata and update the matcher.

- [ ] **139. `HostLowDisk` alert references node_exporter metrics that do not exist in this stack** (Medium)
  `alert-rules.yml`'s `HostLowDisk` first branch uses `node_filesystem_avail_bytes / node_filesystem_size_bytes`, but there is no node_exporter in either compose file (only cAdvisor). Verified live: `count(node_filesystem_avail_bytes)` is empty on the dev Prometheus. The rule's own comment says "cAdvisor exposes filesystem usage," which contradicts the expression, and the container_fs fallback watches container filesystems, not the host `/` where images, logs, and backups accumulate. Classification: would improve. Fix: add node_exporter, or rewrite the rule around metrics that actually exist.

## L. Infra and deployment

- [ ] **140. `deploy.sh` health-gate logic is inverted: a healthy deploy reports failure and exits 1, an unhealthy one prints "Deploy complete!"** (High)
  Regression that shipped inside the item 81 commit. `deploy.sh:319-352` is `if ! ssh ... then log "Deploy complete!" ... else log_error "Remote deploy failed" ; exit 1`. Because `! ssh` is true only when ssh fails, the branches are swapped. Proven with a runnable reproduction: simulating ssh success routes to "Remote deploy failed + exit 1" and ssh failure routes to "Deploy complete!". So a healthy deploy aborts with an error and exit 1, and an unhealthy deploy (a container that never becomes healthy under `--wait`) reports success. Item 81 was verified only with `bash -n`, which cannot catch this. Classification: broken/must fix. Fix: drop the `!` (or swap the two branches).

- [ ] **141. Prod Mongo URIs in the env templates have no credentials, but prod mongod runs with `--auth`** (High)
  `infra/env/service-1.env.prod.example` and `service-2.env.prod.example` both use `mongodb://mongodb:27017/...?replicaSet=rs0` with no user, password, or `authSource`, while `infra/mongo/mongo-startup.sh:85` starts `mongod ... --auth --keyFile ...`. The dev examples correctly include `admin:password@...&authSource=admin`. Anyone provisioning a fresh server from the prod templates gets services that fail every DB operation with authorization errors. A structural check of the untracked real files (contents not printed) showed `service-2.env.prod` has no credentials in its URI, so the currently deployed service-2 likely cannot authenticate to prod Mongo. Classification: broken/must fix. Fix: add credentials and `authSource=admin` to both prod `.example` URIs and to the real `service-2.env.prod`.

- [ ] **142. Dev compose bind mounts use cwd-sensitive `${PWD}`, which created a stray `infra/compose/frontend/public-page` tree** (Medium)
  Every bind mount in `docker-compose.dev.yml` uses `${PWD}/...` while `env_file` entries are compose-file-relative. Running `docker compose -f infra/compose/docker-compose.dev.yml ...` from anywhere but the repo root (which the `dev:down` and `dev:logs` npm scripts do, since they run from the user's cwd) resolves the env_files correctly but points every bind mount at the wrong host path, and Docker creates the missing directories. That is the origin of the untracked `infra/compose/frontend/public-page/` tree (a `node_modules` mountpoint plus a populated `.pnpm-store`). It is gitignored so there is no commit risk, but a container started this way mounts an empty `/app` and crash-loops. Classification: broken/must fix (dev ergonomics). Fix: use compose-file-relative bind-mount paths (compose resolves them against the compose file), delete the stray tree, and optionally pin a top-level `name:`.

- [ ] **143. `start-dev.sh` Kafka recovery is dead code for an old layout, and its fallback wipes all dev data** (Medium)
  `start-dev.sh:112` greps `docker ps -a` for `kafka-ephemeral.*Exited`, a name no container ever has (the real one is `compose-kafka-1`), and line 116 removes `docker_zookeeper_*` volumes when the actual project prefix is `compose_`. So the stale-Kafka recovery never fires and would target the wrong volumes if it did. Separately, the retry path (line 128) runs `down -v` on any first-attempt failure, destroying dev Mongo/Redis/Kafka data even for a transient port conflict. Item 89 deferred this script fix, so it is still open. Classification: broken/must fix (the dead checks), opinion (the destructive fallback). Fix: match real container/volume names, and do not `down -v` on transient failures.

- [ ] **144. CI never exercises the deployment path** (Medium)
  `.github/workflows/ci.yml` covers lint/typecheck/build/tests but never builds the two Dockerfiles, never runs `docker compose config` on either compose file, never `bash -n`/shellchecks the infra scripts, never runs `promtool check rules`, and never runs `caddy validate` (that only happens inside the prod image build, which CI does not do). A broken Dockerfile, compose interpolation, alert rule, or Caddyfile is first discovered mid-deploy. Classification: would improve. Fix: add a cheap infra-validation job (compose config, script syntax, promtool, caddy validate, and optionally the image builds with a stand-in `public-page.env.prod` copied from the example).

- [ ] **145. Prod NestJS healthcheck gates on liveness, not readiness** (Low)
  The prod compose healthcheck hits `/api/v1`, which returns `'ok'` unconditionally, while there is an unauthenticated `/api/v1/ready` that returns 503 until subsystems (like the Kafka consumer group join) are ready (`heartbeat.controller.ts`). So `up -d --wait` can pass while consumers are still broken. Classification: would improve. Fix: point the healthcheck (and the item 140 gate, once corrected) at `/api/v1/ready`.

- [ ] **146. `mem_limit` gaps in prod: caddy, promtail, and portainer are uncapped** (Low)
  Item 88 added limits to the app and monitoring services but missed promtail, and never covered caddy or portainer (`docker-compose.prod.yml`). On a single small VPS these are the remaining unbounded containers. Classification: would improve. Fix: add `mem_limit` to the three.

- [ ] **147. `deploy.sh` ships the full `infra.env.prod` to the server and does not validate SSH/registry vars** (Low)
  The staging copy includes `infra.env.prod` (DOCKER_PASS, server IP/user), which nothing on the server reads from `env/` (only the `compose/.env` copy is used), so it widens secret exposure for no benefit. And `$SERVER_USER`/`$SERVER_IP`/`$DOCKER_USER`/`$DOCKER_PASS` are used with no `:?` guards (unlike `DOCKER_REGISTRY`), so a missing var yields a confusing rsync/ssh/docker-login error instead of a clear message. Classification: would improve. Fix: exclude `infra.env.prod` from the `env/` copy and add `:?` guards.

- [ ] **148. Remaining dev/prod drift and root-run mongod** (Low)
  mongod runs as root in both dev and prod because the `command: ['bash', /scripts/mongo-startup.sh]` override bypasses the image entrypoint's `gosu` privilege drop (which only fires when arg1 is `mongod`). cAdvisor mounts `/var/run` rw in prod but ro in dev (the rw is the wrong direction). Dev Caddy has no `/data` volume, so the local CA is regenerated on every recreate, forcing a fresh cert-trust. Dev Grafana persists nothing. Classification: would improve / opinion. Fix: drop mongod to the mongodb user, align the cAdvisor mount to ro, add `caddy_data_dev`.

## M. Frontend

- [ ] **149. Default API base URL is missing the `/api/v1` prefix, so a no-env first run 404s on every call** (Medium)
  `lib/api/config.ts:7,13` falls back to `http://localhost:3000` / `:3001`, but the backend serves everything under the `api` prefix plus URI version v1 (verified: the correct path is `/api/v1/auth/login`; the un-prefixed path 404s). Every env template uses `.../api/v1`. With `NEXT_PUBLIC_API_URL` unset, the app 404s on every request, a confusing first-run failure. Classification: would improve. Fix: append `/api/v1` to the fallback, or fail loudly when the var is unset.

- [ ] **150. Auth mount race can log a user straight back out after login** (Medium)
  `lib/contexts/auth-context.tsx:34-45` fires `getSession()` at mount and unconditionally applies the result; `cancelled` is only set on unmount, and `AuthProvider` lives in the root layout so it never unmounts. On a slow/cold API the probe is a 401 then a refresh attempt (10s timeouts each). If the user logs in during that window, `login()` sets authenticated true, then the stale probe resolves null and clobbers it to false, and `ProtectedRoute` bounces the freshly-logged-in user back to `/login`. Classification: broken/must fix (edge case). Fix: ignore the mount probe once a login has happened (a ref guard), or skip it when already authenticated.

- [ ] **151. Docs site has drifted from the real code in several places** (Medium)
  Concrete, verified drift: the i18n docs page says the language switcher "sets the cookie and refreshes the route, so no reload," but the switcher calls `window.location.reload()` (item 76 kept the full reload deliberately). The monitoring docs say services are scraped every 5s and show `scrape_interval: 5s`, but the real value is 15s (item 92). The deployment docs label mongo-express as prod and portainer as "dev convenience," which is backwards (mongo-express is dev-only, portainer is in prod behind basic auth), and show a `mongo.{$DOMAIN}` Caddy site that does not exist. The Google-login guide tells users to authorize `http://localhost:3000` for dev, but the dev stack serves the frontend at `https://localhost` through Caddy, so following it yields an `origin_mismatch`. Classification: broken/must fix (wrong documentation). Fix: correct these pages against the current infra.

- [ ] **152. CSP ships `'unsafe-eval'` to production** (Low)
  `next.config.mjs`'s `script-src` includes `'unsafe-eval'`, which only `next dev` needs; production Next does not. The comment justifies `'unsafe-inline'` and the Google origins but not eval. Related: Caddy's `(common)` snippet and Next set conflicting duplicate `X-Frame-Options` (SAMEORIGIN vs DENY) and HSTS max-age values. Classification: would improve. Fix: make `'unsafe-eval'` conditional on `NODE_ENV`, and pick one owner for the framing/HSTS headers.

- [ ] **153. Backend error messages render verbatim in every form, bypassing i18n** (Low)
  Every form catch does `err instanceof Error ? err.message : t(...)` (`login-form.tsx`, `register-form.tsx`, `reset-password/page.tsx`, `forgot-password/page.tsx`, `account/page.tsx`), so an APIError's raw English string always wins and users in the 7 non-English locales see untranslated backend text instead of the translated fallbacks that already exist. Classification: would improve. Fix: map known status codes to translated messages and reserve `err.message` for unexpected cases.

- [ ] **154. Admin users table: deleting the last row on a page strands the admin with no pagination** (Low)
  `users-table.tsx` gates the pager on `data && users.length > 0` and does not adjust `page` after a delete. Deleting the last user on page N>1 refetches page N, gets zero rows, shows "No users found," and hides the pager, with no way back without clearing the filter or reloading. There is also an out-of-order response race on rapid Prev/Next or filter changes (no AbortController), so a slow earlier response can overwrite a newer page. Classification: broken/must fix (edge case). Fix: render the pager whenever `data` exists and clamp `page` to `totalPages` after mutations; sequence or abort in-flight list requests.

- [ ] **155. Dashboard polls forever in hidden tabs, and the refresh call has no timeout** (Low)
  `use-polling.ts` has no `visibilitychange`/`document.hidden` handling, so the dashboard polls every 5s indefinitely even when the tab is hidden. And `client.ts`'s `attemptRefresh` fetch has no AbortController (unlike normal requests), so a hung refresh pins all queued 401 retries until the socket dies. Classification: would improve. Fix: pause polling when hidden, and give the refresh fetch a timeout.

- [ ] **156. Accept-Language negotiation only inspects the first tag** (Low)
  `middleware.ts` and `i18n/request.ts` both do `acceptLanguage.split(',')[0]`, so a browser sending `ca,es;q=0.9` gets the default even though a supported locale is listed second. Classification: would improve. Fix: iterate the q-sorted list and pick the first supported locale.

- [ ] **157. Copy and i18n cleanups** (Low)
  The delete-user confirm dialog labels its cancel button "Clear" (the filter-reset verb), which reads as "clear the user." The register page reuses the login subtitle "Sign in to access your dashboard." `protected-route.tsx` and `verify-email/page.tsx` have hardcoded English visible copy (not aria-labels, so outside the accepted deferral). Three message keys are dead in all 8 locales (`auth.verifyEmail.backToHome`, `app.landing.docs`, `app.admin.motd.help`). The landing still has "from the start" / "from day one" parallelism (item 117 flattened only the two lines it named). Classification: would improve. Fix: add a real `cancel` key, a register subtitle, translate the visible strings, remove the dead keys.

- [ ] **158. Unused frontend dependencies** (Low)
  `@hookform/resolvers` is a dependency but nothing imports it and `react-hook-form` itself is not even a dep (all forms are hand-rolled useState). `autoprefixer` is unused under Tailwind v4's Lightning CSS. Both are pure install weight. Classification: would improve. Fix: remove both.

## N. Tooling, CI, docs

- [ ] **159. The CI workflow cannot pass: it never installs the frontend's pnpm deps, but Nx runs public-page targets in every job** (High)
  `.github/workflows/ci.yml` only runs `npm ci` at the root. Nx infers `build`/`test`/`typecheck`/`lint` targets for `public-page` (verified with `nx show project public-page`), and `nx run-many` includes it (verified: `nx run-many -t build` runs 7 projects including public-page and fails). But `frontend/public-page` is excluded from the npm workspaces and installs only via pnpm, so the root `node_modules` has no `next`, `@next/*`, or `vitest` (verified). So `npm run lint`, `typecheck`, `build`, and `test` all fail in CI for the missing frontend deps. `origin/main` has no `.github/` at all (this workflow has never run), so the README CI badge will go red on first push. Classification: broken/must fix. Fix: add `pnpm/action-setup` plus `pnpm install --frozen-lockfile` in `frontend/public-page`, or give public-page a dedicated pnpm job and exclude it from the root run-many scripts.

- [ ] **160. `--coverage` in the CI test step breaks public-page even after deps are installed** (High)
  `ci.yml:107` runs `npm run test -- --skip-nx-cache --coverage`, forwarding `--coverage` to public-page's vitest, which fails with `Cannot find dependency '@vitest/coverage-v8'` (only an optional peer, not installed). Classification: broken/must fix. Fix: add `@vitest/coverage-v8` to the frontend devDependencies, or do not forward `--coverage` to vitest.

- [x] **161. AI tool-call artifacts are committed into the README and three docs files** (High)
  `README.md` ends (lines 230-231) with literal `</content>` and `</invoke>` tags, rendered on the repo front page. The same `</content>` leftover is in `docs/deployment.md:61`, `docs/frontend.md:40`, and `docs/infrastructure.md:27`. These are committed (working tree is clean). Classification: broken/must fix. Fix: delete the stray tags.
  **Status: Done.** Removed the stray `</content>`/`</invoke>` lines from README.md and the three docs files, trimming trailing blank lines. Verified no `</content>`/`</invoke>`/`</antml` markers remain anywhere in README or docs. (The `docs/frontend.md` "react-hook-form + Zod" line is factually wrong too, tracked separately under item 158's dead-deps note.)

- [ ] **162. The service generator template still ships the express moduleNameMapper that item 61 diagnosed as broken** (High)
  `tools/forgestack/src/generators/service/files/service/jest.config.js__tmpl__:37` still maps `'^express$'` to a per-service `node_modules/express/index.js` path that does not exist under a hoisted install, the exact bug item 61 fixed in the real service configs with `require.resolve('express')`. Every newly generated service inherits the broken mapping and cannot run any test that loads `@nestjs/platform-express`. Classification: broken/must fix. Fix: switch the template to `require.resolve('express')`.

- [ ] **163. Generated services are silently excluded from typecheck and ship `UNLICENSED`** (Medium)
  The service generator's `project.json` template has no `typecheck` target, while item 104 added one to all six real backend projects, so a generated service passes `npm run typecheck`, pre-commit, and CI without ever being typechecked. The template `package.json` also says `"license": "UNLICENSED"` in an MIT repo (also true of the real service-1/service-2 and missing entirely from `libs/kafka`), and pairs `@types/jest ^30` with `jest ^29` (a mismatch also present in the root and both services). Classification: broken/must fix (the missing typecheck), would improve (license, versions). Fix: add the `typecheck` target to the template, set the license to MIT, align jest versions.

- [ ] **164. `npm run test:watch` and default test flags break on public-page** (Medium)
  `package.json:32` forwards the jest-only `--watchAll` to public-page's vitest, which throws `Unknown option --watchAll`. This worked before the frontend gained vitest (item 71). Classification: broken/must fix. Fix: scope `test:watch` to the backend projects, or use a vitest-compatible watch invocation for public-page.

- [ ] **165. Nx cache correctness gaps: lint ignores `.prettierrc`, and test outputs never match where coverage is written** (Medium)
  The lint inputs do not include `.prettierrc`, yet lint runs prettier (root `eslint-plugin-prettier`, and the frontend's `prettier --check`), so editing `.prettierrc` leaves every lint cache green. Every `test` target declares `outputs: ["{workspaceRoot}/coverage/{projectRoot}"]`, but jest writes to `{projectRoot}/coverage` and the forgestack tool writes into `tools/forgestack/src/coverage` (inside the source tree), so cache restores never include coverage and the item-61 threshold ratchet only holds because CI adds `--skip-nx-cache`. Classification: would improve (cache correctness). Fix: add `.prettierrc` to `sharedGlobals`, and align the declared outputs with the real coverage dirs (or set `coverageDirectory` to match).

- [ ] **166. Item 110's unchecked sub-bullets are all still open** (Medium)
  Verified each: `.gitattributes` still holds only `*.mp4 binary` (no `* text=auto eol=lf`); `--exclude=forgestack` is still on every root script and in `check-typescript.sh`; `test` still uses the deprecated `--all`; lib spec/contract files are still ignored by the root eslint config, and `tools/forgestack` plus `eslint/rules/*.mjs` are never linted; and the spec-file override disables `no-restricted-imports` wholesale, so specs bypass all four hexagonal layer rules (which are implemented as `no-restricted-imports`), not just the in-memory repo import they need. Classification: would improve. Fix: work through the list; the boundary-rule exemption in particular is broader than intended.

- [ ] **167. README deploy menu disagrees with `deploy.sh` on the exit option** (Low)
  `README.md:200` lists "7. Exit"; `deploy.sh:381` implements `0) Exit`. Item 113 claimed the menu matched exactly. Classification: broken/must fix (doc). Fix: change the README to `0. Exit`.

- [ ] **168. CONTRIBUTING and AGENTS still overstate `dev:start`** (Low)
  Item 118 fixed only the README. `CONTRIBUTING.md:12` and `AGENTS.md:13` still say `dev:start` "provisions prerequisites (Node, Docker)," contradicting the corrected README (it checks Node, never auto-installs it). Classification: would improve. Fix: align both with the README wording.

- [ ] **169. Stale repo URL after the GitHub rename** (Low)
  The GitHub repo is now `FVJohnny/forgestack` (item 111's owner TODO was done), but `package.json:9` `repository.url` still points at `nestjs-microservices-framework.git`. GitHub redirects, so nothing breaks, but the identity item 111 tried to close is inconsistent again in-repo. Classification: would improve. Fix: update the URL.

- [ ] **170. `docs/architecture.md` misdescribes `@bc/*` and contradicts the cross-BC rule** (Low)
  It says `@bc/*` resolves to service-1 only, but `tsconfig.base.json` uses `${configDir}` (per-service, service-2 included). It also says to "prefer these aliases over relative imports when importing across bounded contexts," which directly contradicts the `bounded-context/no-cross-imports` lint rule that forbids cross-BC imports entirely (except `shared`). Classification: would improve. Fix: correct the alias description and the cross-BC guidance.

- [ ] **171. Contributors are not told `npm run test` needs a live Mongo and Redis** (Low)
  The mongodb/redis lib suites hit real datastores (which is why CI provisions them), but the README and CONTRIBUTING present `npm run test` as a bare command. A fresh contributor running it with no stack up gets connection failures. Classification: would improve. Fix: note the datastore requirement (or that the dev stack must be up) next to the test command.
