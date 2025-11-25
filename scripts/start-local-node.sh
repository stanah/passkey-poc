#!/bin/bash

# Start local Hardhat node with Sepolia fork
# This provides access to deployed ERC-4337 infrastructure

echo "Starting Hardhat node with Sepolia fork..."
echo "EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032"
echo "EntryPoint v0.6: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Start node
npx hardhat node --hostname 0.0.0.0 --port 8545
