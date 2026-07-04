#!/bin/sh
set -eu

# Recreate one or more services in the dev stack without touching the rest.
# Usage:
#   npm run dev:restart service-1
#   npm run dev:restart service-1 public-page
#
# Why `up --force-recreate --no-deps` (not `restart`):
#   `docker compose restart` only sends SIGTERM/SIGKILL to the existing
#   container — env_file values are baked in at container-create time, so a
#   plain restart does NOT pick up edits to `.env`. `--force-recreate`
#   destroys + recreates the container so Compose re-reads env files.
#   `--no-deps` leaves Kafka/Mongo/Redis alone.

if [ "$#" -eq 0 ]; then
  echo "Usage: npm run dev:restart <service> [more services...]" >&2
  echo "Example: npm run dev:restart service-1" >&2
  echo "" >&2
  echo "To restart the whole stack instead, run: npm run dev:restart:all" >&2
  exit 1
fi

cd "$(dirname "$0")/../.."

exec docker compose -f infra/compose/docker-compose.dev.yml \
  up -d --force-recreate --no-deps "$@"
