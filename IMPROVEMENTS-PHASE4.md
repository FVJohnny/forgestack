# Improvements Phase 4

This is a fresh, from-scratch audit of ForgeStack, a NestJS microservices starter template. Three prior audit passes (items up to 197) already ran and were fully applied, and their tracking files were deleted, so this pass does not reconstruct that backlog. Instead it reads `git log` to see what past work touched, avoids re-proposing anything already done, and hunts for what those passes missed.

The pass was run against the actual files, with claims verified by grep across the whole repo and, where useful, against the running dev stack (API at `https://service1.localhost/api/v1` and `https://service2.localhost/api/v1`, frontend at `https://localhost`). Findings that assert something is dead were checked with a repo-wide grep that excludes `node_modules`, `dist`, and barrel or spec files, since a barrel re-export is not a real caller. Runtime claims were confirmed with `curl`.

The angle that leads: things that are dead, unused, or over-scoped for a demo, because those add weight a forker must understand and delete. After that come correctness and drift issues where the bar is "a forker would thank you for this," not style nits. Two example services, example bounded contexts, and teaching verbosity are intentional scaffolding, so each item says whether something teaches or just clutters.

Numbering starts at 200 to stay clearly separate from prior passes. Each item has a checkbox, a numbered title, a description that quotes real code and paths, a severity (High, Medium, Low), and a classification (change, improve, delete). Sections are grouped by theme. Within each section, broken and must-fix come before would-improve, and High before Low.

## Resolution

All 26 items are applied across five commits (one per section). The full workspace is green after the changes: typecheck, lint, the ESLint rule tests, and all Jest suites pass, and the service-2 analytics fix was verified end to end against the running dev stack. A few items were resolved differently from the audit's default recommendation:

- 201 and 209: record-identity was kept rather than deleted. It is now driven server-side from the login flow (the login controller reads the request IP and User-Agent and dispatches RecordIdentity_Command), so a user's ips and userAgents populate on each login and the admin table's IPs column is real. The command dropped its unused fingerprint and deviceId fields. The separate user-identity-marker aggregate, which no handler injected, was deleted.
- 202 and 203: the Redis criteria converter and Redis outbox adapter were kept as documented opt-in alternatives (header comments explain they are not wired by default), not deleted.
- 208: the fix ran deeper than the audit found. A JWT-protected browser route was added on service-2 and the shared Redis token store was wired in so the guard honors revocation, but the root cause was that the auth cookie had no Domain and so was host-only to service1.localhost. It is now scoped to a parent domain through a new COOKIE_DOMAIN env var (.localhost in dev, .example.com in prod), which lets the browser send it to service2.localhost.
- 212: the notifications projection was kept as a teaching example; only its misleading "for email lookup" comment was corrected to describe what the projection actually demonstrates.

## Progress summary

| Section                  | Items   | High | Medium | Low |
| ------------------------ | ------- | ---- | ------ | --- |
| Dead and unused code     | 200-207 | 0    | 5      | 3   |
| Backend correctness      | 208-213 | 1    | 1      | 4   |
| Generator template drift | 214-217 | 2    | 1      | 1   |
| Infra and monitoring     | 218-221 | 0    | 1      | 3   |
| Docs and drift           | 222-225 | 1    | 1      | 2   |
| Total                    | 26      | 4    | 9      | 13  |

## Dead and unused code

- [x] **200. The whole `circuit-breaker` subsystem is dead and pulls in `opossum` for nothing.**
      `backend/libs/common/src/circuit-breaker/` ships a config, interceptor, module, and service (around 350 lines plus a spec), re-exported at `backend/libs/common/src/index.ts:3` with `export * from './circuit-breaker';`. Grepping `CircuitBreaker`, `@CircuitBreaker`, `CircuitBreakerModule`, `CircuitBreakerInterceptor`, and `CircuitBreakerService` across `backend/services/**` and the other three libs (source only, excluding `dist`) returns zero hits. No service imports the module, no method carries the `@CircuitBreaker()` decorator, nothing calls `CircuitBreakerService.execute`. It also declares a real runtime dependency: `backend/libs/common/package.json:26` has `"opossum": "^8.1.4"` and line 65 has `"@types/opossum"`. The other resilience patterns (inbox, outbox, transactions) are each demonstrated by a real service, so a forker can learn them by reading working code. Circuit breaker is the one that is never wired to anything, so it teaches nothing and costs a dependency plus 350 lines to understand and delete.
      Severity: Medium. Classification: delete (or wire one real usage into a service so it actually teaches, but delete is the honest call for a demo).

- [x] **201. The `record-identity` command, its controller, and the entire `user-identity-marker` aggregate are orphaned.**
      `backend/services/service-1/src/bounded-contexts/auth/interfaces/controllers/identity/record-identity.controller.ts` exposes `POST /identity/record`, backed by `.../application/commands/record-identity/*`. Nothing in the app calls it: grep for `/identity/record`, `RecordIdentity`, and `recordIdentity` across `frontend/**` and `backend/services/**` finds only the definition sites. Login and get-me never record identity, so the `ips` and `userAgents` arrays that `list-users` surfaces are always empty in real usage. Worse, there is a whole `user-identity-marker` aggregate built for exactly this purpose (`.../auth/domain/aggregates/user-identity-marker/*` plus mongodb and in-memory repositories), and `auth.module.ts:63` registers `USER_IDENTITY_MARKER_REPOSITORY` with `useClass: UserIdentityMarker_MongodbRepository`. No handler injects it: the only `findByUserId` callers in the context belong to `emailVerificationRepository`, and the command handler writes to `user.recordIdentity()` on the User aggregate instead. So an entire aggregate plus its two repositories exists purely to be registered, never read. This is a self-contained subsystem a forker has to reverse-engineer and then delete.
      Severity: Medium. Classification: delete (drop the identity-marker aggregate and its repositories; either wire `record-identity` into a real flow such as login, or delete it too).

- [x] **202. `RedisCriteriaConverter` is a 415-line file whose feature is documented as unsupported.**
      `backend/libs/redis/src/criteria/criteria-converter.redis.ts` is 415 lines of scan, filter, and cursor logic, but no repository instantiates it. `Base_RedisRepository.findByCriteria` and `countByCriteria` explicitly `throw new ApplicationException('...not implemented for Redis repositories')` (`base.redis-repository.ts:31,35`). The class is not even re-exported from `backend/libs/redis/src/index.ts`; its only references are its own spec. It also carries a dead private `compareIds` method hard-coded to an `/^entity-(\d+)$/` demo-fixture pattern (around line 279). A forker reading it will assume Redis criteria queries work, when in fact they throw.
      Severity: Medium. Classification: delete.

- [x] **203. `Outbox_RedisRepository` is a 251-line adapter no service or generator wires in.**
      `backend/libs/redis/src/outbox/outbox.redis-repository.ts` (251 lines) has zero real callers. Both services and the generator template select `Outbox_MongodbRepository`. It is exported from the barrel and self-tested through the shared outbox contract, but nothing chooses it, so it carries subtle Lua and index code (see item 210) that no running service exercises. The Redis integration-events module is documented as an opt-in swap-in alternative; this outbox adapter is not, so it reads as production code that is actually orphaned.
      Severity: Medium. Classification: delete (or document it as an opt-in alternative with wiring instructions, the way the Redis integration-events module already is).

- [x] **204. Two full pagination models exist; six exported types from one of them are never used.**
      `backend/libs/common/src/general/interfaces/pagination.types.ts` exports `ControllerPaginationParams` (a class with live `@ApiProperty` and class-validator decorators), and `backend/libs/common/src/general/application/pagination/pagination.types.ts` exports `PaginationOrder`, `PaginationOffsetParams`, `PageResultOffset`, `PaginationCursorParams`, and `PageResultCursor`. Grepping each name across `backend/**` (excluding the definition files, their barrels, and `dist`) returns zero external references for all six. The pagination the services actually use lives under `general/domain/criteria/pagination/` (`PaginationOffset`, `PaginationCursor`) and `Criteria`, a completely separate implementation. A forker sees two pagination systems and cannot tell which to use, and `ControllerPaginationParams` looks like a supported request DTO because of its decorators, yet nothing wires it.
      Severity: Medium. Classification: delete.

- [x] **205. The `lib/api/index.ts` barrel in the frontend is imported by nothing.**
      `frontend/public-page/lib/api/index.ts` re-exports client, config, types, error-handler, and `analyticsService`, but every consumer imports the concrete sub-path directly (`@/lib/api/client`, `@/lib/api/services/analytics.service`, and so on). A repo-wide grep for the bare specifier `'@/lib/api'` returns zero hits across `app/`, `lib/`, and tests. The file is dead weight, and its `analyticsService` re-export duplicates what `analytics.service.ts` already exports. A forker will assume this barrel is the intended import surface and be confused that nothing uses it.
      Severity: Medium. Classification: delete.

- [x] **206. The `search-users` admin endpoint duplicates `list-users` email filtering and has no caller.**
      `backend/services/service-1/src/bounded-contexts/auth/interfaces/controllers/admin/search-users/search-users.controller.ts` exposes `GET /admin/users/search`, backed by a query, handler, response, and a `searchByEmail` method on both the mongodb and in-memory user repositories. The frontend never calls it: grep of `frontend/**` for `users/search`, `searchUsers`, and `search-users` is empty (the admin UI only calls `LIST_USERS` with `filterField=email`). `list-users.query-handler.ts` already filters by email with `CONTAINS`, which fully subsumes search-by-email-pattern. So the controller, query, handler, response, and both `searchByEmail` implementations are redundant.
      Severity: Low. Classification: delete.

- [x] **207. `@mdx-js/react` is declared but never imported.**
      `frontend/public-page/package.json:5` declares `"@mdx-js/react": "^3.1.1"`, but it is not imported anywhere in `app/`, `lib/`, `i18n/`, `next.config.mjs`, or `mdx-components.tsx`. It is an optional peer of `@next/mdx`, but `@next/mdx` only references it in a webpack alias fallback that fires when `providerImportSource` is set, and this config never sets it while shipping a root `mdx-components.tsx` that resolves first. Note that `@mdx-js/loader` and `shiki` also do not appear in source but are load-bearing transitively (the loader is used because `mdxRs` is off, and `shiki` is a peer of `rehype-pretty-code`), so those two must stay.
      Severity: Low. Classification: delete (verify a build still succeeds after removal).

## Backend correctness

- [x] **208. The dashboard analytics widget is permanently unauthorized because service-2 never copied service-1's browser-facing endpoint pattern.**
      `backend/services/service-2/src/bounded-contexts/analytics/interfaces/controllers/analytics/get-activity-summary.controller.ts:21-22` guards `GET /analytics/summary` with `@UseGuards(InternalApiKeyGuard)`. The frontend dashboard calls `analyticsService.getSummary()` from the browser through `service2ApiClient`, which sends only cookies and no internal API key, so every browser call returns 401. Confirmed live: with a valid admin session cookie, `service1.localhost/api/v1/dashboard/events` returns 200 while `service2.localhost/api/v1/analytics/summary` returns 401 with `"Invalid or missing internal API key"`. Service-1 solved this exact problem by adding a JWT-protected `DashboardController` whose own comment says the internal-key routes are re-exposed so "the UI reads the same data through these authenticated endpoints instead." Service-2 never got the equivalent, so the user-activity widget on the dev dashboard always shows its error state.
      Severity: High. Classification: change (add a JWT-protected read endpoint on service-2, or proxy through service-1, mirroring the dashboard controller pattern).

- [x] **209. The `record-identity` handler silently drops `fingerprint` and `deviceId`.**
      `record-identity.command.ts:4-7` carries `ip`, `userAgent`, `fingerprint`, and `deviceId`, and the controller collects all four from the request body. The handler at `record-identity.command-handler.ts:29-32` passes only two of them: `user.recordIdentity({ ip: command.ip, userAgent: command.userAgent })`. The signature of `user.recordIdentity` is `{ ip?, userAgent? }`, so the two fields the command advertises are silently discarded. If item 201 is resolved by deleting the feature this is moot; if it is kept, this is silent data loss.
      Severity: Low. Classification: change.

- [x] **210. The Redis outbox `save` is not atomic, unlike the Mongo outbox it is meant to mirror.**
      `backend/libs/mongodb/src/outbox/outbox.mongodb-repository.ts:91-105` persists a state transition as one atomic `updateOne`. The Redis `save` in the non-transactional path taken by `OutboxService` (`outbox.service.ts:122-123` does `markAsProcessed(); save(event)` with no context) issues the item `SET` plus up to three separate `zrem`/`zadd` index commands as independent, individually awaited calls (`outbox.redis-repository.ts:44-56`). A crash between them leaves the item marked processed while still present in the unprocessed index, or the reverse, producing a re-published or a lost event. The claim and reclaim paths were carefully made atomic with Lua, but the far more frequent save path was not. In practice this is low impact only because the adapter is unwired (item 203).
      Severity: Medium. Classification: change (wrap the item write plus index maintenance in a single MULTI or Lua, matching the atomicity the claim path already has).

- [x] **211. `InboxService.handleEventFailure` has a `@WithSpan` `attributesFrom` that names arguments the method does not have.**
      `backend/libs/common/src/inbox/inbox.service.ts:234-243` decorates the method with `@WithSpan('inbox.handle_event_failure', { attributesFrom: ['id', 'eventName', 'topic'] })`, but the method signature is `(event, message, topic, error, durationSeconds)`. The first argument is `event`, not `id` or `eventName`, and `topic` is the third argument. So the decorator attaches empty or wrong span attributes. The sibling span `inbox.process_integration_event` passes attributes explicitly and correctly. This is a quiet observability bug, not a crash. Confidence is medium because it depends on the exact `attributesFrom` semantics, but both readings yield wrong or empty attributes given the argument list.
      Severity: Low. Classification: change.

- [x] **212. The notifications `User` projection is written but never read, so it is a no-op.**
      `create-user.command-handler.ts:19` comments "Create local user projection for email lookup," but no email lookup ever happens. `send-email.command-handler.ts` reads the recipient straight from the integration-event payload, and the notifications `User_Repository` is only ever touched by `findById` (an idempotency guard in create) and `remove` (in delete), never by a real read. The whole create-user and delete-user machinery plus the aggregate could be removed without changing behavior. This is defensible as a teaching demo of projections, but a forker should know it is a projection that is maintained and never queried.
      Severity: Low. Classification: improve (either add the email-lookup read the comment promises so the projection earns its keep, or remove it and note in docs that send-email reads from the event).

- [x] **213. `UserToken_RedisRepository.revokeAllUserTokens` does a redundant double-delete.**
      `backend/libs/redis/src/auth/user-token.redis-repository.ts:157-168`, inside the loop, manually deletes `tokenLookupKey` and `this.itemKey(tokenId)`, then calls `this.remove(new Id(tokenId), context)`, which re-runs `findById` (now null because the item was just deleted) and then calls `super.remove` to delete the already-deleted key again. Because `findById` returns null, `remove`'s own secondary-index cleanup is skipped, so the manual deletes above are what actually clean up. The result is correct but does two to three times the Redis round-trips and is confusing to read.
      Severity: Low. Classification: improve (drop the manual deletes and let `remove` clean up, or drop the `remove` call).

## Generator template drift

The `service` generator scaffolds an app that no longer matches how the two real services are wired. None of these are caught by `generator.spec.js`, which asserts only on scaffolded file existence and compose or Caddy wiring, never on `app.module.ts` or env content.

- [x] **214. The generated prod MongoDB URI has no credentials, so it cannot connect to the prod stack.**
      `tools/forgestack/src/generators/service/files/env/__name__.env.prod.example__tmpl__:24` produces `MONGODB_URI=mongodb://mongodb:27017/<%= name %>?replicaSet=rs0`. Prod mongod runs with admin auth (`docker-compose.prod.yml` sets `MONGO_ADMIN_USER` and `MONGO_ADMIN_PASS`, and the healthcheck authenticates). Both real prod env files use `mongodb://admin:your-mongo-password@mongodb:27017/<name>?replicaSet=rs0&authSource=admin` and carry a comment explaining that `--auth` requires `authSource=admin`. The generated URI has no user, no password, and no `authSource`, so it fails authentication on first deploy.
      Severity: High. Classification: change.

- [x] **215. The generated `app.module.ts` wires bare `InboxModule` instead of `InboxModule.forRoot(...)`, so the durable inbox is silently absent.**
      `tools/forgestack/src/generators/service/files/service/src/app.module.ts__tmpl__:11,37` imports and lists `InboxModule` with no `forRoot`. `InboxModule` is `@Module({})` whose providers are supplied only by `forRoot()` (`inbox.module.ts:14-36`). Both real services call `InboxModule.forRoot({ repository: Inbox_MongodbRepository })` (service-2 `app.module.ts:40`), and the generated example ships an integration-event consumer that relies on the inbox. Because `inboxService` is optional in the base listener, DI does not crash, but the durable Mongo inbox is missing, which is exactly the failure the inbox pattern warns about: a restart loses accepted-but-unprocessed events. The template also never imports `Inbox_MongodbRepository`.
      Severity: High. Classification: change.

- [x] **216. The generated rate limiter uses in-memory storage, so limits do not hold across replicas.**
      `tools/forgestack/src/generators/service/files/service/src/app.module.ts__tmpl__:51` produces `ApiRateLimitModule.forRoot({ '1minute': { type: 'ip', limit: 100 } })`. Both real services use the Redis-backed form and carry the comment "Rate limits are stored in Redis so they hold across all instances" (service-2 `app.module.ts:55-58` adds `{ imports: [RedisThrottlerStorageModule], storageClass: ThrottlerStorageRedis }`). A generated service scaled past one replica gets per-instance limits, effectively N times the intended limit. Redis is already a dependency of the generated service, so this is pure drift.
      Severity: Medium. Classification: change.

- [x] **217. The generated env files omit the `KAFKA_SSL` knob the real services document.**
      `tools/forgestack/src/generators/service/files/service/.env.example__tmpl__` and `.../env/__name__.env.prod.example__tmpl__` both drop `KAFKA_SSL`, which the real env files set to `false` with the comment "Set KAFKA_SSL=true for TLS without SASL creds." It is a live knob read at `backend/libs/kafka/src/kafka-config.helper.ts:26` (`process.env.KAFKA_SSL === 'true'`). A forker deploying to a TLS-only Kafka has no discoverable env var. The prod template also omits the `SWAGGER_ENABLED` comment block the real prod env carries.
      Severity: Low. Classification: improve.

## Infra and monitoring

- [x] **218. `GOOGLE_CLIENT_SECRET` in the prod env example is read by nothing.**
      `infra/env/service-1.env.prod.example` sets `GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET`, but the Google OAuth flow is token-verification only: `google-oauth.service.ts:32` reads `process.env.GOOGLE_CLIENT_ID` and verifies the access token against Google's tokeninfo and userinfo endpoints. There is no server-side authorization-code exchange, so no client secret is ever used. Grep of `GOOGLE_CLIENT_SECRET` across `backend/` and `frontend/` source finds zero code hits. The dev example (`backend/services/service-1/.env.example`) correctly lists only `GOOGLE_CLIENT_ID`, so the prod example is the outlier. A forker will provision a secret that does nothing and may wrongly assume the backend does a code exchange.
      Severity: Medium. Classification: delete (remove the line from `service-1.env.prod.example`).

- [x] **219. The Grafana "Disk I/O" panel queries `container_fs_*` metrics that cAdvisor does not reliably emit on Docker Desktop.**
      `infra/monitoring/grafana/provisioning/dashboards/docker-containers.json:380,391` queries `container_fs_reads_bytes_total` and `container_fs_writes_bytes_total`. The project's own `alert-rules.yml:34-37` already notes that cAdvisor does not reliably expose `container_fs_*` on Docker Desktop, which is why the `HostLowDisk` rule was disabled. So this panel renders empty in the dev stack a forker evaluates the template in first, even though cAdvisor is up and emitting other metrics. It may populate on a Linux prod box, but the first impression is a broken panel.
      Severity: Low. Classification: improve (drop the panel, or annotate it as Linux and prod only).

- [x] **220. The `ContainerHighMemory` alert can never fire on Docker Desktop.**
      `infra/monitoring/prometheus/alert-rules.yml:52-62` uses `container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9` guarded by `container_spec_memory_limit_bytes > 0`. On the running dev stack `container_spec_memory_limit_bytes` returns zero series (Docker Desktop cAdvisor limitation, and the dev compose sets no `mem_limit`), so the guard makes the alert a silent no-op in dev. It is correct in prod, where cAdvisor and `mem_limit` supply the metric, so this is a dev-only caveat worth a one-line comment in the spirit of the honesty already applied to the `HostLowDisk` and `InstanceDown` comments.
      Severity: Low. Classification: improve (add caveat comment).

- [x] **221. The observability stack is heavy for a starter, with no documented removal path.**
      `infra/compose/docker-compose.prod.yml` runs Prometheus, Grafana, cAdvisor, Tempo, Loki, Promtail, and Portainer, and the four Grafana dashboards total 53 panels. A forker gets seven monitoring containers, OpenTelemetry tracing, Tempo remote-write into Prometheus, and 53 panels to understand before they can trim. This is a legitimate batteries-included choice, but there is no single documented "rip out monitoring" path. Flagging as the highest-weight thing a minimalist forker must reckon with, not as a bug.
      Severity: Low. Classification: improve (document how to disable the monitoring profile).

## Docs and drift

- [x] **222. The ESLint rule names in the docs do not match the registered rule ids.**
      `README.md:218-224` and `docs/architecture.md:33-38` list the custom rules by their source-file basenames, but the ids registered in `eslint.config.mjs` are plugin-namespaced. For example README:219 says `no-cross-bc-imports` while the real id is `bounded-context/no-cross-imports` (`eslint.config.mjs:147`); README:221 says `no-direct-cqrs-decorators` while the real id is `cqrs/no-direct-decorators` (line 137); README:222 says `cqrs-handler-collocation` and `handler-naming` while the real ids are `cqrs/handler-collocation` and `handler/naming`. The same mismatch runs through the architecture.md list, where `aggregate-base`, `command-handler-base`, and the rest are actually `aggregate/must-extend-base`, `command-handler/must-extend-base`, and so on. A forker who wants to disable or reconfigure a rule will search for the documented name and find nothing, because the override key must be the registered id.
      Severity: High. Classification: change (replace each documented name with its registered id, or show both with the id first).

- [x] **223. `docs/deployment.md` never mentions `npm run prod:setup`, contradicting the README provisioning flow.**
      `README.md:190` documents provisioning as a single command, `npm run prod:setup`, which maps to `infra/scripts/prod-setup.sh`, a wrapper that pipes `setup-server.sh` to the server over SSH. But `docs/deployment.md:31-54` tells the user to run `setup-server.sh` by hand with a raw `sshpass ... ssh root@SERVER_IP ... < infra/scripts/setup-server.sh` and never mentions the shipped wrapper (grep finds `prod:setup` only in the README). A forker reading deployment.md reimplements by hand what one npm script already does.
      Severity: Medium. Classification: change (lead with `npm run prod:setup` and keep the manual SSH invocation as the under-the-hood note).

- [x] **224. A docs-site testing page gives a copy-pasteable command for a service that does not exist.**
      `frontend/public-page/app/docs/backend/testing/page.mdx:10-11` shows `npx nx run billing:test` and `cd backend/services/billing && npx jest ...`. There is no `backend/services/billing`; the repo has only `service-1` and `service-2`. Elsewhere `billing` is clearly a "name it whatever you want" placeholder, which is fine, but here it is formatted as two runnable commands with a real-looking path, so a forker who runs them hits "no such file or directory." Use `service-1` in the runnable examples.
      Severity: Low. Classification: improve.

- [x] **225. `docs/deployment.md` omits the daily backup cron that the provisioning script installs.**
      `docs/deployment.md:48` enumerates what `setup-server.sh` does (Docker, deploy user, UFW, deploy directory, swap and sysctl tuning) but omits the daily MongoDB backup cron the script actually installs (`setup-server.sh:250-263`, 03:30 daily to `$REMOTE_PATH/backups`). `README.md:187` does mention the backup cron, so deployment.md, the more detailed doc, is the one under-describing. A forker relying on deployment.md would not know backups are already scheduled.
      Severity: Low. Classification: improve.
