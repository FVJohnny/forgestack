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
| A. Security | 26 | 25 done, 1 partial (item 5) | none (all code done) |
| B. Backend reliability (outbox/inbox/Kafka) | 19 | 19 (44 deferred) | none |
| C. Backend code quality | 15 | 0 | all |
| D. Backend testing | 2 | 0 | all |
| E. Frontend | 15 | 0 | all |
| F. Infra and deployment | 15 | 0 | all |
| G. Tooling, lint, DX | 18 | 0 | all |
| H. Docs, identity, positioning | 8 | 0 | all |

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

- [ ] **48. `RuntimeAutoDiscovery` is fragile** (Medium)
  Runtime `require()` by naming convention, swallowed load errors, breaks under bundlers, and typos become silently missing handlers. Prefer explicit imports or Nest's `DiscoveryService`.

- [ ] **49. EventTracker monkey-patches the EventBus and duplicates metrics** (Medium)
  It overwrites `publish`/`publishAll` at construction, records success before handlers run, and overlaps entirely with the Prometheus CQRS metrics. Consider removing the subsystem.

- [x] **50. HTTP duration histogram is double-counted** (Medium)
  The interceptor recorded each request into `http_request_duration_seconds` twice: once via a `startTimer()` stop callback and once via `observeHttpRequest()`.
  **Status: Done.** Kept the single explicit `observeHttpRequest()` (it carries the status_code label) and removed the timer path. Also deleted the now-unused `startHttpRequestTimer` method so the double-count cannot be reintroduced.

- [x] **51. OTel SIGTERM handler hijacks shutdown** (Medium)
  The OTel bootstrap installed its own `SIGTERM` handler that called `process.exit(0)`, which could kill the process before Nest's `enableShutdownHooks` ran `onModuleDestroy` (Kafka/Mongo/Redis disconnect, outbox drain).
  **Status: Done.** Replaced the SIGTERM+exit handler with a `beforeExit` flush that shuts the SDK down without terminating the process. Nest now owns the SIGTERM → graceful-shutdown flow (shutdown hooks were already enabled in `configureApp`), and the SDK still flushes spans on exit. Verified the service starts and stops cleanly against the running stack.

- [ ] **52. Product features live inside the shared framework lib** (Medium)
  The user-token auth context, app-specific Kafka topics, and example events sit in `libs/common`. Separate "framework" from "example app" or mark them clearly as examples.

- [x] **53. `Data.parseFromString('')` returns 0** (Medium)
  `Number('')` / `Number('   ')` coerce to 0, so an empty filter value matched the number 0 in EQUAL/IN conditions.
  **Status: Done.** `parseFromString` now returns empty/whitespace-only strings as-is before the number check. New spec covers empty, whitespace, numeric, boolean, date, and plain-text cases.

- [ ] **54. `@IntegrationEventHandler` constructs a random event to read metadata** (Medium)
  It instantiates `eventClass.random()` (running validation on random data) just to read topic and name. Make those static.

- [x] **55. Mongo config typed as Mongoose options but passed to the native client** (Medium)
  `getMongoConfig()` returned `MongooseModuleOptions` (with a `dbName` the native `MongoClient` silently ignores), and mongoose/@nestjs/mongoose were declared deps only because of that type.
  **Status: Done.** Retyped `getMongoConfig()` as `MongoClientOptions` and dropped the bogus `dbName` (the db comes from the connection string). Removed `mongoose` and `@nestjs/mongoose` from the mongodb lib and both services (nothing imported them). Verified the service boots and Mongo collections initialize against the running stack; full typecheck and all suites pass.

- [x] **56. Fire-and-forget `RecordUserLogin` command** (Low)
  Login and Google OAuth controllers dispatched it without `await`, so a rejection became an unhandled promise rejection and failures vanished.
  **Status: Done.** Kept it non-blocking (last-login tracking should not delay the login response) but attached a `.catch` that logs via `CorrelationLogger`, so failures are visible and never become unhandled rejections.

- [ ] **57. Value-object equality is shallow and fragile** (Low)
  `ValueObject.equals` uses reference equality plus `constructor.name` (breaks under minification), `DateVO` accepts Invalid Date, and `Id` validates twice.

- [ ] **58. Duplicated types and unsafe casts** (Low)
  Two parallel pagination type modules, `IdentityEntry` declared identically in three layers, and `as` casts in the impersonate controller.

- [ ] **59. `Password.random()` is predictable outside tests** (Low)
  It generates sequential `passwordN` values, used as placeholder passwords for Google-signup users. Use a cryptographically random value.

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

- [ ] **61. No e2e or controller tests in service-1** (Medium)
  The auth flows (including everything section A fixed) have no HTTP-level tests, and there are no coverage thresholds. Add a few e2e tests for login/register/refresh/password-reset and set a coverage floor.

- [ ] **62. Zero tests exactly where the risk is** (Medium)
  No tests for the outbox/inbox processing loops, the Kafka listener/publisher, the guards, the exception filter, or the circuit breaker (which would have caught item 32). `kafka.spec.ts` is a placeholder asserting `true`.

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

- [ ] **71. Zero frontend tests** (Medium)
  The landing page sells "Tests that run in seconds" and the app has none. Add Vitest plus Testing Library with a few examples (api client, auth service, one form).

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

- [ ] **98. Zero tests for the 14 custom ESLint rules** (Medium)
  Which is exactly how item 94 shipped broken. Add RuleTester suites.

- [x] **99. The Nx lint cache ignores `eslint/rules/**`** (Medium)
  **Status: Done.** Added `{workspaceRoot}/eslint/rules/**/*` to the `sharedGlobals` named input, so editing any custom rule invalidates the lint (and default) cache. Also removed the stale `{workspaceRoot}/jest.preset.js` from the test inputs (item 110), since that file does not exist.

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

- [x] **111. Three conflicting identities** (High)
  Repo dir/remote said `nestjs-microservices-framework`, package.json pointed at `forgestack.git`, and the brand is ForgeStack.
  **Status: Done in-repo; one manual step left.** Aligned everything code-side on ForgeStack: AGENTS.md now names ForgeStack, the SMTP from-name defaults to `APP_NAME`/"ForgeStack" instead of "NestJS Framework" (this also closes item 17), and README no longer uses the "dev-console" term. The `fmf` i18n prefix is tracked separately as item 75. USER TODO: the GitHub repo is still named `nestjs-microservices-framework` while package.json and the brand say `forgestack` — rename the GitHub repo to `forgestack` (or, if you prefer the other name, update package.json and the README badges). Only you can rename the repo.

- [x] **112. `service-2` exists but no doc mentions it** (High)
  README, architecture.md, and AGENTS.md described a one-service repo while `backend/services/service-2` (analytics) exists.
  **Status: Done.** The README monorepo tree now shows `service-2` (analytics, "consumes service-1 events over Kafka") as a second service demonstrating cross-service events, and AGENTS.md mentions it. Kept it (it demonstrates the cross-service event flow) rather than removing it.

- [x] **113. README and deployment docs contradict the scripts** (High)
  The README tree showed a nonexistent `infra/docker/` and omitted `tools/forgestack/`; the deploy-menu numbers in the README, `docs/deployment.md`, and `prod-setup.sh` did not match `deploy.sh`.
  **Status: Done.** Rewrote the README `infra/` tree to the real subdirs (compose, caddy, dockerfiles, env, mongo, scripts, monitoring) and added `tools/forgestack/`. Fixed the README deploy menu to match `deploy.sh` exactly (and noted that a single service is deployed by typing its name). Fixed the two wrong option numbers in `docs/deployment.md` (ALL is 5, deploy-only is 6) and the two in `prod-setup.sh`.

- [ ] **114. Two documentation sites that do not know about each other** (Medium)
  Root `docs/` and the MDX site under `frontend/public-page/app/docs/` will drift. Cross-link them and declare one canonical. **Partially done:** `docs/frontend.md` no longer calls the app an "auth-only shell" (it now lists the dashboard and docs routes). Still open: cross-linking the two doc sites and the `commands.md` unlinked reference.

- [ ] **115. Missing adoption docs** (Medium)
  No "make it yours" guide (rename service-1, rebrand, set domain and registry), no "add a bounded context" walkthrough, no troubleshooting section, the one-command `npm run prod:setup` path is undocumented, and pnpm is missing from the prerequisites.

- [ ] **116. No screenshots or demo** (Medium)
  The template ships a dashboard, Grafana boards, and a docs site but the README is text-only. Visuals drive starter-template adoption.

- [ ] **117. Docs violate the repo's own style rules** (Medium)
  Dozens of em-dashes and clever-parallelism marketing lines ("Commands mutate, queries read", "Deployable day one") across README and docs/. Flatten to plain sentences.

- [ ] **118. Community files** (Low)
  No CODE_OF_CONDUCT, SECURITY.md has no concrete contact or supported-versions statement, no CHANGELOG or release process, no README badges (add after CI exists), "provisions prerequisites" overstates what `start-dev.sh` does, and the LICENSE copyright says "FVJohnny" instead of a legal name.
