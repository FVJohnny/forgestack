#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$INFRA_DIR/.." && pwd)"
COMPOSE_FILE="$INFRA_DIR/compose/docker-compose.prod.yml"

if [ ! -f "$INFRA_DIR/env/infra.env.prod" ]; then
    echo "Error: $INFRA_DIR/env/infra.env.prod not found. Copy infra.env.prod.example and fill it in." >&2
    exit 1
fi
source "$INFRA_DIR/env/infra.env.prod"

# Registry comes from infra.env.prod (DOCKER_REGISTRY, e.g. docker.io/your-username).
REGISTRY="${DOCKER_REGISTRY:?DOCKER_REGISTRY must be set in infra.env.prod}"
# NestJS services are discovered from the monorepo: every directory under
# backend/services is a deployable app with image forgestack-<name>. Adding a
# service requires NO change to this script.
SERVICES=()
for d in "$PROJECT_ROOT"/backend/services/*/; do
    SERVICES+=("$(basename "$d")")
done
service_image() { echo "forgestack-$1"; }

PUBLIC_PAGE_IMAGE="forgestack-public-page"
CADDY_IMAGE="forgestack-caddy"
PROMETHEUS_IMAGE="forgestack-prometheus"
GRAFANA_IMAGE="forgestack-grafana"
LOKI_IMAGE="forgestack-loki"
PROMTAIL_IMAGE="forgestack-promtail"
TEMPO_IMAGE="forgestack-tempo"

REMOTE_PATH="${REMOTE_PATH:-/opt/forgestack}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CYAN='\033[0;36m'
BOLD='\033[1m'

log() { echo -e "${GREEN}==>${NC} $1"; }
log_warn() { echo -e "${YELLOW}==>${NC} $1"; }
log_error() { echo -e "${RED}==>${NC} $1"; }

DEPLOY_START=$(date +%s)
# Timings are appended to a file so that background builds (run with `&`) can
# record their own lines from subshells. An in-memory bash array won't work
# here because array mutations don't escape subshells.
TIMING_FILE=$(mktemp)
cleanup_timing_file() { rm -f "$TIMING_FILE" "${TIMING_FILE}.lock"; }
trap cleanup_timing_file EXIT

fmt_duration() {
    local secs=$1
    local m=$(( secs / 60 ))
    local s=$(( secs % 60 ))
    if [ $m -gt 0 ]; then echo "${m}m ${s}s"; else echo "${s}s"; fi
}

add_timing() {
    local label=$1
    local duration=$2
    # Include a sort key (seconds since DEPLOY_START) so entries appear in the
    # order they finished, regardless of the race between parallel builds.
    local finish_offset=$(( $(date +%s) - DEPLOY_START ))
    # Use flock so concurrent builds don't tear each other's writes.
    (
        flock -x 201
        printf "%010d\t  %-30s %s\n" "$finish_offset" "$label" "$(fmt_duration $duration)" >> "$TIMING_FILE"
    ) 201>"${TIMING_FILE}.lock"
}

print_summary() {
    local total_end=$(date +%s)
    local total_elapsed=$(( total_end - DEPLOY_START ))
    echo ""
    echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║           DEPLOYMENT SUMMARY             ║${NC}"
    echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════╣${NC}"
    if [ -s "$TIMING_FILE" ]; then
        # Sort by the offset column (added by add_timing), then strip it.
        while IFS= read -r line; do
            echo -e "${CYAN}║${NC} $line ${CYAN}║${NC}"
        done < <(sort -n "$TIMING_FILE" | cut -f2-)
    fi
    echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${NC} $(printf "  %-30s %s" "TOTAL" "$(fmt_duration $total_elapsed)") ${CYAN}║${NC}"
    echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

VERSION_LOCK="/tmp/docker-compose-version.lock"

# The compose file references images by the literal ${DOCKER_REGISTRY} prefix
# (Docker Compose interpolates it at runtime), so version lookups match that
# literal rather than the resolved registry value.
IMAGE_PREFIX='${DOCKER_REGISTRY}'

get_version() {
    local service=$1
    (
        flock -s 200
        grep "image: ${IMAGE_PREFIX}/${service}:" "$COMPOSE_FILE" | sed "s/.*:v//" | tr -d ' '
    ) 200>"$VERSION_LOCK"
}

set_version() {
    local service=$1
    local new_version=$2
    (
        flock -x 200
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|${IMAGE_PREFIX}/${service}:v[0-9]*|${IMAGE_PREFIX}/${service}:v${new_version}|" "$COMPOSE_FILE"
        else
            sed -i "s|${IMAGE_PREFIX}/${service}:v[0-9]*|${IMAGE_PREFIX}/${service}:v${new_version}|" "$COMPOSE_FILE"
        fi
    ) 200>"$VERSION_LOCK"
}

build_and_push() {
    local service=$1
    local image=$2
    local dockerfile=$3
    local context=$4
    local build_args=$5

    local current_version=$(get_version "$image")
    local new_version=$((current_version + 1))
    set_version "$image" "$new_version"

    log "Building $service v$new_version..."

    local start_time=$(date +%s)
    cd "$context"
    docker buildx build --platform linux/amd64 --push $build_args -t "${REGISTRY}/${image}:v${new_version}" -f "$dockerfile" .
    local end_time=$(date +%s)
    local elapsed=$(( end_time - start_time ))
    local minutes=$(( elapsed / 60 ))
    local seconds=$(( elapsed % 60 ))

    log "$service updated to v$new_version (built in ${minutes}m ${seconds}s)"
    add_timing "Build+Push $service v$new_version" "$elapsed"
}

build_service() {
    local svc=$1
    build_and_push \
        "$svc" \
        "$(service_image "$svc")" \
        "$INFRA_DIR/dockerfiles/Dockerfile.nestjs-service" \
        "$PROJECT_ROOT" \
        "--build-arg SERVICE_NAME=$svc"
}

build_public_page() {
    build_and_push \
        "public-page" \
        "$PUBLIC_PAGE_IMAGE" \
        "$PROJECT_ROOT/frontend/public-page/Dockerfile" \
        "$PROJECT_ROOT" \
        ""
}

build_caddy() {
    build_and_push \
        "caddy" \
        "$CADDY_IMAGE" \
        "$INFRA_DIR/dockerfiles/Dockerfile.caddy" \
        "$PROJECT_ROOT" \
        ""
}

build_prometheus() {
    build_and_push \
        "prometheus" \
        "$PROMETHEUS_IMAGE" \
        "$INFRA_DIR/dockerfiles/Dockerfile.prometheus" \
        "$PROJECT_ROOT" \
        ""
}

build_grafana() {
    build_and_push \
        "grafana" \
        "$GRAFANA_IMAGE" \
        "$INFRA_DIR/dockerfiles/Dockerfile.grafana" \
        "$PROJECT_ROOT" \
        ""
}

build_loki() {
    build_and_push \
        "loki" \
        "$LOKI_IMAGE" \
        "$INFRA_DIR/dockerfiles/Dockerfile.loki" \
        "$PROJECT_ROOT" \
        ""
}

build_promtail() {
    build_and_push \
        "promtail" \
        "$PROMTAIL_IMAGE" \
        "$INFRA_DIR/dockerfiles/Dockerfile.promtail" \
        "$PROJECT_ROOT" \
        ""
}

build_tempo() {
    build_and_push \
        "tempo" \
        "$TEMPO_IMAGE" \
        "$INFRA_DIR/dockerfiles/Dockerfile.tempo" \
        "$PROJECT_ROOT" \
        ""
}

build_apps() {
    for svc in "${SERVICES[@]}"; do
        build_service "$svc" &
    done
    build_public_page &

    wait || { log_error "One or more app builds failed"; exit 1; }
}

build_monitoring_stack() {
    build_prometheus &
    build_grafana &
    build_loki &
    build_promtail &
    build_tempo &

    wait || { log_error "One or more monitoring builds failed"; exit 1; }
}

build_all() {
    for svc in "${SERVICES[@]}"; do
        build_service "$svc" &
    done
    build_public_page &
    build_caddy &
    build_prometheus &
    build_grafana &
    build_loki &
    build_promtail &
    build_tempo &

    wait || { log_error "One or more builds failed"; exit 1; }
}

deploy() {
    log "Deploying to server..."

    local STAGING=$(mktemp -d)
    # Extend the existing EXIT trap (timing-file cleanup) instead of replacing it.
    trap "cleanup_timing_file; rm -rf $STAGING" EXIT

    mkdir -p "$STAGING/compose" "$STAGING/env" "$STAGING/mongo"

    cp "$COMPOSE_FILE" "$STAGING/compose/docker-compose.yml"
    cp "$INFRA_DIR/env/"*.env.prod "$STAGING/env/"
    cp "$INFRA_DIR/env/infra.env.prod" "$STAGING/compose/.env"
    cp "$INFRA_DIR/mongo/mongo-startup.sh" "$STAGING/mongo/"

    log "Transferring files..."
    local transfer_start=$(date +%s)
    rsync -avz -e "ssh -o StrictHostKeyChecking=accept-new" \
        "$STAGING/" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/"
    add_timing "Transfer files to server" "$(( $(date +%s) - transfer_start ))"

    log "Starting services on remote..."
    local remote_start=$(date +%s)
    ssh "$SERVER_USER@$SERVER_IP" << EOF
        set -e
        cd /opt/forgestack

        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin docker.io 2>/dev/null

        docker compose -f compose/docker-compose.yml up -d mongodb redis zookeeper kafka
        sleep 3

        docker compose -f compose/docker-compose.yml up -d ${SERVICES[*]} public-page

        docker compose -f compose/docker-compose.yml up -d

        docker image prune -f

        echo ""
        echo "=== Status ==="
        docker compose -f compose/docker-compose.yml ps
EOF

    add_timing "Remote pull + deploy" "$(( $(date +%s) - remote_start ))"
    log "Deploy complete!"
}

show_menu() {
    echo ""
    echo -e "${YELLOW}=== Deploy ===${NC}"
    echo ""
    echo "Current versions (app):"
    for svc in "${SERVICES[@]}"; do
        printf "  %-15s v%s\n" "$svc:" "$(get_version "$(service_image "$svc")")"
    done
    echo "  public-page:    v$(get_version $PUBLIC_PAGE_IMAGE)"
    echo ""
    echo "Current versions (proxy):"
    echo "  caddy:          v$(get_version $CADDY_IMAGE)"
    echo ""
    echo "Current versions (monitoring):"
    echo "  prometheus:     v$(get_version $PROMETHEUS_IMAGE)"
    echo "  grafana:        v$(get_version $GRAFANA_IMAGE)"
    echo "  loki:           v$(get_version $LOKI_IMAGE)"
    echo "  promtail:       v$(get_version $PROMTAIL_IMAGE)"
    echo "  tempo:          v$(get_version $TEMPO_IMAGE)"
    echo ""
    echo "1) Update frontend"
    echo "2) Update ALL apps (frontend + services)"
    echo "3) Update caddy (reverse proxy)"
    echo "4) Update monitoring stack"
    echo "5) Update ALL (app + proxy + monitoring)"
    echo "6) Deploy only (no builds)"
    echo "0) Exit"
    echo ""
    echo "Or type a service name to update just that service: ${SERVICES[*]}"
    echo ""
    read -p "Choice: " choice
}

# Docker login
echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin docker.io

if [ -n "$1" ]; then
    choice=$1
else
    show_menu
fi

case $choice in
    1) build_public_page; deploy; print_summary ;;
    2) build_apps; deploy; print_summary ;;
    3) build_caddy; deploy; print_summary ;;
    4) build_monitoring_stack; deploy; print_summary ;;
    5) build_all; deploy; print_summary ;;
    6) deploy; print_summary ;;
    0) exit 0 ;;
    *)
        # A service name (e.g. "service-1") updates just that service.
        if printf '%s\n' "${SERVICES[@]}" | grep -qx -- "$choice"; then
            build_service "$choice"; deploy; print_summary
        else
            log_error "Invalid choice"; exit 1
        fi
        ;;
esac
