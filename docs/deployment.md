# Production Deployment

`npm run prod:update` runs `infra/scripts/deploy.sh`, an interactive menu-driven script that builds Docker images, pushes them to your container registry, and deploys to a production server via SSH/rsync.

## How it works

1. Reads config from `infra/env/infra.env.prod` (server IP/user, registry, Docker credentials).
2. Builds selected services as `linux/amd64` images via `docker buildx`, auto-incrementing the version tag in `docker-compose.prod.yml`.
3. Copies the compose file + env files to the server's deploy directory (`REMOTE_PATH`, defaults to `/opt/forgestack`) via rsync.
4. SSHs into the server and runs `docker compose up -d` to start services (infra first, then apps).

## Menu options

Backend services are discovered from `backend/services/*/` — the script needs no changes when one is added. Can also pass the choice as an argument, e.g. `npm run prod:update -- 2` or `npm run prod:update -- service-1`:

1. Update frontend
2. Update ALL apps (frontend + services)
3. Update Caddy (reverse proxy)
4. Update monitoring stack (Prometheus, Grafana, Loki, Promtail, Tempo)
5. Update ALL (apps + proxy + monitoring)
6. Deploy only (no builds — re-deploys current image versions)

Or type a service name (e.g. `service-1`) to build and deploy just that service.

## Version tracking

Image versions are stored as tags in `infra/compose/docker-compose.prod.yml` (e.g. `your-registry/service-1:v42`). Each build increments the version. Commit this file after deploys to track what's running in prod.

## Provisioning a new server

The deploy script assumes the target server already has Docker, a deploy user, and the deploy directory. To prepare a fresh Ubuntu box, run the one-shot setup script over SSH:

Pass your SSH public key via `SSH_PUBKEY` so the deploy user can log in without a password afterwards (it is required):

```bash
# Fresh box, only root password works yet:
sshpass -p 'ROOT_PASSWORD' ssh -o StrictHostKeyChecking=accept-new \
    root@SERVER_IP "SSH_PUBKEY='$(cat ~/.ssh/id_ed25519.pub)' bash -s" \
    < infra/scripts/setup-server.sh

# Or if your key already lets you in as root:
ssh root@SERVER_IP "SSH_PUBKEY='$(cat ~/.ssh/id_ed25519.pub)' bash -s" \
    < infra/scripts/setup-server.sh
```

It is idempotent and installs Docker Engine + compose, creates a deploy user (docker + sudo, key-based SSH), opens UFW for 22/80/443, creates the deploy directory, and adds swap + sysctl tuning. Override defaults via env vars, e.g. `DEPLOY_USER` (default `deploy`), `REMOTE_PATH` (default `/opt/forgestack`), `SWAP_SIZE` (see the script header).

After it finishes:

1. Point `infra/env/infra.env.prod` at the new box (`SERVER_IP`, `SERVER_USER`).
2. Verify SSH: `ssh DEPLOY_USER@SERVER_IP 'docker ps'`.
3. First deploy: `npm run prod:update` → choose **6** (ALL) so proxy + monitoring images get built and pushed too.

MongoDB comes up as a single-node replica set (`rs0`); `infra/mongo/` initializes it on first boot — no manual step. Data lives in named Docker volumes, so a fresh box starts with an empty DB (migrate/restore separately if needed).

## Secrets

All prod secrets live in `infra/env/*.env.prod` (gitignored). The `*.env.prod.example` files in the same directory document the required keys without values. To update a secret, edit the local `.env.prod` file and re-run `npm run prod:update` choosing option **7** (deploy only — rsyncs env files and restarts containers without rebuilding images).
</content>
