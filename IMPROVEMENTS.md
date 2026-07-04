# Improvement backlog

Full-repo audit findings. Severity: [H] high, [M] medium, [L] low.
Check items off as they are done.

## A. Security (fix-first items)

- [x] 1. [H] Account takeover via email-verification lookup. The `get-email-verification-by-user-id` controller has no auth guard and returns the verification `id` for any email. `GetNewTokensFromEmailVerification` then mints tokens for whoever holds that id. Guard the endpoint and require an unguessable, pending-state verification.
  - DONE. Deleted the HTTP controller entirely. Nothing external used it: the frontend only calls `/email-verification/verify`, and the bootstrap service uses the query through the in-process query bus, which still works. Token minting stays safe because `EmailVerification.verify()` throws on expired or already-verified, so the verify endpoint is one-shot. Verified with service-1 typecheck and full test suite (507 passed).
- [x] 2. [H] Password-reset token leak. The `get-password-reset-by-email` controller is unguarded and returns the reset token (`id`) for any email, enabling account hijack via `password-reset/execute`. Remove or guard it.
  - DONE. Deleted the controller and the whole `get-password-reset-by-email` query (handler, query, response, spec). Nothing else consumed it: not the frontend, not the barrel index, no other backend code. Reset tokens are now only ever delivered by email. Verified with typecheck and the service-1 suite (503 passed).
- [x] 3. [H] Google OAuth token audience not validated. `google-oauth.service.ts` accepts any Google access token without checking `aud` against the client id (token substitution attack). Verify a real ID token with `google-auth-library`.
  - DONE (tokeninfo variant). The service now calls Google's `tokeninfo` endpoint first and rejects tokens whose `aud`/`azp` does not match `GOOGLE_CLIENT_ID`, which closes the token substitution attack without new dependencies or breaking the current frontend flow (it sends access tokens). The full switch to ID-token verification stays coupled to item 66 (frontend credential flow), still open. Verified with typecheck and the service-1 suite (503 passed).
- [x] 4. [H] `authorize()` return value ignored in CQRS base handlers. `base.command-handler.ts:67` and `base.query-handler.ts:55` await but never check the boolean, so `return false` still authorizes. Check it or make the contract throw-to-deny.
  - DONE. Both base handlers now check the boolean and throw the lib's `ForbiddenException` (403) when `authorize()` returns false. No existing handler returned false, so behavior is unchanged for current code, but `return false` now actually denies. JSDoc updated to document the contract. Verified with full monorepo typecheck and all 7 projects' test suites passing.
- [ ] 5. [H] Rotate the live secrets in the working tree. `infra/env/*.env.prod` and `infra/monitoring/prometheus/internal-api-key` hold a real Docker Hub PAT, DB passwords, JWT secrets, and a plaintext basic-auth password in a comment. Rotate and scrub. The `.env.example` files also contain a real Google client id.
  - PARTIAL, remainder is user action. Verified the repo itself is clean: every tracked `.example` file holds placeholders only, and git history (all 5 commits) never included a real secret. The audit's claim about a real Google client id in `.env.example` was wrong; the real values live only in untracked, gitignored files (`.env`, `.env.local`, `infra/env/*.env.prod`, `internal-api-key`). Left those files untouched so deploys keep working. USER TODO: rotate the Docker Hub PAT, Mongo/Redis/Grafana passwords, JWT secrets, internal API key, Google client secret, and SMTP password in their respective systems, then update the local env files, and delete the plaintext basic-auth password comment from `infra/env/infra.env.prod` after storing it in a password manager.
- [x] 6. [H] Internal API key baked into the Prometheus image and pushed to Docker Hub. `Dockerfile.prometheus` copies the real key into a pushed image. Mount it at runtime like the dev compose does.
  - DONE. Removed the `COPY internal-api-key` from `Dockerfile.prometheus`, added a read-only runtime mount in `docker-compose.prod.yml` (matching dev), and made `deploy.sh` stage the key file to `<remote>/monitoring/prometheus/` (with a fail-fast check if it is missing). Verified: image built locally contains only `prometheus.yml`, prod compose passes `docker compose config`, and `bash -n` passes on deploy.sh. Note: the previously pushed `forgestack-prometheus` images on Docker Hub still contain the old key, which is another reason to rotate it (item 5 user TODO).
- [x] 7. [H] Portainer exposed publicly in prod with Docker-socket (root) access. No auth in front of it, so the first visitor after deploy can claim admin. Remove from prod compose or gate behind Caddy basic auth.
  - DONE (gated, not removed). Wired the previously dead `CADDY_BASIC_AUTH_HASH` to the Portainer site via `admin-auth-{TLS_ENV}` snippets: prod requires basic auth (Caddy refuses to start if the hash is missing, verified), dev stays open on localhost. Added `CADDY_BASIC_AUTH_USER` and better guidance to the env example. Validated the Caddyfile with `caddy validate` in dev mode, prod mode with a hash, and prod mode without one. This also resolves most of item 91 (dead config). Note: takes effect after the next caddy image build and deploy.
- [ ] 8. [H] Frontend stores access, refresh, and admin-impersonation tokens in localStorage. Fully XSS-exfiltratable sessions. Move refresh tokens to httpOnly cookies or at least in-memory, and document the tradeoff.
- [x] 9. [M] Refresh tokens never rotated or revoked on use. A leaked refresh token stays valid until expiry. Implement rotation.
  - DONE. Added a `RevokeToken_Command` + handler to `libs/common` (with its own spec) and the refresh controller now revokes the presented refresh token before storing the new pair, so each refresh token is single-use. Also overrode `remove()` in `UserToken_RedisRepository` to clean the token-lookup key and user token set, which the base remove left orphaned. Known tradeoff: two browser tabs racing to refresh with the same token can log one out; the frontend dedups concurrent refreshes per tab. Verified with typecheck and all 7 projects' tests (new spec included).
- [x] 10. [M] Duplicate password-reset controllers, the `auth/*` pair unvalidated. Plain interfaces mean `whitelist: true` strips the body to empty. Delete the duplicates and keep the DTO-validated `password-reset/*` versions.
  - DONE, with two corrections to the finding. First, the frontend calls the `auth/*` routes, not `password-reset/*`, so I did the inverse of the suggestion: moved the validated DTO classes onto the `auth/*` controllers and deleted the `password-reset/*` duplicates (whose folder was already emptied by item 2). Second, interface-typed bodies are not stripped to empty; ValidationPipe skips them entirely (the metatype erases to Object), so the routes worked but accepted any shape. Now both routes validate (`@IsEmail`, `@IsString`, `@MinLength(8)`). Verified with typecheck and service-1 tests (503 passed).
- [x] 11. [M] Change-password body has no validation DTO. Same whitelist-strips-everything problem, both passwords arrive `undefined`.
  - DONE. Added `ChangePassword_ControllerParams` with `@IsString @IsNotEmpty` on oldPassword and `@IsString @MinLength(8)` on newPassword. Same correction as item 10: the body was not stripped to undefined (interface bodies skip validation entirely), it was simply unvalidated. Verified with typecheck and service-1 tests (503 passed).
- [x] 12. [M] Weak and inconsistent password policy. Backend VO only checks length >= 8. Frontend forms enforce 6, 8, and nothing across register/change/reset. Unify and strengthen.
  - DONE. One policy everywhere: at least 8 characters with a letter and a number, max 72 bytes (bcrypt truncates beyond that). Backend `Password` VO enforces it with new spec cases; frontend has a shared `lib/utils/password.ts` validator now used by register (was 6), change-password, and reset-password (was nothing). Error messages updated in all 8 locales. Existing users are unaffected because login verifies via bcrypt compare, not the creation-time policy. Verified with backend+frontend typecheck and all test suites.
- [x] 13. [M] Login/register accept any string as email. Missing `@IsEmail()`.
  - DONE. Both `LoginUser_ControllerParams` and `RegisterUser_ControllerParams` now use `@IsEmail()`, matching the password-reset params, so malformed emails 400 at the API boundary instead of failing in the domain VO. Verified with typecheck and service-1 tests (506 passed).
- [x] 14. [M] `Base_RedisRepository.clear()` deletes every key in the Redis DB via `keys('*')` + `del`. Scope to the repo's prefix and use SCAN.
  - DONE. `clear()` now deletes only keys matching the repository's own `itemKey('*')` pattern, iterating with SCAN (batches of 500) instead of the blocking KEYS. Added a protected `deleteByPattern` helper and overrode `clear()` in `UserToken_RedisRepository` to also drop its lookup and per-user index keys, which the old wipe-everything behavior covered by accident. Verified with the redis lib suite (60 passed, against a real Redis) and the full test run.
- [x] 15. [M] Mongo `/mongodb/health` returns the full connection string (with credentials) and never pings the DB.
  - DONE. The endpoint now runs a real `db.admin().ping()` (503 on failure) and returns only the database name and uptime; the connection string is no longer echoed. The route was already behind `InternalApiKeyGuard`, so exposure required the internal key, but the URI with credentials had no business in a health response. Verified with the mongodb lib tests (60 passed) and service-1 typecheck.
- [x] 16. [M] Regex injection in Mongo criteria converter. CONTAINS filters pass raw user input into `$regex` (ReDoS). Escape metacharacters.
  - DONE. CONTAINS/NOT_CONTAINS now escape regex metacharacters before building `$regex`, matching the in-memory converter's literal `String.includes` semantics. Added a shared contract test (`.*` must match nothing) that runs against the in-memory, Mongo, and Redis converters; all three suites pass.
- [x] 17. [M] Rate limiting is in-memory per instance, and 'user' mode silently degrades to per-IP because the guard runs before JWT auth sets `tokenData`. Add Redis storage and fix ordering.
  - DONE, both parts. (1) New `ThrottlerStorageRedis` in `@libs/nestjs-redis` (atomic Lua increment+block, mirrors the in-memory storage semantics) plus an optional storage parameter on `ApiRateLimitModule.forRoot`; both services now pass it, so limits hold across instances. In-memory remains the default for anyone not using Redis. (2) `ApiRateLimitGuard` now extracts the userId by verifying the bearer token itself when `tokenData` is not yet set (it runs as APP_GUARD before route guards), so `type: 'user'` limits, used by every preset decorator, actually key by user. Covered by a new storage spec (4 tests against real Redis) and a DI wiring spec; full suite passes.
- [x] 18. [M] All infra secrets injected into Caddy and Grafana containers, including the Docker PAT. Split env files per service.
  - DONE. Removed `env_file: infra.env.prod` from both containers in the prod compose. Caddy now gets an explicit `environment:` list (DOMAIN, PROTOCOL, TLS_ENV, basic-auth user/hash) and Grafana keeps only its existing explicit GF_* list; both interpolate from `compose/.env`, which deploy.sh already writes. Neither container sees the Docker PAT or database credentials anymore. Validated with `docker compose config`.
- [x] 19. [M] `.dockerignore` whitelists `infra/env/**` into every build context. One future `COPY . .` leaks prod secrets into an image. Narrow the whitelist.
  - DONE. The whitelist is now `infra/caddy/**`, `infra/monitoring/**`, and only `infra/env/public-page.env.prod(.example)` (the one file a Dockerfile actually copies, build-time NEXT_PUBLIC_* values). Also excluded the real `internal-api-key` from the context since `!infra/monitoring/**` would have swept it in. Verified by building a probe image and listing the context: no `infra.env.prod`, no `service-*.env.prod`, no real key.
- [x] 20. [M] JWT secret handling inconsistent. `jwt-auth.module.ts` has a published dev fallback secret while `jwt-token.service.ts` throws if unset. Unify on required-env.
  - DONE. Added a shared `requiredEnv` helper used by both the module and the token service; the published dev fallback is gone. Also switched `JwtModule.register` to `registerAsync` because the static call read `process.env` at import time, before ConfigModule loads `.env`, which in bare local runs could register the guard with the fallback secret while the signer used the real one (broken auth). Dev `.env.example` and `jest.env.js` already set the secrets everywhere, so nothing breaks. Verified with typecheck and the full test run.
- [x] 21. [M] `setup-server.sh` does no SSH hardening and grants the deploy user passwordless sudo ALL. Disable root/password SSH login, add fail2ban and unattended-upgrades, drop the sudoers file.
  - DONE. The deploy user no longer gets sudo at all (deploys only need the docker group and rsync into the deploy dir; the script also removes the legacy NOPASSWD grant on re-run). SSH hardening drops in after the key install so it cannot lock you out: password auth off, root by key only. fail2ban (sshd jail) and unattended security upgrades are installed and enabled. Also fixed the wrong "choose 7 = ALL" hint and added a warning that Docker port publishing bypasses UFW. Verified with `bash -n` and by checking deploy.sh uses no sudo anywhere; not exercised against a live server, so watch the first re-provision run.
- [x] 22. [L] API key comparison not constant-time (`internal-api-key.guard.ts`).
  - DONE. The guard now compares SHA-256 digests with `crypto.timingSafeEqual` (hashing first yields the equal-length buffers timingSafeEqual requires, without leaking key length). Verified with the common lib tests and typecheck.
- [x] 23. [L] Frontend has no security headers/CSP. The only `headers()` rule targets nonexistent .mp4 files.
  - DONE. Removed the dead .mp4 rule and added CSP, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, and HSTS on all routes. The CSP is pragmatic rather than nonce-strict (Next inline scripts, Google Sign-In, flagcdn flags, cross-origin API in prod plus http://localhost in bare dev are all allowed), with a comment telling forkers to tighten connect-src. Verified by building and serving the standalone output and curling the headers.
- [ ] 24. [L] `record-identity` trusts client-supplied `X-Forwarded-For`. Spoofable audit IPs, needs trusted-proxy config.
- [ ] 25. [L] Redis password visible in `docker inspect` via compose command/healthcheck interpolation. User tokens stored keyed by raw JWT with no TTL.
- [ ] 26. [L] Dev Mongo/Redis published on all interfaces with default creds, mongo-express hardcodes admin/admin. Bind to 127.0.0.1 in dev.

## B. Backend reliability (outbox/inbox/Kafka)

- [ ] 27. [H] Inbox is in-memory only and cannot be swapped. `InboxModule` hardcodes the in-memory repo, the Mongo inbox repo is never wired, and Kafka offsets commit after an in-memory save, so restarts lose events. Add `forRoot({ repository })` like the outbox.
- [ ] 28. [H] Poison outbox events retry forever. Exhausted-retry events sit in PROCESSING and the 5-minute stuck-reclaim resets them endlessly. Add a terminal FAILED/dead-letter state.
- [ ] 29. [H] Outbox retry-reset clobbered by the following `save()`. Retries only ever happen via the 5-minute reclaim path. Make reset plus retry-count one atomic update.
- [ ] 30. [H] `OutboxService.processEvent` drops its promise. Batch processing is not sequential, `isProcessing` releases mid-flight, per-topic ordering is lost. One missing `return`.
- [ ] 31. [H] No recovery for PROCESSING/FAILED inbox events. A crash between claim and completion strands events forever. Add stuck-reclaim and bounded retry.
- [ ] 32. [H] `CircuitBreakerInterceptor` replays the first request's handler. The opossum breaker caches the first request's closure and fires it for every later request. Needs the fire-argument pattern.
- [ ] 33. [M] Inbox dedup is check-then-act, not atomic. Concurrent duplicate deliveries can double-process. Use unique-index insert plus duplicate-key handling.
- [ ] 34. [M] Events with no registered handler are marked FAILED permanently. Skip or ack unknown events instead.
- [ ] 35. [M] Nothing ever calls the outbox/inbox cleanup methods, so collections grow unbounded. Schedule cleanup.
- [ ] 36. [M] Kafka consumer readiness is wrong. Ready flips before group join, and a failed `startConsumer` never retries. Use GROUP_JOIN/CRASH events.
- [ ] 37. [M] Kafka group id defaults to `default-group`, so services with unset `KAFKA_SERVICE_ID` steal each other's messages. Fail fast instead. Also the consumer is created even for publish-only services.
- [ ] 38. [M] Kafka SSL/SASL config conflates auth with tuning. Retry/timeout config only applies when credentials are set, TLS-without-SASL unsupported.
- [ ] 39. [M] Mongo outbox claim does up to 100 sequential `findOneAndUpdate`s every 100 ms. Batch-claim with a token and make interval/batch configurable (inbox's 10/500ms is hardcoded too).
- [ ] 40. [M] `outbox_queue_size` metric reports claimed batch size, not backlog.
- [ ] 41. [M] Redis outbox index maintenance is non-atomic. Reset/reclaim need Lua like the claim path.
- [ ] 42. [M] "Distributed transaction" is sequential best-effort, not 2PC. The Redis participant ignores exec errors and reads bypass the pipeline. Document the real guarantee and fix the participant.
- [ ] 43. [M] `handleEventFailure` un-awaited in the inbox catch path (floating promise plus leftover commented-out `throw`).
- [ ] 44. [L] Outbox uses magic sentinel dates (`new Date(0)`/`(1)`) for state while the inbox uses a status enum. Unify on the enum.
- [ ] 45. [L] `unsubscribeFromTopic` logs success but does nothing. Misleading fallback message-id logic. Dead `messageId` DTO field.

## C. Backend code quality

- [ ] 46. [M] `EntityExample` (the template everyone copies) loses identity on rehydration. The constructor drops `props.id`/timestamps, so `fromValue()` returns a different aggregate.
- [ ] 47. [M] Default "admin" bootstrap user is created as a regular user and cannot use any admin endpoint. Assign the admin role.
- [ ] 48. [M] `RuntimeAutoDiscovery` is fragile: runtime `require()` by naming convention, swallowed load errors, breaks under bundlers. Prefer explicit imports or Nest `DiscoveryService`.
- [ ] 49. [M] EventTracker monkey-patches the EventBus and duplicates Prometheus metrics. Consider removing the subsystem.
- [ ] 50. [M] HTTP duration histogram double-counted (two observations per request in `metrics.interceptor.ts`).
- [ ] 51. [M] OTel SIGTERM handler calls `process.exit(0)`, racing Nest shutdown hooks (Kafka/Mongo/Redis disconnect, outbox drain).
- [ ] 52. [M] Product features live in the shared "framework" lib: user-token auth context, app-specific topics, example events inside `libs/common`. Separate framework from example app.
- [ ] 53. [M] `Data.parseFromString('')` returns `0`, so empty-string filters become the number 0 in Mongo queries.
- [ ] 54. [M] `@IntegrationEventHandler` bootstraps by constructing a `random()` event just to read topic/name. Make those static.
- [ ] 55. [M] Config typed as `MongooseModuleOptions` but passed to native `MongoClient`. `dbName` silently ignored, mongoose peer deps exist only for this. Fix the type and drop the deps.
- [ ] 56. [L] Fire-and-forget `commandBus.execute(recordLogin)` swallows errors in login/OAuth controllers.
- [ ] 57. [L] `ValueObject.equals` uses reference equality plus `constructor.name`. DateVO accepts Invalid Date. Id validates twice.
- [ ] 58. [L] Duplicate pagination type modules, duplicate `IdentityEntry` in three layers, `as` casts in the impersonate controller.
- [ ] 59. [L] `Password.random()` generates sequential guessable placeholders outside tests (used for Google-signup users).
- [ ] 60. [L] Misc: `initializeIndexes` swallows errors, `exists()` fetches whole docs, `NotFoundException` prints "undefined", problem+json label on a non-RFC-7807 body, `console.*` instead of the structured logger in main.ts/otel/discovery, `RedisService` warns "graceful" then throws, Redis test DB collision `(pid+counter)%16`.

## D. Backend testing

- [ ] 61. [M] No e2e or controller tests in service-1. The auth flows (including the vulnerabilities above) are untested, and there are no coverage thresholds.
- [ ] 62. [M] Zero tests where the risk is: outbox/inbox processing loops, Kafka listener/publisher, guards, exception filter, circuit breaker. Placeholder specs exist (`kafka.spec.ts` is `expect(true)`).

## E. Frontend (website and dev console)

- [ ] 63. [H] English landing hero subtitle is literally "Idk what to write here yet". All 7 other locales have real copy.
- [ ] 64. [H] No refresh-and-retry on 401. First access-token expiry mid-session hard-logs users out to `/login` despite a valid refresh token.
- [ ] 65. [H] `typescript.ignoreBuildErrors: true` in next.config. tsc currently passes clean, so remove it and add a typecheck script.
- [ ] 66. [M] Google sign-in sends an access token labeled `idToken`. Use the credential flow (pairs with item 3).
- [ ] 67. [M] Two parallel auth service implementations plus a duplicated admin service. Consolidate into one service layer.
- [ ] 68. [M] Dead code to delete: `notifications.tsx` (~160 lines, zero imports), `login-background.tsx`, shadcn leftover `styles/globals.css`, unused `logo.png`/`logo-dark.png`, unused API endpoint, unused message keys.
- [ ] 69. [M] Five `@radix-ui/*` packages and `sonner` pinned to `"latest"`. Fresh installs can pick up breaking majors. Pin versions.
- [ ] 70. [M] Docker build depends on a gitignored env file, so `docker build` fails on a fresh clone. Fall back to the `.example`.
- [ ] 71. [M] Zero frontend tests while the landing page sells "Tests that run in seconds". Add Vitest and Testing Library with a few examples.
- [ ] 72. [M] `auth.resetPassword` missing from 6 of 8 locales (silent English fallback). Add a locale-key CI check.
- [ ] 73. [M] Register/verify-email flow contradiction. A comment says verification is disabled with auto-login, yet a full verify-email flow and "check your email" copy exist, plus a dead `?registered=true` handler. Pick one story.
- [ ] 74. [M] SEO essentials missing: per-page metadata, `not-found.tsx`, robots.txt, sitemap, OG/Twitter cards.
- [ ] 75. [M] `fmf.*` translation namespace is unexplained legacy naming. Rename to match the brand.
- [ ] 76. [L] Language switcher issues: external flagcdn.com dependency, full reload on switch, potential infinite reload loop if cookies are blocked, flags-for-languages anti-pattern, duplicated Accept-Language parsing.
- [ ] 77. [L] Misc: `ngrok-skip-browser-warning` header on every request, 401 returns `{} as T` to callers, hardcoded English in error page and aria-labels, a11y gaps in admin table and mobile drawers, register-then-login failure shows the wrong error, `window.location.href` where the router would do, misnamed `GlobalError`, `components.json` alias points at a nonexistent dir, frontend `lint` script is prettier-only.

## F. Infra and deployment

- [ ] 78. [H] `wait || exit` never detects failed parallel builds in deploy.sh. Bare `wait` always returns 0, so failed builds deploy anyway.
- [ ] 79. [H] Version bump happens before the build, so a failed build leaves compose pointing at a never-pushed tag. Bump after push, or tag by git SHA.
- [ ] 80. [H] No log rotation in prod compose or the docker daemon. Unbounded disk growth on the VPS.
- [ ] 81. [M] No rollback or post-deploy health verification. Use `up -d --wait`, keep the previous tag, revert on failure.
- [ ] 82. [M] Deploy sed-mutates a git-tracked compose file with counter tags (v4, v5, v10). Meaningless to template cloners and dirties the repo. Use `${TAG}` interpolation.
- [ ] 83. [M] `deploy.sh` hardcodes `/opt/forgestack` in the remote heredoc despite `REMOTE_PATH`.
- [ ] 84. [M] No alerting anywhere: no rules, no Alertmanager, the Loki ruler points at a nonexistent host. Add minimal alerts (instance down, disk, restarts, 5xx).
- [ ] 85. [M] No backup story for Mongo/Grafana volumes. Add a mongodump cron/script and restore docs.
- [ ] 86. [M] Tempo metrics_generator remote-writes to Prometheus but the receiver flag is never enabled, so service-graph metrics silently fail.
- [ ] 87. [M] Promtail positions file lives in `/tmp` and is not persisted, causing duplicate log ingestion on every restart.
- [ ] 88. [M] No resource limits on any prod container. Kafka/Mongo/monitoring on one small VPS can OOM the box.
- [ ] 89. [M] Dev persists ZooKeeper but not Kafka data, guaranteeing a cluster-ID mismatch on recreate. `start-dev.sh` recovery greps stale container/volume names (dead code) then falls back to `down -v`, destroying all dev data.
- [ ] 90. [M] Grafana 10.4 (EOL, CVEs) and cp-kafka 7.4.0 (2023, ZooKeeper). Bump Grafana and consider KRaft (deletes the zookeeper container entirely).
- [ ] 91. [M] `CADDY_BASIC_AUTH_HASH` is dead config. The env template tells users to generate it but the Caddyfile never uses it. Wire it up (ideal for Portainer) or delete it.
- [ ] 92. [L] Misc infra: caddy healthcheck only checks the binary, docker socket mounted rw for promtail, Prometheus/Tempo run as root, 5s scrape/housekeeping intervals aggressive, no explicit retention for Prometheus/Loki/Tempo, dev Prometheus has no data volume, cAdvisor version/flags differ dev vs prod, one dashboard missing `uid`, Dockerfile uses deprecated `npm prune --production` plus shell-form CMD plus hardcoded per-lib COPY lines, Caddyfile lacks compression and security headers, UFW claim bypassed by Docker port publishing, `flock` missing on macOS, `sleep 3` instead of `--wait`, stale mongo-express vars in the prod env template.

## G. Tooling, lint, DX

- [ ] 93. [H] No CI at all. No `.github/`: no workflows, badges, issue/PR templates, dependabot. The single highest-leverage addition.
- [ ] 94. [H] `no-direct-entity-mutation` ESLint rule never fires. It looks for base class `SharedAggregateRoot` but the real class is `SharedAggregate`. Empirically verified dead, and it is a headline feature of the template.
- [ ] 95. [H] Pre-commit hook `git add`s everything, destroying partial commits. Use lint-staged (already a devDependency, unused).
- [ ] 96. [H] Hooks not installed on plain `npm install`. No `prepare` script, and `start-dev.sh` uses the deprecated `npx husky install` (removed in husky v10).
- [ ] 97. [M] Pre-commit runs full-repo typecheck+lint+tests and uses bashisms that break under dash on Linux. Use `nx affected` and POSIX sh.
- [ ] 98. [M] Zero tests for the 14 custom ESLint rules, which is exactly how item 94 shipped broken. Add RuleTester suites.
- [ ] 99. [M] Nx lint cache ignores `eslint/rules/**`, so editing a rule serves stale cached lint results.
- [ ] 100. [M] `no-cross-bc-imports` bypassable via relative paths, `export from`, and dynamic `import()`. `handler-collocation` bypassable via alias imports.
- [ ] 101. [M] No lint rule for integration events extending `Base_IntegrationEvent`. Domain events have one, add the symmetric rule.
- [ ] 102. [M] ~11 unused ESLint devDependencies, `eslint-plugin-import` registered with zero rules, frontend linted with the backend config (no React/Next rules, and a dead `react-hooks` override references an unregistered plugin).
- [ ] 103. [M] `eslint` and `prettier` only transitive. No `engines`/`packageManager` in root package.json.
- [ ] 104. [M] `check-typescript.sh` never typechecks `backend/libs/*` and greps output instead of using exit codes. Convert to cached Nx typecheck targets.
- [ ] 105. [M] Two package managers: npm at root, pnpm in `frontend/public-page` (excluded from workspaces). Pick one or pin and document the split.
- [ ] 106. [M] forgestack CLI has no `bounded-context` (or command/query) generator. The day-to-day unit of growth is fully manual. The service generator is good, extend it.
- [ ] 107. [M] Generator's next-steps output points at `npm run dev` (does not exist) and `/docs/guides/adding-a-service` (does not exist in `docs/`).
- [ ] 108. [M] `tsconfig.base.json` is not fully `strict`, and `lib` includes `dom` for backend code with an es2020 lib vs ES2023 target.
- [ ] 109. [M] Duplicate Nx installations: wrapper plus `installation` key plus devDependency. Drop the wrapper.
- [ ] 110. [L] Misc DX: rule doc URLs 404 (old repo name), `nx.json` references nonexistent `jest.preset.js`, `analyze-test-performance.sh` unreferenced and fragile, `.gitattributes` lacks `* text=auto eol=lf`, root nx project forces `--exclude=forgestack` everywhere and `test` uses deprecated `--all`, generated service template says `UNLICENSED` with `@types/jest@30` vs `jest@29`, libs spec/contract files and the forgestack tool itself are never linted, spec files exempt from ALL boundary rules (over-broad override).

## H. Docs, identity, positioning

- [ ] 111. [H] Three conflicting identities: repo dir/remote `nestjs-microservices-framework`, package.json `repository: .../forgestack.git`, brand ForgeStack. Also `service-1`/`service-2` as names, the `fmf` i18n prefix, "dev-console" vs `public-page`, AGENTS.md never saying ForgeStack, SMTP from-name defaulting to "NestJS Framework". Decide the identity once and apply everywhere.
- [ ] 112. [H] `service-2` exists but no doc mentions it. README/architecture/AGENTS all describe a one-service repo while `backend/services/service-2` (analytics), its env files, and a Caddy route exist. Document it or remove it.
- [ ] 113. [H] README factual errors: the tree shows nonexistent `infra/docker/`, omits `tools/forgestack/`, and the deployment menu does not match `deploy.sh`. Also wrong inside `docs/deployment.md` itself ("choose 6 = ALL" when ALL is 5), and the scripts print the same wrong numbers (`prod-setup.sh`, `setup-server.sh`).
- [ ] 114. [M] Two documentation sites that do not know about each other: root `docs/` and the MDX site in `frontend/public-page/app/docs/`. Cross-link and declare one canonical. `docs/frontend.md` is stale ("auth-only shell" vs a full dashboard plus docs site). `commands.md` cites a docs page with no link.
- [ ] 115. [M] Missing adoption docs: no "make it yours" guide (rename service-1, rebrand, set domain/registry), no "add a bounded context" walkthrough, no troubleshooting section, undocumented `npm run prod:setup` one-command path, pnpm missing from prerequisites.
- [ ] 116. [M] No screenshots or demo GIF. The template ships a dashboard, Grafana boards, and a docs site but the README is text-only.
- [ ] 117. [M] Docs violate the repo's own style rules: 31 README lines with em-dashes plus clever-parallelism marketing lines ("Commands mutate, queries read", "Deployable day one"). Same across docs/*.md.
- [ ] 118. [L] Community files: CODE_OF_CONDUCT missing, SECURITY.md has no concrete contact or supported-versions statement, no CHANGELOG or release process, no README badges (after CI exists), "provisions prerequisites" overstates what `start-dev.sh` does, LICENSE copyright says "FVJohnny" instead of a legal name.
