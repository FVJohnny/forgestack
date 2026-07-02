# Infrastructure & Services

## Docker (`infra/compose/`)

Docker Compose configs for dev (`docker-compose.dev.yml`) and prod (`docker-compose.prod.yml`). The stack orchestrates: the backend services (service-1, service-2, …), public-page (frontend), Kafka + Zookeeper, MongoDB, Redis, and the observability + tooling services — Loki, Promtail, Prometheus, Grafana, Tempo, cAdvisor, Portainer, Mongo Express — all fronted by a Caddy reverse proxy with local HTTPS.

## Monitoring (`infra/monitoring/`)

Configuration for the observability stack: Prometheus scrape configs, Grafana provisioning/dashboards, Loki + Promtail log pipeline, and Tempo for distributed traces.

## Environment Variables

Each service has a **local dev** env file plus a `.example` template, and the production deploy uses a separate set of `.env.prod` files under `infra/env/`. When adding or changing env vars, **keep the example templates in sync** with the real files.

### Local dev env files (used by `docker-compose.dev.yml`)

- `backend/services/service-1/.env` (example: `.env.example`)
- `frontend/public-page/.env.local` (example: `.env.local.example`)

### Production env files (`infra/env/`, deployed to the server)

- `infra/env/service-1.env.prod` (example: `service-1.env.prod.example`)
- `infra/env/public-page.env.prod` (example: `public-page.env.prod.example`)
- `infra/env/infra.env.prod` — shared infra config: domain, TLS, Docker registry, server IP/user, DB/Redis passwords (example: `infra.env.prod.example`)
</content>
