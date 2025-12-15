/**
 * Smart Account Client Implementation
 *
 * This module provides functionality to create and interact with
 * ERC-4337 smart accounts using WebAuthn passkeys as signers.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type Chain,
  type PublicClient,
  type WalletClient,
  parseAbi,
  concat,
  pad,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createSmartAccountClient,
  type SmartAccountClient,
} from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import {
  TENDERLY_CONFIG,
  ENTRYPOINT_ADDRESS_V07,
} from "./constants.js";
import {
  type StoredCredential,
  signWithPasskey,
  encodeWebAuthnSignature,
} from "./webauthnSigner.js";

/**
 * Tenderly Virtual TestNet chain definition
 */
export const tenderlyChain: Chain = {
  id: TENDERLY_CONFIG.chainId,
  name: "Tenderly Virtual TestNet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [TENDERLY_CONFIG.rpcUrl],
    },
  },
};

/**
 * @deprecated Use tenderlyChain instead
 * Local chain definition for Hardhat network (legacy)
 */
export const localChain: Chain = {
  id: 31337,
  name: "Localhost",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
};

/**
 * Create a public client for reading blockchain state
 */
export function createLocalPublicClient(): PublicClient {
  return createPublicClient({
    chain: tenderlyChain,
    transport: http(TENDERLY_CONFIG.rpcUrl),
  });
}

/**
 * Create a wallet client with a private key (for testing/funding)
 */
export function createLocalWalletClient(privateKey: Hex): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: tenderlyChain,
    transport: http(TENDERLY_CONFIG.rpcUrl),
  });
}

/**
 * Configuration for WebAuthn-based smart account
 */
export interface WebAuthnSmartAccountConfig {
  credential: StoredCredential;
  publicClient: PublicClient;
  bundlerUrl: string;
  paymasterUrl?: string;
  index?: bigint; // Salt for account creation
}

/**
 * WebAuthn Smart Account implementation
 * This wraps a simple smart account with WebAuthn signing capability
 */
export interface WebAuthnSmartAccount {
  address: Address;
  publicKey: { x: Hex; y: Hex };
  signUserOperation: (userOpHash: Hex) => Promise<Hex>;
  signMessage: (message: Hex) => Promise<Hex>;
}

/**
 * Create a WebAuthn-based smart account signer
 * This creates a custom signer that uses passkey for signing
 */
export async function createWebAuthnSmartAccount(
  config: WebAuthnSmartAccountConfig
): Promise<WebAuthnSmartAccount> {
  const { credential } = config;

  // Compute the account address based on the public key
  // Note: This is simplified - actual implementation depends on the account factory
  const accountAddress = computeWebAuthnAccountAddress(
    credential.publicKey,
    config.index ?? 0n
  );

  return {
    address: accountAddress,
    publicKey: credential.publicKey,

    signUserOperation: async (userOpHash: Hex): Promise<Hex> => {
      const webauthnSig = await signWithPasskey(credential, userOpHash);
      return encodeWebAuthnSignature(webauthnSig);
    },

    signMessage: async (message: Hex): Promise<Hex> => {
      const webauthnSig = await signWithPasskey(credential, message);
      return encodeWebAuthnSignature(webauthnSig);
    },
  };
}

/**
 * Compute account address for WebAuthn credentials
 * This uses CREATE2 deterministic address computation
 */
function computeWebAuthnAccountAddress(
  publicKey: { x: Hex; y: Hex },
  index: bigint
): Address {
  // In a real implementation, this would compute the CREATE2 address
  // based on the specific account factory being used
  // For this PoC, we return a deterministic address based on the public key

  // Pack the public key coordinates with the index
  const packed = concat([
    publicKey.x,
    publicKey.y,
    pad(toHex(index), { size: 32 }),
  ]);

  // Hash to get a deterministic address (simplified)
  // Real implementation would use the actual factory's CREATE2 logic
  const hash = packed.slice(0, 42) as Address;
  return hash;
}

/**
 * Create a bundler client for sending UserOperations
 * This can be used with a self-hosted bundler or Pimlico
 */
export function createBundlerClient(bundlerUrl: string) {
  return createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });
}

/**
 * Create a complete smart account client with bundler integration
 */
import { createModularAccountV2Client } from "@account-kit/smart-contracts";
import { split } from "@aa-sdk/core";

import { z } from "zod";
import {
  ALCHEMY_MODULAR_ACCOUNT_FACTORY,
  ALCHEMY_WEBAUTHN_VALIDATOR,
} from "./constants.js";

/**
 * Bundler methods that should be routed to the bundler RPC
 */
const BUNDLER_METHODS = [
  "eth_sendUserOperation",
  "eth_estimateUserOperationGas",
  "eth_getUserOperationReceipt",
  "eth_getUserOperationByHash",
  "eth_supportedEntryPoints",
];

/**
 * Create a complete smart account client using Alchemy SDK
 */
/**
 * Create a complete smart account client using Alchemy SDK
 */
export async function createAlchemySmartAccountClient(config: {
  passkeyParams: {
    credential: { id: string; publicKey: Hex };
    getFn?: (options?: CredentialRequestOptions) => Promise<Credential | null>;
    rpId: string;
  };
  bundlerUrl: string;
  rpcUrl?: string; // Optional, defaults to local Anvil
}) {
  const PAYMASTER_ADDRESS = import.meta.env
    .VITE_PAYMASTER_ADDRESS as `0x${string}` | undefined;

  // Use local chain definition (Soneium Minato Fork)
  const rpcUrl = config.rpcUrl ?? "http://127.0.0.1:8545";
  const bundlerUrl = config.bundlerUrl;

  const chain = {
    ...tenderlyChain,
    id: 1946, // Soneium Minato
    name: "Soneium Minato (Fork)",
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  };

  // Use split transport to route bundler methods to Rundler
  // and other methods (state reads, etc.) to Anvil
  const transport = split({
    overrides: [
      {
        methods: BUNDLER_METHODS,
        transport: http(bundlerUrl),
      },
    ],
    fallback: http(rpcUrl),
  });

  const smartAccountClient = await createModularAccountV2Client({
    chain,
    transport,
    mode: "webauthn",
    factoryAddress: ALCHEMY_MODULAR_ACCOUNT_FACTORY,
    validatorAddress: ALCHEMY_WEBAUTHN_VALIDATOR,
    ...config.passkeyParams,
  } as any); // Cast to any to avoid complex type matching issues with custom params

  // Inject paymaster fields for v0.7 (separate paymaster fields, not paymasterAndData)
  if (PAYMASTER_ADDRESS) {
    const addPaymaster = (uo: any) => {
      const withPm = {
        ...uo,
        // v0.7 fields
        paymaster: PAYMASTER_ADDRESS as `0x${string}`,
        paymasterData: "0x" as Hex,
        paymasterVerificationGasLimit: 120_000n,
        paymasterPostOpGasLimit: 60_000n,
      };
      // v0.6 fallback (some stacks still read paymasterAndData)
      withPm.paymasterAndData = PAYMASTER_ADDRESS as Hex;
      return withPm;
    };

    const origSend = smartAccountClient.sendUserOperation.bind(
      smartAccountClient
    );

    smartAccountClient.sendUserOperation = async (args: any) => {
      if ("uo" in args) {
        console.debug("🧩 Injecting paymaster into UO (uo-key)", args.uo);
        return origSend({ ...args, uo: addPaymaster(args.uo) });
      }
      console.debug("🧩 Injecting paymaster into UO (direct)", args);
      return origSend(addPaymaster(args));
    };

    console.log(`✅ Paymaster injected: ${PAYMASTER_ADDRESS}`);
  } else {
    console.warn("⚠️ Paymaster not configured - user must have ETH");
  }

  return {
    smartAccountClient,
  };
}

/**
 * Send a test transaction from a smart account
 */
export async function sendTestTransaction(
  smartAccountClient: SmartAccountClient,
  to: Address,
  value: bigint = 0n,
  data: Hex = "0x"
) {
  const hash = await smartAccountClient.sendUserOperation({
    calls: [{ to, value, data }],
  });

  return hash;
}

/**
 * Get the entry point contract interface
 */
export const entryPointAbi = parseAbi([
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function depositTo(address account) payable",
]);

/**
 * Fund a smart account's entry point deposit
 */
export async function fundEntryPointDeposit(
  walletClient: WalletClient,
  publicClient: PublicClient,
  accountAddress: Address,
  amount: bigint
) {
  const { request } = await publicClient.simulateContract({
    address: ENTRYPOINT_ADDRESS_V07,
    abi: entryPointAbi,
    functionName: "depositTo",
    args: [accountAddress],
    value: amount,
    account: walletClient.account!,
  });

  const hash = await walletClient.writeContract(request);
  return hash;
}

/**
 * Check the entry point balance for an account
 */
export async function getEntryPointBalance(
  publicClient: PublicClient,
  accountAddress: Address
): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: ENTRYPOINT_ADDRESS_V07,
    abi: entryPointAbi,
    functionName: "balanceOf",
    args: [accountAddress],
  });

  return balance as bigint;
}
