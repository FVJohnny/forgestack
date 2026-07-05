# Infrastructure & Services

> This is a quick in-repo reference. The canonical docs live on the docs site at `/docs/monitoring` (served by the frontend at `/docs`). See the [README Documentation section](../README.md#documentation).

## Docker (`infra/compose/`)

Docker Compose configs for dev (`docker-compose.dev.yml`) and prod (`docker-compose.prod.yml`). The stack orchestrates: the backend services (service-1, service-2, …), public-page (frontend), Kafka + Zookeeper, MongoDB, Redis, and the observability + tooling services (Loki, Promtail, Prometheus, Grafana, Tempo, cAdvisor, Portainer, Mongo Express), all fronted by a Caddy reverse proxy with local HTTPS.

## Monitoring (`infra/monitoring/`)

Configuration for the observability stack: Prometheus scrape configs, Grafana provisioning/dashboards, Loki + Promtail log pipeline, and Tempo for distributed traces.

### Removing the monitoring stack

The observability stack is on by default and adds seven containers. If you do not want it, remove these services from both `infra/compose/docker-compose.dev.yml` and `infra/compose/docker-compose.prod.yml`: `prometheus`, `grafana`, `cadvisor`, `tempo`, `loki`, `promtail`, and `portainer`. Then delete the `infra/monitoring/` directory and the matching Dockerfiles under `infra/dockerfiles/` (`Dockerfile.prometheus`, `Dockerfile.grafana`, `Dockerfile.loki`, `Dockerfile.promtail`, `Dockerfile.tempo`). The services keep exporting metrics and traces regardless. To stop them trying to reach Tempo, set `OTEL_TRACES_ENABLED=false` and `OTEL_METRICS_ENABLED=false` in each service env file. The `/metrics` and `/health` endpoints stay up, so you can point your own monitoring at them later.

## Environment Variables

Each service has a **local dev** env file plus a `.example` template, and the production deploy uses a separate set of `.env.prod` files under `infra/env/`. When adding or changing env vars, **keep the example templates in sync** with the real files.

### Local dev env files (used by `docker-compose.dev.yml`)

- `backend/services/service-1/.env` (example: `.env.example`)
- `frontend/public-page/.env.local` (example: `.env.local.example`)

### Production env files (`infra/env/`, deployed to the server)

- `infra/env/service-1.env.prod` (example: `service-1.env.prod.example`)
- `infra/env/public-page.env.prod` (example: `public-page.env.prod.example`)
- `infra/env/infra.env.prod`: shared infra config: domain, TLS, Docker registry, server IP/user, DB/Redis passwords (example: `infra.env.prod.example`)
