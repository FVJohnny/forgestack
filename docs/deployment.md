# Production Deployment

> Quick in-repo reference. The canonical page is **[Deployment](https://forgestack.fvjohnny.com/docs/deployment)** on the docs site; when the two disagree, the docs site wins.

Production runs the stack from pre-built images on a single Linux server with Docker Compose (`infra/compose/docker-compose.prod.yml`), behind Caddy with automatic Let's Encrypt certificates. Two scripts do the work:

- `npm run prod:setup` (`infra/scripts/prod-setup.sh` → `setup-server.sh`) provisions a fresh Ubuntu server once.
- `npm run prod:update` (`infra/scripts/deploy.sh`) builds, pushes and deploys, for the first deploy and every one after it.

## What you need

- A fresh **Ubuntu** server with a public IP and root access (password or SSH key). As a rough guide, at least 4 GB of RAM: the setup adds 4 GB of swap, the prod compose caps the containers at about 6.6 GB in total, and 8 GB is comfortable.
- A **domain** whose DNS you control.
- An account on a **container registry**. Any registry works (Docker Hub, GHCR, ECR, …): `deploy.sh` logs in to the host part of `DOCKER_REGISTRY`.
- An **SSH key pair** on your machine. `prod:setup` authorizes `~/.ssh/id_ed25519.pub` by default; pass `SSH_PUBKEY="$(cat ~/.ssh/<key>.pub)"` to use another one.
- Docker with `buildx` on your machine (images are built locally for `linux/amd64`), plus `rsync`. `sshpass` is only needed if the server accepts nothing but a root password at first.

## First deploy checklist

Do these in order. Everything below runs on your machine, from the repo root. The order matches the "next steps" that `npm run prod:setup` prints when it finishes.

### 1. Fill in `infra/env/infra.env.prod`

Copy every template now (the real files are gitignored), then fill in the infra file, which `prod:setup` reads:

```bash
for f in infra/env/*.env.prod.example; do cp "$f" "${f%.example}"; done
```

**`infra/env/infra.env.prod`**: `DOMAIN`; `DOCKER_REGISTRY`, `DOCKER_USER`, `DOCKER_PASS` (see [Container registry](#container-registry)); `SERVER_IP` and `SERVER_USER` (the deploy user that step 2 creates, e.g. `deploy`); `GRAFANA_ADMIN_PASSWORD`; `MONGO_ADMIN_PASS`; `REDIS_PASSWORD`; and `CADDY_BASIC_AUTH_HASH` for Portainer (the file shows how to generate it; Caddy refuses to start in production without it). Generate strong values, e.g. with `openssl rand -base64 48`.

### 2. Provision the server

```bash
npm run prod:setup
```

It reads `SERVER_IP` and `SERVER_USER` from `infra.env.prod`, connects as root (with your key if that already works, otherwise with the root password, which it prompts for unless you set `ROOT_PASS='...'`), and pipes `setup-server.sh` to the server. The script is idempotent. It:

- installs Docker Engine + the compose plugin, with daemon-wide log rotation;
- creates the deploy user in the `docker` group, with your SSH key and **no sudo** (deploys only need Docker and the deploy directory; administer the box as root over SSH);
- hardens SSH (key-only logins, root by key only), and enables fail2ban for SSH and unattended security upgrades;
- opens UFW for 22, 80 and 443 only;
- creates the deploy directory (`/opt/forgestack`), adds swap if there is none, applies sysctl tuning, and installs a daily MongoDB backup cron (03:30, dumps to `/opt/forgestack/backups`).

Override the defaults with `DEPLOY_USER`, `REMOTE_PATH` or `SWAP_SIZE` (see the script header). When it finishes, verify SSH with `ssh <SERVER_USER>@<SERVER_IP> 'docker ps'`; it also lists any env file that is still missing.

To run the setup script by hand instead of through the wrapper:

```bash
ssh root@SERVER_IP "SSH_PUBKEY='$(cat ~/.ssh/id_ed25519.pub)' bash -s" \
    < infra/scripts/setup-server.sh
```

### 3. Fill in the service and frontend env files

- **`infra/env/service-1.env.prod`, `service-2.env.prod`** (and one per service you add):
  - `MONGODB_URI` and `REDIS_PASSWORD` must use the passwords from `infra.env.prod`.
  - `JWT_SECRET` and `JWT_REFRESH_SECRET`: at least 32 characters, generated (`openssl rand -base64 48`), and **identical in every service**, because service-2 verifies the tokens service-1 issues. A service refuses to boot in production with a value that is too short, one of the shipped examples, or anything containing "change in production" (any casing).
  - `INTERNAL_API_KEY`: use **one shared, real key** (e.g. `openssl rand -hex 32`) in every service's file. Prometheus uses it to scrape `/api/v1/metrics`, and you don't configure Prometheus yourself: `deploy.sh` stops if the services' keys differ or one is still a placeholder, and otherwise writes Prometheus's production key from it.
  - `CORS_ORIGINS` and `FRONTEND_URL`: your domain.
  - service-1 only: the `SMTP_*` settings (welcome and password-reset emails), `GOOGLE_CLIENT_ID` if you enable Google sign-in, and optionally `DEFAULT_USER_EMAIL` / `DEFAULT_USER_PASSWORD` (step 6).
- **`infra/env/public-page.env.prod`**: the `NEXT_PUBLIC_*` URLs on your domain (`https://<domain>/svc1/api/v1`, `https://<domain>/svc2/api/v1`, `https://<domain>`). They are baked into the frontend image at build time.

### 4. Point DNS at the server

Create A records pointing at `SERVER_IP` for:

- `<domain>` (the app, and every service under `/svc1`, `/svc2`, …)
- `www.<domain>` (redirects to the apex)
- `grafana.<domain>`
- `portainer.<domain>` (behind basic auth)

Caddy needs them resolving to issue the TLS certificates when it first starts. You can create them earlier to give DNS time to propagate.

### 5. Deploy everything

```bash
npm run prod:update -- 5   # or run it without arguments and choose 5) Update ALL
```

Choose **5** on the first deploy so the Caddy and monitoring images are built and pushed too. Commit the bumped image tags in `infra/compose/docker-compose.prod.yml` afterwards (see [Version tracking](#version-tracking)).

MongoDB comes up as a single-node replica set (`rs0`), initialized on first boot by `infra/mongo/mongo-startup.sh`; there is no manual step. Data lives in named Docker volumes, so a fresh server starts with an empty database.

### 6. Create the first admin

Pick one:

- **Seed it.** Set `DEFAULT_USER_EMAIL` and `DEFAULT_USER_PASSWORD` in `service-1.env.prod` before the first deploy. On boot, service-1 creates that user as a verified admin, but only when the users collection is empty and only when both variables are set. Remove the password from the file once you have signed in.
- **Promote yourself.** Register on the site (email verification is off by default, so you can sign in right away), then set your role in MongoDB on the server. `mongosh` prompts for `MONGO_ADMIN_PASS`, and `app` is the database name from service-1's `MONGODB_URI`:

  ```bash
  ssh <SERVER_USER>@<SERVER_IP>
  cd /opt/forgestack
  docker compose -f compose/docker-compose.yml exec mongodb \
      mongosh -u admin -p --authenticationDatabase admin app \
      --eval 'db.auth_users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })'
  ```

  Sign out and back in afterwards: the role travels inside the JWT.

### After the first deploy

- The app is at `https://<domain>`, each API at `https://<domain>/svc<N>/api/v1`.
- Grafana is at `https://grafana.<domain>` (user `admin`, password `GRAFANA_ADMIN_PASSWORD`).
- Portainer is at `https://portainer.<domain>`, behind Caddy's basic auth. Create its admin account right after the first deploy: Portainer only allows that for a few minutes after it starts.
- Swagger is off in production. Set `SWAGGER_ENABLED=true` in a service's env file only if you protect it.

## Container registry

Images are pushed as `${DOCKER_REGISTRY}/forgestack-<name>:v<N>`. `deploy.sh` logs in with `DOCKER_USER` / `DOCKER_PASS` to the registry host taken from `DOCKER_REGISTRY`, both on your machine and on the server:

| Registry   | `DOCKER_REGISTRY`                          | `DOCKER_USER` / `DOCKER_PASS`                                               |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| Docker Hub | `docker.io/your-username`                  | your username / an access token                                             |
| GHCR       | `ghcr.io/your-user-or-org`                 | your GitHub username / a token with `write:packages`                        |
| ECR        | `<account>.dkr.ecr.<region>.amazonaws.com` | `AWS` / the output of `aws ecr get-login-password` (expires after 12 hours) |

ECR does not create repositories on push, so create one per image (`forgestack-service-1`, `forgestack-public-page`, …) first.

## Redeploying

`npm run prod:update` shows a menu. You can also pass the choice as an argument, e.g. `npm run prod:update -- 2` or `npm run prod:update -- service-1`. Backend services are discovered from `backend/services/*/`, so the script needs no changes when you add one.

1. Update frontend
2. Update ALL apps (frontend + services)
3. Update Caddy (reverse proxy)
4. Update monitoring stack (Prometheus, Grafana, Loki, Promtail, Tempo)
5. Update ALL (apps + proxy + monitoring)
6. Deploy only (no builds, re-deploys the current image versions)

Or type a service name (e.g. `service-1`) to build and deploy just that service.

Each run builds the selected images as `linux/amd64` with `docker buildx`, pushes them, bumps their tags in `docker-compose.prod.yml`, rsyncs the compose file, env files, Mongo startup script, backup script and the Prometheus key it derives from `INTERNAL_API_KEY` to the server (`REMOTE_PATH`, default `/opt/forgestack`), then runs `docker compose up -d` there: the datastores first, then the apps, waiting for each to report healthy. If an app never becomes healthy, the script stops and prints how to read the logs.

## Version tracking

Image versions are stored as tags in `infra/compose/docker-compose.prod.yml` (e.g. `${DOCKER_REGISTRY}/forgestack-service-1:v42`). Each build increments the version. Commit this file after deploys to track what's running in production; rolling back means redeploying an earlier set of tags.

## Secrets

All production secrets live in `infra/env/*.env.prod` (gitignored), documented by the matching `*.env.prod.example` files. That includes the internal API key: `deploy.sh` writes Prometheus's copy from the services' shared `INTERNAL_API_KEY` on every deploy, so rotating it means changing it in every service's file. `infra/monitoring/prometheus/internal-api-key` is the dev stack's key only and never reaches the server.

To change a secret, edit the local file and re-run `npm run prod:update` choosing **6** (deploy only), which rsyncs the files and recreates the containers without rebuilding images. `NEXT_PUBLIC_*` values in `public-page.env.prod` are the exception: they are baked into the frontend image, so choose **1** to rebuild it.
