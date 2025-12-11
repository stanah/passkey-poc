#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check for ANVIL_FORK_URL
if [ -z "$ANVIL_FORK_URL" ] && [ -n "$1" ]; then
    ANVIL_FORK_URL=$1
fi

if [ -z "$ANVIL_FORK_URL" ]; then
  echo "Error: ANVIL_FORK_URL is not set in .env"
  echo "Please set it in .env or pass it as an argument."
  exit 1
fi

# Note: Uses official alchemyplatform/rundler:latest image from Docker Hub

echo "Starting Local Environment..."
echo "Forking from: $ANVIL_FORK_URL"

# Export for docker-compose
export ANVIL_FORK_URL

docker compose up -d --remove-orphans

echo ""
echo "Local environment started!"
echo "  Anvil:   http://localhost:8545"
echo "  Bundler: http://localhost:3000"
