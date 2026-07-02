#!/bin/bash
#
# Prepares a fresh Ubuntu server to run the application's Docker Compose stack.
#
# It is idempotent — safe to re-run. It does NOT deploy the app; after it
# finishes, run `npm run prod:update` from your machine to build + ship the
# images and bring the stack up (that script handles docker login, rsync of
# the compose/env files, and `docker compose up -d`).
#
# What it does:
#   - Installs Docker Engine + the compose plugin (official Docker apt repo)
#   - Creates a non-root deploy user, adds it to the docker + sudo groups
#   - Installs your SSH public key for that user (passwordless deploys)
#   - Opens the firewall (UFW) for SSH + HTTP + HTTPS
#   - Creates the deploy directory (/opt/forgestack) owned by the deploy user
#   - Enables swap if the box has none (Kafka/Mongo/JVM headroom)
#
# Usage — run from your laptop, piping this script to the server over SSH.
# You MUST provide your SSH public key via SSH_PUBKEY so the deploy user can
# log in without a password afterwards.
#
#   # First run on a fresh box where only root password login works:
#   sshpass -p 'ROOT_PASSWORD' ssh -o StrictHostKeyChecking=accept-new \
#       root@SERVER_IP "SSH_PUBKEY='$(cat ~/.ssh/id_ed25519.pub)' bash -s" \
#       < infra/scripts/setup-server.sh
#
#   # Or, if you can already SSH in as root with a key:
#   ssh root@SERVER_IP "SSH_PUBKEY='$(cat ~/.ssh/id_ed25519.pub)' bash -s" \
#       < infra/scripts/setup-server.sh
#
# Configure via env vars passed through SSH (defaults shown):
#   DEPLOY_USER   deploy user to create           (default: deploy)
#   SSH_PUBKEY    public key to authorize          (REQUIRED — no default)
#   REMOTE_PATH   deploy directory                 (default: /opt/forgestack)
#   SWAP_SIZE     swapfile size if none exists     (default: 4G; set to 0 to skip)

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEPLOY_USER="${DEPLOY_USER:-deploy}"
REMOTE_PATH="${REMOTE_PATH:-/opt/forgestack}"
SWAP_SIZE="${SWAP_SIZE:-4G}"

# Public key to authorize for the deploy user — pass it in:
#   SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)"
SSH_PUBKEY="${SSH_PUBKEY:-}"
if [ -z "$SSH_PUBKEY" ]; then
  echo "ERROR: SSH_PUBKEY is required. Re-run with SSH_PUBKEY=\"\$(cat ~/.ssh/id_ed25519.pub)\"" >&2
  exit 1
fi

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()      { echo -e "${GREEN}==>${NC} $1"; }
log_warn() { echo -e "${YELLOW}==>${NC} $1"; }
log_error(){ echo -e "${RED}==>${NC} $1"; }

if [ "$(id -u)" -ne 0 ]; then
    log_error "This script must run as root (it creates users and installs packages)."
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# 1. Base packages
# ---------------------------------------------------------------------------
log "Updating apt and installing base packages..."
apt-get update -y
apt-get install -y \
    ca-certificates curl gnupg lsb-release \
    ufw rsync git htop ncdu jq

# ---------------------------------------------------------------------------
# 2. Docker Engine + compose plugin (official repo)
# ---------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker + compose plugin already installed ($(docker --version))."
else
    log "Installing Docker Engine + compose plugin..."
    install -m 0755 -d /etc/apt/keyrings
    if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
    fi
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

log "Enabling and starting Docker..."
systemctl enable --now docker

# ---------------------------------------------------------------------------
# 3. Deploy user
# ---------------------------------------------------------------------------
if id "$DEPLOY_USER" >/dev/null 2>&1; then
    log "User '$DEPLOY_USER' already exists."
else
    log "Creating user '$DEPLOY_USER'..."
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi

log "Adding '$DEPLOY_USER' to docker and sudo groups..."
usermod -aG docker "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER"

# Passwordless sudo so non-interactive deploys never block on a prompt.
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 0440 "/etc/sudoers.d/90-$DEPLOY_USER"

# ---------------------------------------------------------------------------
# 4. SSH key for the deploy user
# ---------------------------------------------------------------------------
log "Installing SSH public key for '$DEPLOY_USER'..."
USER_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$USER_HOME/.ssh"
AUTH_KEYS="$USER_HOME/.ssh/authorized_keys"
touch "$AUTH_KEYS"
if ! grep -qF "$SSH_PUBKEY" "$AUTH_KEYS" 2>/dev/null; then
    echo "$SSH_PUBKEY" >> "$AUTH_KEYS"
    log "  key added."
else
    log "  key already present."
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"

# ---------------------------------------------------------------------------
# 5. Deploy directory
# ---------------------------------------------------------------------------
log "Creating deploy directory $REMOTE_PATH..."
mkdir -p "$REMOTE_PATH"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REMOTE_PATH"

# ---------------------------------------------------------------------------
# 6. Firewall
# ---------------------------------------------------------------------------
log "Configuring UFW firewall (SSH, HTTP, HTTPS)..."
ufw allow OpenSSH    >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp     >/dev/null
ufw allow 443/tcp    >/dev/null
ufw --force enable   >/dev/null
log_warn "UFW enabled. Only 22/80/443 are open. Monitoring UIs are reached via Caddy on 443."

# ---------------------------------------------------------------------------
# 7. Swap (Kafka/Mongo/JVM headroom on small boxes)
# ---------------------------------------------------------------------------
if [ "$SWAP_SIZE" != "0" ]; then
    if swapon --show | grep -q '/swapfile'; then
        log "Swap already configured."
    elif [ "$(swapon --show | wc -l)" -gt 0 ]; then
        log "Swap already present (non-swapfile)."
    else
        log "Creating ${SWAP_SIZE} swapfile..."
        fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
fi

# ---------------------------------------------------------------------------
# 8. Kernel tuning for the stack
# ---------------------------------------------------------------------------
log "Applying sysctl tuning (vm.max_map_count for Mongo/ES-style mmap, file limits)..."
cat > /etc/sysctl.d/99-app.conf <<'SYSCTL'
vm.max_map_count=262144
vm.swappiness=10
fs.file-max=262144
SYSCTL
sysctl --system >/dev/null

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
log "✅ Server prepared."
echo ""
echo "   Docker:        $(docker --version)"
echo "   Compose:       $(docker compose version | head -1)"
echo "   Deploy user:   $DEPLOY_USER (docker + sudo, key-based SSH)"
echo "   Deploy dir:    $REMOTE_PATH"
echo ""
echo "   Next steps on your workstation:"
echo "     1. Point infra/env/infra.env.prod at this server:"
echo "          SERVER_IP=<this server's IP>"
echo "          SERVER_USER=$DEPLOY_USER"
echo "     2. Verify SSH:   ssh $DEPLOY_USER@<IP> 'docker ps'"
echo "     3. Deploy:       npm run prod:update   (choose 7 = ALL for a first deploy)"
echo ""
log_warn "MongoDB starts as a single-node replica set (rs0) via mongo/mongo-startup.sh —"
log_warn "the first 'docker compose up' initializes it automatically. No manual step needed."
