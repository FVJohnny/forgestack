#!/bin/bash
#
# One-shot provisioning of a fresh VPS for ForgeStack.
#
# Wraps infra/scripts/setup-server.sh: it pipes that script to the server over
# SSH (as root, using the box's root password on first run) with the right
# DEPLOY_USER and SSH_PUBKEY so that subsequent `npm run prod:update` deploys
# work passwordlessly as the deploy user.
#
# It reads SERVER_IP / SERVER_USER (the deploy user) from
# infra/env/infra.env.prod so there's a single source of truth shared with
# deploy.sh.
#
# Usage:
#   npm run prod:setup
#
# The script will prompt for the server's ROOT password (the one from your VPS
# provider), unless you pre-set it:
#   ROOT_PASS='...' npm run prod:setup          # non-interactive
#   ROOT_USER=root  npm run prod:setup          # override the bootstrap user
#   SSH_PUBKEY="$(cat ~/.ssh/id_rsa.pub)" npm run prod:setup   # use a different key

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$INFRA_DIR/env/infra.env.prod"
SETUP_SCRIPT="$SCRIPT_DIR/setup-server.sh"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()       { echo -e "${GREEN}==>${NC} $1"; }
log_warn()  { echo -e "${YELLOW}==>${NC} $1"; }
log_error() { echo -e "${RED}==>${NC} $1"; }

if [ ! -f "$ENV_FILE" ]; then
    log_error "$ENV_FILE not found. Copy infra.env.prod.example and fill it in first."
    exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SERVER_IP:?SERVER_IP must be set in infra.env.prod}"
# The deploy user we want to end up with (matches SERVER_USER used by deploy.sh).
DEPLOY_USER="${DEPLOY_USER:-${SERVER_USER:-deploy}}"
# The user we bootstrap as on a brand-new box (almost always root).
ROOT_USER="${ROOT_USER:-root}"

# Public key to authorize for the deploy user.
SSH_PUBKEY="${SSH_PUBKEY:-$(cat ~/.ssh/id_ed25519.pub 2>/dev/null || true)}"
if [ -z "$SSH_PUBKEY" ]; then
    log_error "No SSH public key found. Set SSH_PUBKEY=\"\$(cat ~/.ssh/<key>.pub)\" and retry."
    exit 1
fi

log "Target server : $SERVER_IP"
log "Bootstrap user: $ROOT_USER"
log "Deploy user   : $DEPLOY_USER"
log "Authorizing   : ${SSH_PUBKEY%% *} ...${SSH_PUBKEY##* }"
echo ""

REMOTE_ENV="DEPLOY_USER='$DEPLOY_USER' SSH_PUBKEY='$SSH_PUBKEY'"
if [ -n "${REMOTE_PATH:-}" ]; then
    REMOTE_ENV="$REMOTE_ENV REMOTE_PATH='$REMOTE_PATH'"
fi

# Prefer an existing key login; fall back to password auth via sshpass.
if ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
        "$ROOT_USER@$SERVER_IP" true 2>/dev/null; then
    log "Key-based SSH as $ROOT_USER works — running setup over the existing key."
    ssh -o StrictHostKeyChecking=accept-new "$ROOT_USER@$SERVER_IP" \
        "$REMOTE_ENV bash -s" < "$SETUP_SCRIPT"
else
    if ! command -v sshpass >/dev/null 2>&1; then
        log_error "Cannot SSH in with a key and 'sshpass' is not installed."
        log_error "Install it (brew install sshpass / apt-get install sshpass) or add your key to the box first."
        exit 1
    fi
    if [ -z "${ROOT_PASS:-}" ]; then
        read -rsp "Root password for $ROOT_USER@$SERVER_IP: " ROOT_PASS
        echo ""
    fi
    log "Running setup over password auth (first run on a fresh box)..."
    sshpass -p "$ROOT_PASS" ssh -o StrictHostKeyChecking=accept-new \
        "$ROOT_USER@$SERVER_IP" "$REMOTE_ENV bash -s" < "$SETUP_SCRIPT"
fi

echo ""
log "✅ Server provisioned. Verify the deploy user can reach Docker:"
echo "     ssh $DEPLOY_USER@$SERVER_IP 'docker ps'"
echo ""
log "Then deploy the full stack:"
echo "     npm run prod:update 6        # build + push + deploy everything"
echo "   or interactively: npm run prod:update   (choose 6 = ALL for a first deploy)"
