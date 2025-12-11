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

# Check if rundler image exists
if ! docker image inspect rundler &> /dev/null; then
  echo "ERROR: 'rundler' Docker image not found!"
  echo ""
  echo "You need to build it locally. Run these commands:"
  echo ""
  echo "  git clone https://github.com/alchemyplatform/rundler.git"
  echo "  cd rundler"
  echo "  git submodule update --init --recursive"
  echo "  docker buildx build . -t rundler"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "Starting Local Environment..."
echo "Forking from: $ANVIL_FORK_URL"

# Export for docker-compose
export ANVIL_FORK_URL

docker compose up -d --remove-orphans

echo ""
echo "Local environment started!"
echo "  Anvil:   http://localhost:8545"
echo "  Bundler: http://localhost:3000"
