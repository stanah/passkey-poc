#!/bin/bash
# Paymaster デプロイスクリプト
# ローカル Anvil に VerifyingPaymaster をデプロイして資金をデポジット

set -e

RPC_URL="http://127.0.0.1:8545"
ENTRYPOINT="0x0000000071727De22E5E9d8BAf0edAc6f37da032"

# Anvil のデフォルトアカウント #0 (10,000 ETH 持ってる)
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo "🚀 Deploying VerifyingPaymaster..."

# デプロイ
RESULT=$(forge create contracts/VerifyingPaymaster.sol:VerifyingPaymaster \
  --constructor-args $ENTRYPOINT \
  --private-key $DEPLOYER_KEY \
  --rpc-url $RPC_URL \
  --json)

PAYMASTER_ADDRESS=$(echo $RESULT | jq -r '.deployedTo')

if [ -z "$PAYMASTER_ADDRESS" ] || [ "$PAYMASTER_ADDRESS" = "null" ]; then
  echo "❌ Failed to deploy Paymaster"
  echo $RESULT
  exit 1
fi

echo "✅ Paymaster deployed at: $PAYMASTER_ADDRESS"

# EntryPoint にデポジット (10 ETH)
echo "💰 Depositing 10 ETH to Paymaster..."
cast send $ENTRYPOINT "depositTo(address)" $PAYMASTER_ADDRESS \
  --value 10ether \
  --private-key $DEPLOYER_KEY \
  --rpc-url $RPC_URL

# デポジット確認
BALANCE=$(cast call $ENTRYPOINT "balanceOf(address)(uint256)" $PAYMASTER_ADDRESS --rpc-url $RPC_URL)
echo "✅ Paymaster deposit balance: $BALANCE wei"

echo ""
echo "🎉 Done! Add this to your .env:"
echo "VITE_PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS"
