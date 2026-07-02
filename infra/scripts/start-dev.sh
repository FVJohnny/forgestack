#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting development environment..."

# Go to project root
cd "$(dirname "$0")/../.."

# --- Node.js ---
# This project targets the Node version pinned in .nvmrc. We never auto-install
# Node or modify your shell config; if nvm is available we'll switch to the
# pinned version, otherwise we just warn and continue.
echo "📦 Checking Node.js..."

REQUIRED_NODE_MAJOR=$(tr -dc '0-9.' < .nvmrc | cut -d. -f1)

# Load nvm if it's already installed (it's a shell function, not a binary).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +e
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# If nvm is available and the pinned version is installed, use it.
type nvm &>/dev/null && nvm use &>/dev/null
set -e

if ! command -v node &>/dev/null; then
    echo "  ❌ Node.js not found. Install Node.js ${REQUIRED_NODE_MAJOR}.x (see .nvmrc) and re-run."
    echo "     With nvm:    nvm install && nvm use"
    echo "     Or download: https://nodejs.org/"
    exit 1
fi

NODE_MAJOR=$(node -v | tr -dc '0-9.' | cut -d. -f1)
if [ "$NODE_MAJOR" = "$REQUIRED_NODE_MAJOR" ]; then
    echo "  ✅ Node.js $(node -v)"
else
    echo "  ⚠️  Node.js $(node -v) detected, but this project targets v${REQUIRED_NODE_MAJOR} (.nvmrc)."
    echo "     Recommended: nvm install && nvm use   (continuing anyway)"
fi

# --- Docker ---
echo "🐳 Checking Docker..."
if command -v docker &>/dev/null && docker info &>/dev/null; then
    echo "  ✅ Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') already installed and running."
else
    if ! command -v docker &>/dev/null; then
        case "$(uname -s)" in
            Darwin)
                echo "  ❌ Docker not found. Install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
                echo "  Then re-run this script."
                exit 1
                ;;
            Linux)
                echo "  Installing Docker..."
                curl -fsSL https://get.docker.com | sh
                sudo usermod -aG docker "$USER"
                echo "  ✅ Docker installed. You may need to log out and back in for group permissions."
                ;;
        esac
    else
        echo "  ❌ Docker is installed but not running. Start Docker Desktop and re-run this script."
        exit 1
    fi
fi

# Create .env files for each service if they don't exist
echo "📋 Setting up service environment files..."
for service_dir in backend/services/*; do
    if [ -d "$service_dir" ]; then
        service_name=$(basename "$service_dir")

        # Check if .env exists for this service
        if [ ! -f "$service_dir/.env" ]; then
            if [ -f "$service_dir/.env.example" ]; then
                echo "  Creating .env for $service_name from $service_dir/.env.example..."
                cp "$service_dir/.env.example" "$service_dir/.env"
            else
                echo "  ⚠️  No .env.example found for $service_name — skipping (create one to enable this service)."
            fi
        else
            echo "  .env already exists for $service_name"
        fi
    fi
done

# Create frontend .env.local if it doesn't exist
if [ ! -f "frontend/public-page/.env.local" ]; then
    echo "  Creating .env.local for public-page from frontend/public-page/.env.local.example..."
    cp frontend/public-page/.env.local.example frontend/public-page/.env.local
else
    echo "  .env.local already exists for public-page"
fi

# Create Prometheus internal-api-key if it doesn't exist
if [ ! -f "infra/monitoring/prometheus/internal-api-key" ]; then
    echo "  Creating internal-api-key for Prometheus..."
    cp infra/monitoring/prometheus/internal-api-key.example infra/monitoring/prometheus/internal-api-key
else
    echo "  internal-api-key already exists for Prometheus"
fi

echo "📦 Installing dependencies..."
npm install

echo "🪝 Installing git hooks..."
npx husky install

echo "🐳 Starting Docker containers..."

# Check if Kafka had a previous failure and clean up if needed
echo "  Checking for stale Kafka/ZooKeeper data..."
if docker ps -a | grep -q "kafka-ephemeral.*Exited"; then
    echo "  ⚠️  Detected previous Kafka failure. Cleaning up..."
    docker compose -f infra/compose/docker-compose.dev.yml rm -sf kafka zookeeper 2>/dev/null || true
    echo "  Removing ZooKeeper volumes to clear stale data..."
    docker volume rm docker_zookeeper_data_dev docker_zookeeper_log_dev 2>/dev/null || true
    echo "  ✅ Cleanup complete. Starting fresh..."
else
    echo "  Removing existing Kafka container to ensure fresh start..."
    docker compose -f infra/compose/docker-compose.dev.yml rm -sf kafka 2>/dev/null || true
fi

# Attempt to start containers
echo "  Starting all containers..."
if ! docker compose -f infra/compose/docker-compose.dev.yml up --build -d; then
    echo "  ⚠️  Initial startup failed. Attempting recovery..."
    echo "  Cleaning up all containers and volumes..."
    docker compose -f infra/compose/docker-compose.dev.yml down -v 2>/dev/null || true
    echo "  Retrying startup with clean state..."
    docker compose -f infra/compose/docker-compose.dev.yml up --build -d
fi

# Trust Caddy's self-signed CA certificate (only needed once, but safe to re-run)
echo ""
./infra/scripts/trust-caddy-cert.sh || echo "  ⚠️  Certificate trust failed — you can run 'npm run dev:trust-cert' manually later."

echo ""
echo "✅ Development environment started!"
echo ""
echo "🌐 URLs:"
echo "  Frontend:      https://localhost"
echo "  API:           https://service1.localhost/api/v1"
echo "  Grafana:       https://grafana.localhost"
echo "  Mongo Express: https://mongo.localhost"
echo "  Portainer:     https://portainer.localhost"
echo ""
echo "📋 Attaching to service-1 logs in 2s (Ctrl+C to detach)..."
sleep 2
docker compose -f infra/compose/docker-compose.dev.yml logs -f service-1