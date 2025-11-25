/**
 * Passkey PoC Test Script
 *
 * This script demonstrates the basic flow of:
 * 1. Creating a smart account with a private key signer
 * 2. Funding the account
 * 3. Sending a UserOperation
 *
 * Note: WebAuthn passkey creation requires a browser environment.
 * This script tests the infrastructure setup.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  localChain,
  createLocalPublicClient,
  createLocalWalletClient,
  ENTRYPOINT_ADDRESS_V07,
  entryPointAbi,
  fundEntryPointDeposit,
  getEntryPointBalance,
} from "../src/index.js";

// Default Hardhat accounts
const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const USER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

async function main() {
  console.log("═".repeat(60));
  console.log("       Passkey PoC - Infrastructure Test");
  console.log("═".repeat(60));
  console.log();

  // Create clients
  const publicClient = createLocalPublicClient();
  const deployerWallet = createLocalWalletClient(DEPLOYER_KEY);
  const userWallet = createLocalWalletClient(USER_KEY);

  const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);
  const userAccount = privateKeyToAccount(USER_KEY);

  console.log("📍 Configuration:");
  console.log(`   RPC URL: http://127.0.0.1:8545`);
  console.log(`   Bundler URL: http://127.0.0.1:4337`);
  console.log(`   EntryPoint: ${ENTRYPOINT_ADDRESS_V07}`);
  console.log();

  console.log("👤 Accounts:");
  console.log(`   Deployer: ${deployerAccount.address}`);
  console.log(`   User: ${userAccount.address}`);
  console.log();

  // Check connection
  try {
    const chainId = await publicClient.getChainId();
    console.log(`✅ Connected to chain ID: ${chainId}`);

    const blockNumber = await publicClient.getBlockNumber();
    console.log(`✅ Current block number: ${blockNumber}`);

    // Check deployer balance
    const deployerBalance = await publicClient.getBalance({
      address: deployerAccount.address,
    });
    console.log(`✅ Deployer balance: ${formatEther(deployerBalance)} ETH`);

    // Check if EntryPoint exists (has code)
    const entryPointCode = await publicClient.getCode({
      address: ENTRYPOINT_ADDRESS_V07,
    });

    if (entryPointCode && entryPointCode !== "0x") {
      console.log(`✅ EntryPoint v0.7 deployed at ${ENTRYPOINT_ADDRESS_V07}`);

      // Get a sample account's nonce from EntryPoint
      const nonce = await publicClient.readContract({
        address: ENTRYPOINT_ADDRESS_V07,
        abi: entryPointAbi,
        functionName: "getNonce",
        args: [userAccount.address, 0n],
      });
      console.log(`   Nonce for user account: ${nonce}`);
    } else {
      console.log(`⚠️  EntryPoint not deployed - fork may not include it`);
      console.log(
        `   Consider using a different fork block or deploying locally`
      );
    }
  } catch (error: any) {
    console.error("❌ Connection failed:", error.message);
    console.log();
    console.log("Make sure to start the local node first:");
    console.log("  pnpm hardhat node");
    process.exit(1);
  }

  console.log();
  console.log("═".repeat(60));
  console.log("  Infrastructure check complete!");
  console.log();
  console.log("  Next steps:");
  console.log("  1. Start the bundler: pnpm ts-node scripts/setup-bundler.ts");
  console.log("  2. Run the frontend: cd .. && pnpm dev");
  console.log("  3. Create a passkey and test smart account operations");
  console.log("═".repeat(60));
}

main().catch(console.error);
