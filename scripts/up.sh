#!/bin/bash
set -e

# Anvil's default test account #0
ANVIL_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Load environment variables
if [ -f .env ]; then
  # Load .env safely
  set -a
  source .env
  set +a
fi

# Check for ANVIL_FORK_URL
if [ -z "$ANVIL_FORK_URL" ] && [ -n "$1" ]; then
    ANVIL_FORK_URL=$1
fi

if [ -z "$ANVIL_FORK_URL" ]; then
  echo "ℹ️ ANVIL_FORK_URL is not set. Starting fresh local chain (no fork)."
  ANVIL_ARGS=""
else
  echo "🍴 Forking from: $ANVIL_FORK_URL"
  ANVIL_ARGS="--fork-url $ANVIL_FORK_URL"
  if [ -n "$ANVIL_FORK_BLOCK_NUMBER" ]; then
    echo "📌 Pinning block: $ANVIL_FORK_BLOCK_NUMBER"
    ANVIL_ARGS="$ANVIL_ARGS --fork-block-number $ANVIL_FORK_BLOCK_NUMBER"
  fi
fi
export ANVIL_ARGS

if [ -z "$BUNDLER_PRIVATE_KEY" ]; then
  echo "Error: BUNDLER_PRIVATE_KEY is not set in .env"
  exit 1
fi

echo "🚀 Starting Local Environment..."

# Export for docker-compose
export ANVIL_FORK_URL
export BUNDLER_PRIVATE_KEY

# Start containers with explicit env var passing
ANVIL_ARGS="$ANVIL_ARGS" docker compose up -d --remove-orphans

echo "⏳ Waiting for Anvil to be ready..."
for i in {1..30}; do
  if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "✅ Anvil is ready!"
    break
  fi
  sleep 1
done

# Get builder address
BUILDER_ADDRESS=$(cast wallet address --private-key $BUNDLER_PRIVATE_KEY)
echo "📍 Builder address: $BUILDER_ADDRESS"

# Check builder balance
BALANCE=$(cast balance $BUILDER_ADDRESS --rpc-url http://127.0.0.1:8545)
echo "💰 Builder balance: $BALANCE"

# Fund builder if needed (less than 1 ETH)
if [ $(echo "$BALANCE < 1000000000000000000" | bc) -eq 1 ]; then
  echo "💸 Funding Builder with 10 ETH..."
  cast send $BUILDER_ADDRESS \
    --value 10ether \
    --private-key $ANVIL_PRIVATE_KEY \
    --rpc-url http://127.0.0.1:8545 \
    > /dev/null 2>&1
  echo "✅ Builder funded!"
fi

# Deploy Paymaster if not set
if [ -z "$VITE_PAYMASTER_ADDRESS" ]; then
  echo "📦 Deploying Paymaster..."
  DEPLOY_OUTPUT=$(PRIVATE_KEY=$ANVIL_PRIVATE_KEY forge script script/DeployPaymaster.s.sol \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast 2>&1)
  
  PAYMASTER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Paymaster deployed at:" | awk '{print $4}')
  
  if [ -n "$PAYMASTER_ADDRESS" ]; then
    echo "✅ Paymaster deployed: $PAYMASTER_ADDRESS"
    
    # Update .env
    if grep -q "VITE_PAYMASTER_ADDRESS=" .env; then
      sed -i '' "s/VITE_PAYMASTER_ADDRESS=.*/VITE_PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS/" .env
    else
      echo "VITE_PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS" >> .env
    fi
    echo "✅ .env updated with Paymaster address"
  else
    echo "⚠️ Failed to deploy Paymaster"
    echo "$DEPLOY_OUTPUT"
  fi
else
  echo "ℹ️ Paymaster already set: $VITE_PAYMASTER_ADDRESS"
fi

echo ""
echo "🎉 Local environment ready!"
echo "   Anvil:     http://localhost:8545"
echo "   Bundler:   http://localhost:3000"
echo ""
echo "👉 Run 'pnpm dev' to start the frontend"
