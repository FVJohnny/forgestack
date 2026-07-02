#!/bin/sh
set -eu

# Shared dev-container entrypoint for every NestJS service. Invoked from
# docker-compose.dev.yml as:
#   sh -c "./scripts/start-nestjs-dev.sh <service-name>"
SERVICE="${1:?usage: start-nestjs-dev.sh <service-name>}"
SERVICE_DIR="/app/backend/services/$SERVICE"

if [ ! -d "$SERVICE_DIR" ]; then
  echo "❌ Unknown service '$SERVICE' ($SERVICE_DIR not found)" >&2
  exit 1
fi

# Stamp file records the last successful install+build. We skip `npm i` and
# `nx build` on restart unless `package-lock.json` or any file under
# `backend/libs/**` has changed since the stamp — the libs are the only source
# tree whose changes the service's `start:dev --watch` does NOT pick up.
STAMP="$SERVICE_DIR/.dev-stamp"
LOCKFILE="/app/package-lock.json"
LIBS_DIR="/app/backend/libs"

needs_rebuild() {
  # First run — no stamp yet
  if [ ! -f "$STAMP" ]; then
    echo "  reason: no stamp file (first run)"
    return 0
  fi

  # Lockfile changed → deps changed
  if [ "$LOCKFILE" -nt "$STAMP" ]; then
    echo "  reason: package-lock.json changed"
    return 0
  fi

  # Any lib source changed → the watcher won't pick it up, must rebuild
  # Exclude dist/ and node_modules/ so we only react to actual source edits
  CHANGED=$(find "$LIBS_DIR" \
    -type d \( -name node_modules -o -name dist \) -prune -o \
    -type f -newer "$STAMP" -print 2>/dev/null | head -1)
  if [ -n "$CHANGED" ]; then
    echo "  reason: libs source changed (e.g. $CHANGED)"
    return 0
  fi

  return 1
}

# All service dev containers share the repo mount (and its node_modules), so
# serialize install+build across them — two concurrent `npm i` runs on the
# same tree can corrupt it. flock queues the later container until the first
# finishes; its own stamp check then decides whether it still needs to build.
exec 9>/app/.dev-install.lock
flock 9

if needs_rebuild; then
  echo "📥 Installing npm dependencies..."
  npm i

  echo "🔨 Building $SERVICE and its dependencies..."
  npx nx run "$SERVICE:build"

  # Mark success so the next restart can skip these steps
  touch "$STAMP"
else
  echo "⏭️  Skipping npm install + nx build (no lockfile or libs changes since last run)"
fi

flock -u 9

echo "🚀 Starting $SERVICE in development mode..."
cd "$SERVICE_DIR"
npm run start:dev
