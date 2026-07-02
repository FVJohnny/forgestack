#!/bin/bash
set -euo pipefail

# Use environment variables or defaults
ADMIN_USER="${MONGO_ADMIN_USER:-admin}"
ADMIN_PASS="${MONGO_ADMIN_PASS:-password}"
KEYFILE="/data/configdb/keyfile"

# Generate keyfile if it doesn't exist (needed for replica set auth)
if [ ! -f "$KEYFILE" ]; then
  echo "Generating keyfile for replica set authentication..."
  openssl rand -base64 756 > "$KEYFILE"
  chmod 400 "$KEYFILE"
  chown 999:999 "$KEYFILE"
fi

# Check if this is first run (no users exist yet)
FIRST_RUN=false
if [ ! -f "/data/db/.initialized" ]; then
  FIRST_RUN=true
  echo "First run detected - will initialize without auth first"
fi

if [ "$FIRST_RUN" = true ]; then
  # First run: start WITHOUT auth to create users
  echo "Starting MongoDB without auth for initial setup..."
  mongod --replSet rs0 --bind_ip_all &
  MONGO_PID=$!

  # Wait for mongod to accept connections
  echo "Waiting for MongoDB to start..."
  for i in {1..30}; do
    if mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1; then
      echo "MongoDB is up"
      break
    fi
    sleep 1
  done

  # Initialize replica set
  echo "Initializing replica set..."
  mongosh --quiet --eval "
    try {
      rs.status();
      print('Replica set already initialized');
    } catch (e) {
      print('Initializing replica set...');
      rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongodb:27017' }] });
    }
  " || true

  # Wait for replica set to elect primary
  echo "Waiting for replica set to be ready..."
  for i in {1..30}; do
    if mongosh --quiet --eval "rs.status().myState" 2>/dev/null | grep -q 1; then
      echo "Replica set is ready (PRIMARY)"
      break
    fi
    sleep 1
  done

  # Create admin user
  echo "Creating admin user..."
  mongosh --quiet admin --eval "
    db.createUser({
      user: '$ADMIN_USER',
      pwd: '$ADMIN_PASS',
      roles: [{ role: 'root', db: 'admin' }]
    });
    print('Admin user created successfully');
  "

  # Mark as initialized
  touch /data/db/.initialized

  # Stop MongoDB gracefully
  echo "Stopping MongoDB for restart with auth..."
  mongosh --quiet admin --eval "db.shutdownServer()" || kill $MONGO_PID
  wait $MONGO_PID 2>/dev/null || true
  sleep 2
fi

# Start MongoDB with auth enabled
echo "Starting MongoDB with authentication enabled..."
exec mongod --replSet rs0 --bind_ip_all --auth --keyFile "$KEYFILE"