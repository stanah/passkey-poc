/**
 * Passkey PoC - Main Entry Point
 *
 * This module exports all the necessary functions and types
 * for using WebAuthn passkeys with ERC-4337 smart accounts.
 */

// WebAuthn Signer exports
export {
  createPasskeyCredential,
  signWithPasskey,
  encodeWebAuthnSignature,
  computeSmartAccountAddress,
  credentialStorage,
  type StoredCredential,
  type WebAuthnSignature,
} from "./lib/webauthnSigner.js";

// Smart Account Client exports
export {
  createLocalPublicClient,
  createLocalWalletClient,
  createWebAuthnSmartAccount,
  createBundlerClient,
  createCompleteSmartAccountClient,
  sendTestTransaction,
  fundEntryPointDeposit,
  getEntryPointBalance,
  localChain,
  entryPointAbi,
  type WebAuthnSmartAccountConfig,
  type WebAuthnSmartAccount,
} from "./lib/smartAccountClient.js";

// Constants exports
export {
  ENTRYPOINT_ADDRESS_V07,
  ENTRYPOINT_ADDRESS_V06,
  SIMPLE_ACCOUNT_FACTORY_ADDRESS,
  P256_VERIFIER_ADDRESS,
  LOCAL_CONFIG,
  SEPOLIA_CONFIG,
  WEBAUTHN_CONFIG,
} from "./lib/constants.js";

// Re-export viem types for convenience
export type { Hex, Address } from "viem";
