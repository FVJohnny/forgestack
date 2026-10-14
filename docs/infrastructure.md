# Infrastructure & Services

> Quick in-repo reference. The canonical pages are **[Deployment](https://forgestack.fvjohnny.com/docs/deployment)**, **[Monitoring](https://forgestack.fvjohnny.com/docs/monitoring)** and **[Databases](https://forgestack.fvjohnny.com/docs/databases)** on the docs site; when the two disagree, the docs site wins.

## Docker (`infra/compose/`)

Docker Compose configs for dev (`docker-compose.dev.yml`) and prod (`docker-compose.prod.yml`). The stack orchestrates: the backend services (service-1, service-2, …), public-page (frontend), Kafka + ZooKeeper, MongoDB, Redis, the observability stack (Prometheus, Grafana, Loki, Promtail, Tempo, cAdvisor), Portainer (container management UI) and, in dev only, Mongo Express. About 16 containers in dev.

## Caddy (`infra/caddy/Caddyfile`)

One Caddyfile serves dev and prod. Everything the browser uses is on one origin: the frontend at the root, and each backend service under a path prefix (`/svc1`, `/svc2`, …) that Caddy strips before proxying, so every service still serves `/api/v1` internally. New services get a prefix from the generator (`service-<N>` → `/svc<N>`, other names → `/svc<name without dashes>`). Operator UIs have their own hosts: `grafana.<domain>`, `portainer.<domain>` (basic auth in prod) and, in dev only, `mongo.localhost` (from `infra/caddy/dev-only/`). Prometheus, Loki and Tempo are not routed; they are only reachable inside the Docker network.

## Monitoring (`infra/monitoring/`)

Configuration for the observability stack: Prometheus scrape configs and alert rules, Grafana provisioning/dashboards, the Loki + Promtail log pipeline, and Tempo for distributed traces. Prometheus authenticates to each service's `/api/v1/metrics` with a key file that must equal the services' `INTERNAL_API_KEY`. In dev that is `infra/monitoring/prometheus/internal-api-key` (created from its example, matching the dev `.env` files). In production you don't manage the file: `deploy.sh` checks that every service's `.env.prod` shares one non-placeholder `INTERNAL_API_KEY` and writes Prometheus's key from it.

cAdvisor (per-container CPU and memory) does not work on Docker Desktop for macOS, so the container dashboard stays empty there. It works on the Linux production server.

### Removing the monitoring stack

The observability stack is on by default and adds six containers (`prometheus`, `grafana`, `cadvisor`, `tempo`, `loki`, `promtail`). Portainer is a separate container-management tool, not part of it; remove it on its own if you don't want it (its service, its volume and the `portainer.` site in the Caddyfile). Removing the monitoring stack touches more than the compose services, because other pieces depend on it:

1. **Compose files** (`docker-compose.dev.yml` and `docker-compose.prod.yml`): delete the six services and their named volumes. Then remove the references to them: `loki` under `depends_on` in the dev `x-nestjs-service` anchor, and `grafana` under the `caddy` service's `depends_on` in both files.
2. **Caddyfile**: delete the `grafana.{$DOMAIN:localhost}` site, so Caddy stops proxying to a missing container and stops requesting a certificate for that host in production.
3. **Services' env files** (`backend/services/*/.env(.example)` and `infra/env/*.env.prod(.example)`): set `OTEL_TRACES_ENABLED=false` and `OTEL_METRICS_ENABLED=false`, so the services stop exporting to Tempo. The `/api/v1/metrics` and `/api/v1/health` endpoints stay up, so you can point your own monitoring at them later.
4. **Scripts**: in `infra/scripts/deploy.sh`, remove the monitoring builds (menu option 4, the monitoring part of option 5, and the monitoring versions printed in the menu) and the internal-API-key handling (the check that every service shares one `INTERNAL_API_KEY`, and the step in `deploy()` that writes Prometheus's key from it). In `infra/scripts/start-dev.sh`, remove the step that creates `internal-api-key`.
5. **CI** (`.github/workflows/ci.yml`): remove the Prometheus, Loki, Tempo and Promtail config checks and the internal-api-key sync check.
6. **Files**: only now delete `infra/monitoring/` and the monitoring Dockerfiles in `infra/dockerfiles/` (`Dockerfile.prometheus`, `Dockerfile.grafana`, `Dockerfile.loki`, `Dockerfile.promtail`, `Dockerfile.tempo`).

Finally, run `docker compose -f infra/compose/docker-compose.dev.yml config -q` (and the same for the prod file with `--env-file infra/env/infra.env.prod`) to confirm both files are still valid.

## Environment Variables

Each service has a **local dev** env file plus a `.example` template, and the production deploy uses a separate set of `.env.prod` files under `infra/env/`. When adding or changing env vars, **keep the example templates in sync** with the real files. `npm run dev:start` creates any missing local file from its example. All real env files are gitignored.

### Local dev env files (used by `docker-compose.dev.yml`)

- `backend/services/service-1/.env` (example: `.env.example`)
- `backend/services/service-2/.env` (example: `.env.example`)
- `frontend/public-page/.env.local` (example: `.env.local.example`)
- `infra/monitoring/prometheus/internal-api-key` (example: `internal-api-key.example`), the dev key Prometheus scrapes with; it must match the dev `INTERNAL_API_KEY` and is never deployed

Each generated service adds its own `backend/services/<name>/.env`.

### Production env files (`infra/env/`, deployed to the server)

- `infra/env/service-1.env.prod` (example: `service-1.env.prod.example`)
- `infra/env/service-2.env.prod` (example: `service-2.env.prod.example`)
- `infra/env/public-page.env.prod` (example: `public-page.env.prod.example`); its `NEXT_PUBLIC_*` values are baked into the frontend image at build time
- `infra/env/infra.env.prod`: shared infra config: domain, TLS, Docker registry, server IP/user, Grafana, DB/Redis passwords, Portainer basic-auth hash (example: `infra.env.prod.example`)

The generator adds `infra/env/<name>.env.prod` (+ `.example`) for each new service. The first-deploy checklist in [`deployment.md`](deployment.md#first-deploy-checklist) explains which values must match across files.
