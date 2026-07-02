#!/bin/bash

# Extracts Caddy's internal root CA certificate from the running container
# and installs it as a trusted certificate on macOS or Linux.
# This eliminates browser SSL warnings for *.localhost

set -e

CERT_PATH="/tmp/caddy-root-ca.crt"

echo "🔐 Checking Caddy's local CA certificate..."

# Check if Caddy container is running
if ! docker compose -f infra/compose/docker-compose.dev.yml ps caddy --status running --quiet 2>/dev/null | grep -q .; then
    echo "  ❌ Caddy container is not running. Start the dev stack first: npm run dev:start"
    exit 1
fi

# Extract the root CA certificate from the Caddy container
docker compose -f infra/compose/docker-compose.dev.yml exec -T caddy sh -c 'cat /data/caddy/pki/authorities/local/root.crt' > "$CERT_PATH" 2>/dev/null

if [ ! -s "$CERT_PATH" ]; then
    echo "  ❌ Failed to extract certificate. Caddy may not have generated it yet."
    echo "  Try again in a few seconds after Caddy finishes starting."
    exit 1
fi

# Check if already trusted, install based on OS
case "$(uname -s)" in
    Darwin)
        # Check if the cert is already in the keychain by matching its SHA-1 fingerprint
        CERT_SHA1=$(openssl x509 -in "$CERT_PATH" -noout -fingerprint -sha1 2>/dev/null | sed 's/.*=//;s/://g')
        if security find-certificate -a -Z /Library/Keychains/System.keychain 2>/dev/null | grep -qi "$CERT_SHA1"; then
            echo "  ✅ Certificate already trusted — skipping."
            rm -f "$CERT_PATH"
            exit 0
        fi
        echo "  Installing certificate to macOS Keychain (requires sudo)..."
        sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_PATH"
        ;;
    Linux)
        # Check if the cert is already installed
        if [ -f /usr/local/share/ca-certificates/caddy-local.crt ] && diff -q "$CERT_PATH" /usr/local/share/ca-certificates/caddy-local.crt >/dev/null 2>&1; then
            echo "  ✅ Certificate already trusted — skipping."
            rm -f "$CERT_PATH"
            exit 0
        fi
        echo "  Installing certificate to system trust store (requires sudo)..."
        sudo cp "$CERT_PATH" /usr/local/share/ca-certificates/caddy-local.crt
        sudo update-ca-certificates
        ;;
    *)
        echo "  ❌ Unsupported OS: $(uname -s)"
        echo "  Manually import $CERT_PATH into your system's certificate store."
        exit 1
        ;;
esac

rm -f "$CERT_PATH"

echo "  ✅ Certificate installed! Restart your browser to apply."
echo "  All *.localhost subdomains will now be trusted."
