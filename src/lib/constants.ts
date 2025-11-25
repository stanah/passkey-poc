/**
 * ERC-4337 Contract Addresses
 * These are canonical addresses deployed across all EVM chains
 */
export const ENTRYPOINT_ADDRESS_V07 =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;
export const ENTRYPOINT_ADDRESS_V06 =
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;

/**
 * Simple Account Factory (deployed on Sepolia and most testnets)
 * Source: https://github.com/eth-infinitism/account-abstraction
 */
export const SIMPLE_ACCOUNT_FACTORY_ADDRESS =
  "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985" as const;

/**
 * WebAuthn P256 Verifier Precompile (EIP-7212)
 * Available on chains that support the RIP-7212 precompile
 */
export const P256_VERIFIER_ADDRESS =
  "0x0000000000000000000000000000000000000100" as const;

/**
 * Safe WebAuthn Signer Factory
 * For creating on-chain passkey signers compatible with Safe accounts
 */
export const SAFE_WEBAUTHN_SIGNER_FACTORY =
  "0x4E4E3C2e2CdA9d2D2F9E3a6E6E9E2C2E3D4E5F6A" as const;

/**
 * Local Development Configuration
 */
export const LOCAL_CONFIG = {
  rpcUrl: "http://127.0.0.1:8545",
  bundlerUrl: "http://127.0.0.1:4337",
  chainId: 31337,
} as const;

/**
 * Sepolia Testnet Configuration
 */
export const SEPOLIA_CONFIG = {
  rpcUrl: "https://rpc.sepolia.org",
  bundlerUrl: "https://api.pimlico.io/v2/sepolia/rpc", // Requires API key
  chainId: 11155111,
} as const;

/**
 * WebAuthn Configuration for Passkey creation
 */
export const WEBAUTHN_CONFIG = {
  // Relying Party (your app)
  rp: {
    name: "Passkey PoC",
    id: "localhost", // Change for production
  },
  // User information
  user: {
    displayName: "Passkey User",
  },
  // Credential parameters (P-256 curve for WebAuthn)
  pubKeyCredParams: [
    {
      type: "public-key" as const,
      alg: -7, // ES256 (ECDSA with P-256 and SHA-256)
    },
  ],
  // Authenticator selection
  authenticatorSelection: {
    authenticatorAttachment: "platform" as const,
    userVerification: "required" as const,
    residentKey: "required" as const,
  },
  // Timeout in milliseconds
  timeout: 60000,
};
