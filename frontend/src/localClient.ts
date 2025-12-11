/**
 * Local Smart Account Client
 * 
 * This module creates a SmartAccountClient that sends transactions
 * to a local Bundler (Rundler) and Anvil, bypassing Account Kit's
 * Alchemy-only transport.
 * 
 * Usage:
 * 1. User authenticates via Account Kit (email/passkey)
 * 2. Get the signer from Account Kit's useSigner() hook
 * 3. Create a local client with createLocalClient(signer)
 * 4. Use localClient.sendUserOperation() to send transactions locally
 */

import { createSmartAccountClient, split } from "@aa-sdk/core";
import { createLightAccount } from "@account-kit/smart-contracts";
import { http, type Chain } from "viem";
import type { SmartAccountSigner } from "@aa-sdk/core";

// Environment configuration
const LOCAL_RPC_URL = import.meta.env.VITE_LOCAL_RPC_URL || "http://127.0.0.1:8545";
const LOCAL_BUNDLER_URL = import.meta.env.VITE_LOCAL_BUNDLER_URL || "http://127.0.0.1:3000";
const PAYMASTER_ADDRESS = import.meta.env.VITE_PAYMASTER_ADDRESS as `0x${string}` | undefined;

// Bundler RPC methods to route to local Rundler
const BUNDLER_METHODS = [
  "eth_sendUserOperation",
  "eth_estimateUserOperationGas",
  "eth_getUserOperationReceipt",
  "eth_getUserOperationByHash",
  "eth_supportedEntryPoints",
];

// Local Anvil chain definition
export const localChain: Chain = {
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [LOCAL_RPC_URL] },
  },
};

// Split transport: Bundler methods -> local Rundler, others -> local Anvil
const localTransport = split({
  overrides: [
    {
      methods: BUNDLER_METHODS,
      transport: http(LOCAL_BUNDLER_URL),
    },
  ],
  fallback: http(LOCAL_RPC_URL),
});

/**
 * Create a local SmartAccountClient for testing with local Bundler.
 * If VITE_PAYMASTER_ADDRESS is set, gas will be sponsored by the Paymaster.
 * 
 * @param signer - The signer from Account Kit (from useSigner() hook)
 * @returns Promise<SmartAccountClient> configured for local development
 */
export async function createLocalClient(signer: SmartAccountSigner) {
  // Create a Light Account using the Account Kit signer
  const account = await createLightAccount({
    chain: localChain,
    signer,
    transport: http(LOCAL_RPC_URL),
  });

  // Create SmartAccountClient with split transport and optional Paymaster
  const client = createSmartAccountClient({
    chain: localChain,
    transport: localTransport,
    account,
    // Paymaster configuration: sponsor gas if address is set
    ...(PAYMASTER_ADDRESS && {
      paymasterAndData: {
        dummyPaymasterAndData: () => PAYMASTER_ADDRESS,
        paymasterAndData: async () => PAYMASTER_ADDRESS,
      },
    }),
  });

  console.log(
    PAYMASTER_ADDRESS 
      ? `✅ Paymaster configured: ${PAYMASTER_ADDRESS}` 
      : "⚠️ No Paymaster configured - user must have ETH"
  );

  return client;
}

/**
 * Send a test transaction (0 ETH to self) using the local client.
 * 
 * @param client - The local SmartAccountClient
 * @returns Promise<string> - The transaction hash
 */
export async function sendLocalTestTransaction(
  client: Awaited<ReturnType<typeof createLocalClient>>
): Promise<string> {
  const address = client.account.address;
  
  const result = await client.sendUserOperation({
    uo: {
      target: address,
      data: "0x",
      value: 0n,
    },
  });

  const txHash = await client.waitForUserOperationTransaction(result);
  return txHash;
}

export { LOCAL_RPC_URL, LOCAL_BUNDLER_URL };
