/**
 * WebAuthn Passkey Signer Implementation
 *
 * This module provides functionality to create and use WebAuthn passkeys
 * as signers for ERC-4337 smart accounts.
 */
import {
  type Hex,
  type Address,
  encodePacked,
  keccak256,
  toBytes,
  toHex,
  hexToBytes,
} from "viem";
import { WEBAUTHN_CONFIG } from "./constants.js";

/**
 * WebAuthn credential stored for later use
 */
export interface StoredCredential {
  credentialId: string; // Base64URL encoded
  publicKey: {
    x: Hex; // P-256 public key x coordinate
    y: Hex; // P-256 public key y coordinate
  };
  rpId: string;
  userHandle: string;
}

/**
 * WebAuthn signature response
 */
export interface WebAuthnSignature {
  authenticatorData: Hex;
  clientDataJSON: string;
  signature: {
    r: Hex;
    s: Hex;
  };
}

/**
 * Convert ArrayBuffer or Uint8Array to Hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer | ArrayBufferLike): Hex {
  return `0x${Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

/**
 * Convert Base64URL to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to Base64URL string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Extract P-256 public key coordinates from COSE key
 * COSE key format: https://www.rfc-editor.org/rfc/rfc8152.html
 */
function extractP256PublicKey(credentialPublicKey: ArrayBuffer): {
  x: Hex;
  y: Hex;
} {
  // The public key is in COSE format
  // For P-256, the key contains:
  // - kty (key type): 2 (EC)
  // - alg (algorithm): -7 (ES256)
  // - crv (curve): 1 (P-256)
  // - x: 32 bytes
  // - y: 32 bytes

  const bytes = new Uint8Array(credentialPublicKey);

  // Simple CBOR parsing for COSE_Key
  // This is a simplified parser that works for P-256 keys
  // Full implementation would need a proper CBOR library

  // Find x and y coordinates in the COSE structure
  // The x coordinate is typically at offset after the CBOR map header
  // For a standard P-256 COSE key, the structure is predictable

  // Look for the -2 (x) and -3 (y) keys in CBOR
  let xStart = -1;
  let yStart = -1;

  for (let i = 0; i < bytes.length - 32; i++) {
    // -2 in CBOR is encoded as 0x21
    if (bytes[i] === 0x21 && bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
      xStart = i + 3;
    }
    // -3 in CBOR is encoded as 0x22
    if (bytes[i] === 0x22 && bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
      yStart = i + 3;
    }
  }

  if (xStart === -1 || yStart === -1) {
    throw new Error("Could not extract P-256 public key coordinates from COSE");
  }

  const x = arrayBufferToHex(bytes.slice(xStart, xStart + 32).buffer);
  const y = arrayBufferToHex(bytes.slice(yStart, yStart + 32).buffer);

  return { x, y };
}

/**
 * Create a new WebAuthn passkey credential
 *
 * @param userId - Unique identifier for the user
 * @param userName - Display name for the credential
 * @returns Stored credential information
 */
export async function createPasskeyCredential(
  userId: string,
  userName: string
): Promise<StoredCredential> {
  // Check WebAuthn support
  if (!navigator.credentials) {
    throw new Error("WebAuthn is not supported in this browser");
  }

  const userIdBytes = new TextEncoder().encode(userId);

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
    {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: WEBAUTHN_CONFIG.rp,
      user: {
        id: userIdBytes,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: WEBAUTHN_CONFIG.pubKeyCredParams,
      authenticatorSelection: WEBAUTHN_CONFIG.authenticatorSelection,
      timeout: WEBAUTHN_CONFIG.timeout,
      attestation: "none", // We don't need attestation for this PoC
    };

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Failed to create credential");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = extractP256PublicKey(response.getPublicKey()!);

  return {
    credentialId: arrayBufferToBase64Url(credential.rawId),
    publicKey,
    rpId: WEBAUTHN_CONFIG.rp.id,
    userHandle: arrayBufferToBase64Url(userIdBytes.buffer as ArrayBuffer),
  };
}

/**
 * Sign a message hash using a stored WebAuthn credential
 *
 * @param credential - The stored credential to use
 * @param messageHash - The hash to sign (32 bytes)
 * @returns WebAuthn signature components
 */
export async function signWithPasskey(
  credential: StoredCredential,
  messageHash: Hex
): Promise<WebAuthnSignature> {
  if (!navigator.credentials) {
    throw new Error("WebAuthn is not supported in this browser");
  }

  // Use the message hash as the challenge
  const challengeBytes = hexToBytes(messageHash);
  // Convert to ArrayBuffer for WebAuthn API
  const challenge = challengeBytes.buffer.slice(
    challengeBytes.byteOffset,
    challengeBytes.byteOffset + challengeBytes.byteLength
  ) as ArrayBuffer;

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: credential.rpId,
    allowCredentials: [
      {
        type: "public-key",
        id: base64UrlToArrayBuffer(credential.credentialId),
      },
    ],
    userVerification: "required",
    timeout: WEBAUTHN_CONFIG.timeout,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Failed to get assertion");
  }

  const assertionResponse = assertion.response as AuthenticatorAssertionResponse;

  // Parse the DER-encoded signature to extract r and s
  const signature = parseP256Signature(
    new Uint8Array(assertionResponse.signature)
  );

  return {
    authenticatorData: arrayBufferToHex(assertionResponse.authenticatorData),
    clientDataJSON: new TextDecoder().decode(assertionResponse.clientDataJSON),
    signature,
  };
}

/**
 * Parse a DER-encoded P-256 signature to extract r and s values
 */
function parseP256Signature(derSignature: Uint8Array): { r: Hex; s: Hex } {
  // DER signature format:
  // 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]

  let offset = 0;

  // Check SEQUENCE tag
  if (derSignature[offset++] !== 0x30) {
    throw new Error("Invalid DER signature: missing SEQUENCE tag");
  }

  // Skip length byte(s)
  let length = derSignature[offset++];
  if (length & 0x80) {
    offset += length & 0x7f;
  }

  // Parse r
  if (derSignature[offset++] !== 0x02) {
    throw new Error("Invalid DER signature: missing INTEGER tag for r");
  }
  let rLength = derSignature[offset++];
  let rStart = offset;
  offset += rLength;

  // Parse s
  if (derSignature[offset++] !== 0x02) {
    throw new Error("Invalid DER signature: missing INTEGER tag for s");
  }
  let sLength = derSignature[offset++];
  let sStart = offset;

  // Extract r and s, removing leading zeros if necessary
  let r = derSignature.slice(rStart, rStart + rLength);
  let s = derSignature.slice(sStart, sStart + sLength);

  // Remove leading zero byte if present (added for positive integer encoding)
  if (r[0] === 0 && r.length > 32) {
    r = r.slice(1);
  }
  if (s[0] === 0 && s.length > 32) {
    s = s.slice(1);
  }

  // Pad to 32 bytes if necessary
  const padToLength = (arr: Uint8Array, len: number): Uint8Array<ArrayBuffer> => {
    if (arr.length >= len) {
      // Create a new Uint8Array backed by a fresh ArrayBuffer
      const result = new Uint8Array(arr.length);
      result.set(arr);
      return result;
    }
    const padded = new Uint8Array(len);
    padded.set(arr, len - arr.length);
    return padded;
  };

  const rPadded = padToLength(r, 32);
  const sPadded = padToLength(s, 32);

  return {
    r: arrayBufferToHex(rPadded.buffer),
    s: arrayBufferToHex(sPadded.buffer),
  };
}

/**
 * Encode WebAuthn signature for on-chain verification
 * This format is compatible with the Safe WebAuthn verifier
 */
export function encodeWebAuthnSignature(sig: WebAuthnSignature): Hex {
  const clientDataJSONBytes = new TextEncoder().encode(sig.clientDataJSON);

  // Pack the signature data for on-chain verification
  return encodePacked(
    ["bytes", "bytes1", "bytes", "uint256", "uint256"],
    [
      sig.authenticatorData,
      "0x05", // clientDataJSON type byte
      toHex(clientDataJSONBytes),
      BigInt(sig.signature.r),
      BigInt(sig.signature.s),
    ]
  );
}

/**
 * Compute the smart account address for a given passkey
 * This is a counterfactual address - the account may not be deployed yet
 */
export function computeSmartAccountAddress(
  publicKey: { x: Hex; y: Hex },
  factoryAddress: Address,
  salt: bigint = 0n
): Address {
  // This is a simplified computation
  // The actual address depends on the specific account factory implementation
  const initCodeHash = keccak256(
    encodePacked(
      ["uint256", "uint256", "uint256"],
      [BigInt(publicKey.x), BigInt(publicKey.y), salt]
    )
  );

  // CREATE2 address computation
  return `0x${keccak256(
    encodePacked(
      ["bytes1", "address", "bytes32", "bytes32"],
      ["0xff", factoryAddress, toHex(salt, { size: 32 }), initCodeHash]
    )
  ).slice(26)}` as Address;
}

/**
 * Storage utilities for credentials
 */
export const credentialStorage = {
  save(key: string, credential: StoredCredential): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        `passkey_credential_${key}`,
        JSON.stringify(credential)
      );
    }
  },

  load(key: string): StoredCredential | null {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(`passkey_credential_${key}`);
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  },

  remove(key: string): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`passkey_credential_${key}`);
    }
  },

  list(): string[] {
    if (typeof localStorage !== "undefined") {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith("passkey_credential_"))
        .map((k) => k.replace("passkey_credential_", ""));
    }
    return [];
  },
};
