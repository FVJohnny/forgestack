#!/bin/bash
#
# Dumps the MongoDB replica set to a timestamped, compressed archive on the
# host and prunes old archives. Intended to run on the server (via cron) with
# the stack already up.
#
# Usage (from the deploy directory, e.g. /opt/forgestack):
#   ./backup-mongo.sh                 # dump to ./backups, keep 14 days
#   BACKUP_DIR=/mnt/vol ./backup-mongo.sh
#   RETENTION_DAYS=30 ./backup-mongo.sh
#
# Restore (destructive — overwrites matching collections):
#   gunzip -c backups/mongo-YYYYmmdd-HHMMSS.archive.gz \
#     | docker exec -i "$(compose_ps mongodb)" \
#         mongorestore --archive --drop \
#         -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin
#
# Off-host copies: point BACKUP_DIR at a mounted volume or a directory your
# provider snapshots, or add an `aws s3 cp` / `rclone copy` line after the dump.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/compose/docker-compose.yml}"
# Fall back to the repo layout when run from a checkout instead of the server.
[ -f "$COMPOSE_FILE" ] || COMPOSE_FILE="$SCRIPT_DIR/../compose/docker-compose.prod.yml"

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$COMPOSE_FILE")/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Credentials come from the compose .env (same file deploy.sh ships as
# compose/.env). Allow them to be pre-set in the environment too.
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; . "$ENV_FILE"; set +a
fi
: "${MONGO_ADMIN_USER:?MONGO_ADMIN_USER must be set (compose/.env or env)}"
: "${MONGO_ADMIN_PASS:?MONGO_ADMIN_PASS must be set (compose/.env or env)}"

# Resolve the running mongodb container name from compose (no container_name is
# pinned, so it is <project>-mongodb-1).
CONTAINER="$(docker compose -f "$COMPOSE_FILE" ps -q mongodb)"
if [ -z "$CONTAINER" ]; then
    echo "Error: mongodb container is not running (compose file: $COMPOSE_FILE)" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/mongo-$STAMP.archive.gz"

echo "==> Dumping MongoDB to $OUT"
# --archive to stdout + gzip on the host: one portable file, no temp dir in
# the container. Auth against the admin DB; the replica set is dumped whole.
docker exec "$CONTAINER" mongodump \
    -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin \
    --archive 2>/dev/null | gzip > "$OUT"

# Fail loudly if the dump produced an empty/near-empty file.
if [ ! -s "$OUT" ] || [ "$(wc -c < "$OUT")" -lt 100 ]; then
    echo "Error: dump looks empty ($OUT). Check credentials and container health." >&2
    rm -f "$OUT"
    exit 1
fi

echo "==> Wrote $(du -h "$OUT" | cut -f1)"

echo "==> Pruning archives older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'mongo-*.archive.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "==> Done. Latest backups:"
ls -1t "$BACKUP_DIR"/mongo-*.archive.gz 2>/dev/null | head -5
