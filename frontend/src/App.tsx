import React, { useState, useCallback, useEffect } from "react";
import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  type Hex,
  type Address,
  keccak256,
  toBytes,
  encodePacked,
  concat,
  pad,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Types for our passkey implementation
interface StoredCredential {
  credentialId: string;
  publicKey: {
    x: Hex;
    y: Hex;
  };
  rpId: string;
  userHandle: string;
}

interface LogEntry {
  message: string;
  type: "info" | "success" | "error";
  timestamp: Date;
}

// Tenderly Virtual TestNet Configuration
// These values are loaded from environment variables (set via .env file)
const TENDERLY_CONFIG = {
  rpcUrl: import.meta.env.VITE_TENDERLY_RPC_URL || "https://virtual.sepolia.rpc.tenderly.co/YOUR_ACCESS_KEY",
  bundlerUrl: import.meta.env.VITE_BUNDLER_URL || "http://127.0.0.1:3000",
  chainId: parseInt(import.meta.env.VITE_TENDERLY_CHAIN_ID || "11155111"),
};

const ENTRYPOINT_ADDRESS_V07 =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;

// SimpleAccountFactory for v0.7 (deployed on Sepolia)
const SIMPLE_ACCOUNT_FACTORY =
  "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985" as const;

// Tenderly Virtual TestNet chain definition
const tenderlyChain = {
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

// Helper functions
function arrayBufferToHex(buffer: ArrayBuffer): Hex {
  return `0x${Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

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

// Extract P-256 public key from COSE or DER format
function extractP256PublicKey(publicKeyBuffer: ArrayBuffer): {
  x: Hex;
  y: Hex;
} {
  const bytes = new Uint8Array(publicKeyBuffer);

  // Check if it's a DER encoded SubjectPublicKeyInfo (starts with 0x30)
  // Commonly returned by some Windows Hello or Android authenticators in "spki" format logic if not strictly COSE
  // Sequence (0x30)
  if (bytes[0] === 0x30) {
     // This is likely ASN.1 DER encoded key (SubjectPublicKeyInfo)
     // Structure: SEQUENCE { AlgorithmIdentifier, BIT STRING { Uncompressed Point } }
     // P-256 OID: 1.2.840.10045.3.1.7
     // The raw key data (0x04 || X || Y) is usually at the end of the bit string.
     
     // Simplified parsing: find the bit string header (0x03) and look for uncompressed point indicator (0x04)
     // The key is 65 bytes: 0x04 (1 byte) + X (32 bytes) + Y (32 bytes)
     
     // Search for 0x04 followed by 64 bytes at the end
     const len = bytes.length;
     // We expect at least header + 65 bytes
     if (len > 65) {
         // Check for uncompressed point indicator 0x04 at appropriate offset
         // Usually the last 65 bytes are the key
         const possibleKeyStart = len - 65;
         if (bytes[possibleKeyStart] === 0x04) {
             return {
                 x: arrayBufferToHex(bytes.slice(possibleKeyStart + 1, possibleKeyStart + 33).buffer),
                 y: arrayBufferToHex(bytes.slice(possibleKeyStart + 33, possibleKeyStart + 65).buffer)
             };
         }
     }
  }

  // Find x and y coordinates in the COSE structure
  let xStart = -1;
  let yStart = -1;

  // Search for keys -2 (0x21) for x and -3 (0x22) for y
  for (let i = 0; i < bytes.length - 32; i++) {
    // Check for X coordinate
    if (bytes[i] === 0x21) {
      // Standard 1-byte length (0x58 0x20)
      if (bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
        xStart = i + 3;
      }
      // 2-byte length (0x59 0x00 0x20) - rare but possible
      else if (
        bytes[i + 1] === 0x59 &&
        bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x20
      ) {
        xStart = i + 4;
      }
    }
    
    // Check for Y coordinate
    if (bytes[i] === 0x22) {
      // Standard 1-byte length (0x58 0x20)
      if (bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
        yStart = i + 3;
      }
      // 2-byte length (0x59 0x00 0x20)
      else if (
        bytes[i + 1] === 0x59 &&
        bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x20
      ) {
        yStart = i + 4;
      }
    }
  }

  if (xStart === -1 || yStart === -1) {
    throw new Error("Could not extract P-256 public key coordinates");
  }

  return {
    x: arrayBufferToHex(bytes.slice(xStart, xStart + 32).buffer),
    y: arrayBufferToHex(bytes.slice(yStart, yStart + 32).buffer),
  };
}

// Compute smart account address from owner address and salt
// This calls SimpleAccountFactory.getAddress(owner, salt) for correct CREATE2 address
async function getSmartAccountAddressFromFactory(
  ownerAddress: Address,
  salt: bigint = 0n
): Promise<Address> {
  // SimpleAccountFactory.getAddress(address owner, uint256 salt) returns (address)
  // Function selector: 0x8cb84e18
  const saltHex = salt.toString(16).padStart(64, '0');
  const callData = `0x8cb84e18${ownerAddress.slice(2).padStart(64, '0')}${saltHex}` as Hex;

  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      {
        to: SIMPLE_ACCOUNT_FACTORY,
        data: callData,
      },
      "latest",
    ],
  };

  const response = await fetch(TENDERLY_CONFIG.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = await response.json();
  
  if (result.error) {
    throw new Error(`Failed to get account address: ${result.error.message}`);
  }
  
  // Result is a 32-byte value, extract the address (last 20 bytes)
  return `0x${result.result.slice(-40)}` as Address;
}

// Test private key for Hardhat default account (do not use in production!)
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;

// Get UserOperation hash for signing
// This follows ERC-4337 v0.7 hash calculation
function getUserOperationHash(
  userOp: any,
  entryPoint: Address,
  chainId: number
): Hex {
  // Pack the UserOp fields for v0.7
  const packedUserOp = keccak256(
    encodePacked(
      ["address", "uint256", "bytes32", "bytes32", "bytes32", "uint256", "bytes32", "bytes32"],
      [
        userOp.sender as Address,
        BigInt(userOp.nonce || "0x0"),
        keccak256(userOp.factory && userOp.factoryData 
          ? concat([userOp.factory as Hex, userOp.factoryData as Hex])
          : "0x" as Hex),
        keccak256(userOp.callData as Hex || "0x"),
        concat([
          pad(toHex(BigInt(userOp.verificationGasLimit || "0x0")), { size: 16 }),
          pad(toHex(BigInt(userOp.callGasLimit || "0x0")), { size: 16 }),
        ]),
        BigInt(userOp.preVerificationGas || "0x0"),
        concat([
          pad(toHex(BigInt(userOp.maxPriorityFeePerGas || "0x0")), { size: 16 }),
          pad(toHex(BigInt(userOp.maxFeePerGas || "0x0")), { size: 16 }),
        ]),
        keccak256(userOp.paymaster && userOp.paymasterData
          ? concat([
              userOp.paymaster as Hex,
              pad(toHex(BigInt(userOp.paymasterVerificationGasLimit || "0x0")), { size: 16 }),
              pad(toHex(BigInt(userOp.paymasterPostOpGasLimit || "0x0")), { size: 16 }),
              userOp.paymasterData as Hex,
            ])
          : "0x" as Hex),
      ]
    )
  );

  // Final hash: keccak256(packedUserOp, entryPoint, chainId)
  return keccak256(
    encodePacked(
      ["bytes32", "address", "uint256"],
      [packedUserOp, entryPoint, BigInt(chainId)]
    )
  );
}

// Sign UserOperation with test private key
// Uses direct hash signing (not EIP-191 prefixed) for SimpleAccount compatibility
async function signUserOperation(userOp: any, entryPoint: Address, chainId: number): Promise<Hex> {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const hash = getUserOperationHash(userOp, entryPoint, chainId);
  // Use sign (not signMessage) to avoid EIP-191 prefix
  const signature = await account.sign({ hash });
  return signature;
}

// Fallback: compute address from public key hash (for display only)
function computeSmartAccountAddress(publicKey: { x: Hex; y: Hex }): Address {
  const hash = keccak256(
    `0x${publicKey.x.slice(2)}${publicKey.y.slice(2)}` as Hex
  );
  return `0x${hash.slice(26)}` as Address;
}

// Credential storage - keys include chainId for multi-network support
const getStorageKey = (key: string): string => {
  return `passkey_credential_${TENDERLY_CONFIG.chainId}_${key}`;
};

const credentialStorage = {
  save(key: string, credential: StoredCredential): void {
    localStorage.setItem(getStorageKey(key), JSON.stringify(credential));
  },
  load(key: string): StoredCredential | null {
    const stored = localStorage.getItem(getStorageKey(key));
    return stored ? JSON.parse(stored) : null;
  },
  remove(key: string): void {
    localStorage.removeItem(getStorageKey(key));
  },
  list(): string[] {
    const prefix = `passkey_credential_${TENDERLY_CONFIG.chainId}_`;
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.replace(prefix, ""));
  },
};

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [credential, setCredential] = useState<StoredCredential | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<Hex | null>(null);

  const addLog = useCallback(
    (message: string, type: "info" | "success" | "error" = "info") => {
      setLogs((prev) => [
        { message, type, timestamp: new Date() },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  // Check connection to local node
  const checkConnection = useCallback(async () => {
    try {
      const client = createPublicClient({
        chain: tenderlyChain,
        transport: http(TENDERLY_CONFIG.rpcUrl),
      });

      const chainId = await client.getChainId();
      const block = await client.getBlockNumber();
      setBlockNumber(block);

      if (chainId === TENDERLY_CONFIG.chainId) {
        setIsConnected(true);
        addLog(`Connected to local node (chain ID: ${chainId})`, "success");
        return true;
      }
    } catch (error: any) {
      setIsConnected(false);
      addLog(`Failed to connect: ${error.message}`, "error");
    }
    return false;
  }, [addLog]);

  // Load saved credential on mount
  useEffect(() => {
    const savedCredentials = credentialStorage.list();
    if (savedCredentials.length > 0) {
      const saved = credentialStorage.load(savedCredentials[0]);
      if (saved) {
        setCredential(saved);
        const address = computeSmartAccountAddress(saved.publicKey);
        setSmartAccountAddress(address);
        addLog(`Loaded saved credential for ${address.slice(0, 10)}...`, "info");
      }
    }
    checkConnection();
  }, [checkConnection, addLog]);

  // Create passkey
  const createPasskey = useCallback(async () => {
    if (!navigator.credentials) {
      addLog("WebAuthn is not supported in this browser", "error");
      return;
    }

    setIsLoading(true);
    addLog("Starting passkey creation...", "info");

    try {
      const userId = `user_${Date.now()}`;
      const userIdBytes = new TextEncoder().encode(userId);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: {
          name: "Passkey PoC",
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: `Passkey User (${userId})`,
          displayName: "Passkey User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256 (P-256)
          // RS256 removed to force ES256
        ],
        authenticatorSelection: {
          // authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred", // Relaxed from "required" to debug hanging
        },
        timeout: 60000,
        attestation: "none",
      };

      addLog(`Requesting credential from authenticator (RP ID: ${publicKeyCredentialCreationOptions.rp.id})...`, "info");
      console.log("Credential Creation Options:", publicKeyCredentialCreationOptions);

      const cred = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential | null;

      if (!cred) {
        throw new Error("Credential creation was cancelled");
      }

      const response = cred.response as AuthenticatorAttestationResponse;
      const publicKeyBuffer = response.getPublicKey();

      if (!publicKeyBuffer) {
        throw new Error("Failed to get public key from credential");
      }

      // Check algorithm if possible (not directly exposed in standard API easily without parsing attestationObject, but we proceed)
      // We assume ES256 for now, if RS256 is chosen, extractP256PublicKey might fail or produce invalid result for our use case.
      // Ideally we should parse COSE key to check 'kty' and 'alg'.
      
      let publicKey;
      try {
         publicKey = extractP256PublicKey(publicKeyBuffer);
      } catch (e: any) {
         const hex = arrayBufferToHex(publicKeyBuffer);
         console.error("Raw Public Key Buffer:", hex);
         addLog(`Failed to parse key. Raw: ${hex.slice(0, 50)}...`, "error");
         console.error("Failed to extract P-256 key:", e);
         throw new Error(`Created credential is not a valid P-256 key. (Raw: ${hex.slice(0, 20)}...)`);
      }

      const newCredential: StoredCredential = {
        credentialId: arrayBufferToBase64Url(cred.rawId),
        publicKey,
        rpId: window.location.hostname,
        userHandle: arrayBufferToBase64Url(userIdBytes),
      };

      credentialStorage.save(userId, newCredential);
      setCredential(newCredential);

      const address = computeSmartAccountAddress(publicKey);
      setSmartAccountAddress(address);

      addLog(`Passkey created successfully!`, "success");
      addLog(`Public Key X: ${publicKey.x.slice(0, 20)}...`, "info");
      addLog(`Public Key Y: ${publicKey.y.slice(0, 20)}...`, "info");
      addLog(`Smart Account Address: ${address}`, "success");
    } catch (error: any) {
      addLog(`Passkey creation failed: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  // Sign message with passkey
  const signMessage = useCallback(async () => {
    if (!credential) {
      addLog("No credential available", "error");
      return;
    }

    setIsLoading(true);
    addLog("Signing message with passkey...", "info");

    try {
      const message = "Hello from Passkey PoC!";
      const messageHash = keccak256(toBytes(message));

      addLog(`Message: ${message}`, "info");
      addLog(`Message Hash: ${messageHash.slice(0, 20)}...`, "info");

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: new Uint8Array(
          messageHash.slice(2).match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
        ),
        rpId: credential.rpId,
        allowCredentials: [
          {
            type: "public-key",
            id: base64UrlToArrayBuffer(credential.credentialId),
          },
        ],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error("Signing was cancelled");
      }

      const assertionResponse = assertion.response as AuthenticatorAssertionResponse;
      const signature = arrayBufferToHex(assertionResponse.signature);
      const authenticatorData = arrayBufferToHex(assertionResponse.authenticatorData);

      addLog(`Signature created!`, "success");
      addLog(`Authenticator Data: ${authenticatorData.slice(0, 30)}...`, "info");
      addLog(`Signature: ${signature.slice(0, 30)}...`, "info");
    } catch (error: any) {
      addLog(`Signing failed: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [credential, addLog]);

  // Check balance of smart account
  const checkBalance = useCallback(async () => {
    if (!smartAccountAddress) return;

    try {
      const client = createPublicClient({
        chain: tenderlyChain,
        transport: http(TENDERLY_CONFIG.rpcUrl),
      });

      const bal = await client.getBalance({ address: smartAccountAddress });
      setBalance(formatEther(bal));
      addLog(`Balance: ${formatEther(bal)} ETH`, "info");
    } catch (error: any) {
      addLog(`Failed to check balance: ${error.message}`, "error");
    }
  }, [smartAccountAddress, addLog]);

  // Send a test transaction via Bundler
  const sendTransaction = useCallback(async () => {
    if (!credential || !smartAccountAddress) {
      addLog("No credential or smart account available", "error");
      return;
    }

    setIsSending(true);
    addLog("Sending transaction via Bundler...", "info");

    try {
      addLog(`Target: ${smartAccountAddress}`, "info");
      addLog(`Value: 0 ETH (test transaction)`, "info");

      // First, get the current nonce from RPC
      const nonceRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionCount",
        params: [smartAccountAddress, "latest"],
      };

      const nonceResponse = await fetch(TENDERLY_CONFIG.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nonceRequest),
      });
      const nonceResult = await nonceResponse.json();
      addLog(`Nonce from RPC: ${nonceResult.result || "0x0"}`, "info");

      // For PoC: Use a test EOA address as owner
      // In production, this should be derived from passkey or use WebAuthn-compatible account
      // Using a deterministic address for testing
      const testOwnerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address; // Hardhat default account
      const salt = 0n;
      
      // Get the correct sender address from factory
      addLog(`Getting sender address from factory...`, "info");
      const senderAddress = await getSmartAccountAddressFromFactory(testOwnerAddress, salt);
      addLog(`Factory sender: ${senderAddress}`, "info");

      // Build factoryData for first-time account deployment
      // SimpleAccountFactory.createAccount(address owner, uint256 salt)
      // Function selector: 0x5fbfb9cf
      const saltHex = salt.toString(16).padStart(64, '0');
      const factoryData = `0x5fbfb9cf${testOwnerAddress.slice(2).padStart(64, '0')}${saltHex}` as Hex;

      addLog(`Factory: ${SIMPLE_ACCOUNT_FACTORY}`, "info");
      addLog(`Owner: ${testOwnerAddress}`, "info");

      // ERC-4337 v0.7 UserOperation format (without signature first)
      const userOpWithoutSig = {
        sender: senderAddress,  // Use address from factory
        nonce: "0x0",
        // v0.7 uses factory and factoryData for account deployment
        factory: SIMPLE_ACCOUNT_FACTORY,
        factoryData: factoryData,
        callData: "0x",
        // Gas limits
        callGasLimit: "0x50000",
        verificationGasLimit: "0x100000", 
        preVerificationGas: "0x50000",
        maxFeePerGas: "0x3B9ACA00",
        maxPriorityFeePerGas: "0x3B9ACA00",
        // No paymaster for now (user pays gas)
        paymaster: null,
        paymasterVerificationGasLimit: null,
        paymasterPostOpGasLimit: null,
        paymasterData: null,
        signature: "0x" as Hex, // Placeholder
      };

      // Sign the UserOperation
      addLog("Signing UserOperation...", "info");
      const signature = await signUserOperation(
        userOpWithoutSig,
        ENTRYPOINT_ADDRESS_V07,
        TENDERLY_CONFIG.chainId
      );
      addLog(`Signature: ${signature.slice(0, 30)}...`, "info");

      // Add signature to UserOp
      const userOp = {
        ...userOpWithoutSig,
        signature: signature,
      };

      addLog("Sending UserOperation to Bundler...", "info");
      addLog(`Bundler URL: ${TENDERLY_CONFIG.bundlerUrl}`, "info");

      // Send UserOperation
      const userOpRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRYPOINT_ADDRESS_V07],
      };

      const response = await fetch(TENDERLY_CONFIG.bundlerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userOpRequest),
      });

      const result = await response.json();
      addLog(`Bundler response: ${JSON.stringify(result).slice(0, 100)}...`, "info");

      if (result.error) {
        throw new Error(result.error.message || JSON.stringify(result.error));
      }

      const userOpHash = result.result as Hex;
      setLastTxHash(userOpHash);
      addLog(`UserOperation submitted!`, "success");
      addLog(`UserOp Hash: ${userOpHash}`, "success");

      // Check balance after transaction
      await checkBalance();
    } catch (error: any) {
      addLog(`Transaction failed: ${error.message}`, "error");
    } finally {
      setIsSending(false);
    }
  }, [credential, smartAccountAddress, addLog, checkBalance]);

  // Clear credential
  const clearCredential = useCallback(() => {
    const savedCredentials = credentialStorage.list();
    savedCredentials.forEach((key) => credentialStorage.remove(key));
    setCredential(null);
    setSmartAccountAddress(null);
    setBalance("0");
    addLog("Credential cleared", "info");
  }, [addLog]);

  return (
    <div className="container">
      <header className="header">
        <h1>🔐 Passkey PoC</h1>
        <p>On-Chain WebAuthn Smart Account Demo</p>
      </header>

      {/* Connection Status */}
      <div className="card">
        <h2>
          🌐 Network Status
          <span
            className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}
          >
            {isConnected ? "● Connected" : "○ Disconnected"}
          </span>
        </h2>
        <div className="info-grid">
          <div className="info-item">
            <label>RPC URL</label>
            <div className="value">{TENDERLY_CONFIG.rpcUrl}</div>
          </div>
          <div className="info-item">
            <label>Bundler URL</label>
            <div className="value">{TENDERLY_CONFIG.bundlerUrl}</div>
          </div>
          <div className="info-item">
            <label>Chain ID</label>
            <div className="value">{TENDERLY_CONFIG.chainId}</div>
          </div>
          {blockNumber && (
            <div className="info-item">
              <label>Block Number</label>
              <div className="value">{blockNumber.toString()}</div>
            </div>
          )}
        </div>
        <div className="actions">
          <button className="button secondary" onClick={checkConnection}>
            Refresh Connection
          </button>
        </div>
      </div>

      {/* Passkey Management */}
      <div className="card">
        <h2>
          🔑 Passkey
          <span
            className={`status-indicator ${credential ? "connected" : "pending"}`}
          >
            {credential ? "● Registered" : "○ Not Registered"}
          </span>
        </h2>

        {credential ? (
          <>
            <div className="credential-display">
              <h4>Credential Details</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Credential ID</label>
                  <div className="value">
                    {credential.credentialId.slice(0, 30)}...
                  </div>
                </div>
                <div className="info-item">
                  <label>Public Key (X)</label>
                  <div className="value">{credential.publicKey.x}</div>
                </div>
                <div className="info-item">
                  <label>Public Key (Y)</label>
                  <div className="value">{credential.publicKey.y}</div>
                </div>
              </div>
            </div>
            <div className="actions">
              <button
                className="button primary"
                onClick={signMessage}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span> Signing...
                  </>
                ) : (
                  "✍️ Sign Test Message"
                )}
              </button>
              <button className="button secondary" onClick={clearCredential}>
                🗑️ Clear Credential
              </button>
            </div>
          </>
        ) : (
          <div className="actions">
            <button
              className="button primary"
              onClick={createPasskey}
              disabled={isLoading || !isConnected}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span> Creating...
                </>
              ) : (
                "➕ Create Passkey"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Smart Account */}
      {smartAccountAddress && (
        <div className="card">
          <h2>💼 Smart Account</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Address (Counterfactual)</label>
              <div className="value">{smartAccountAddress}</div>
            </div>
            <div className="info-item">
              <label>Balance</label>
              <div className="value">{balance} ETH</div>
            </div>
            <div className="info-item">
              <label>EntryPoint</label>
              <div className="value">{ENTRYPOINT_ADDRESS_V07}</div>
            </div>
            {lastTxHash && (
              <div className="info-item">
                <label>Last UserOp Hash</label>
                <div className="value">{lastTxHash.slice(0, 30)}...</div>
              </div>
            )}
          </div>
          <div className="actions">
            <button
              className="button primary"
              onClick={sendTransaction}
              disabled={isSending || !isConnected}
            >
              {isSending ? (
                <>
                  <span className="spinner"></span> Sending...
                </>
              ) : (
                "🚀 Send Transaction"
              )}
            </button>
            <button className="button secondary" onClick={checkBalance}>
              💰 Check Balance
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="card">
        <h2>📋 How to Use</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Configure Environment</h3>
              <p>
                Copy <code>.env.example</code> to <code>.env</code> and set your
                Tenderly RPC URL and Chain ID.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Start Bundler</h3>
              <p>
                Run <code>pnpm bundler:start</code> to start the Rundler
                ERC-4337 bundler via Docker.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Create Passkey</h3>
              <p>
                Click "Create Passkey" to register a new WebAuthn credential.
                This will be used to sign transactions.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Sign Messages</h3>
              <p>
                Use the passkey to sign messages and UserOperations for your
                smart account.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        <h2>📜 Activity Log</h2>
        <div className="log">
          {logs.length === 0 ? (
            <div className="log-entry info">No activity yet...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`log-entry ${log.type}`}>
                [{log.timestamp.toLocaleTimeString()}] {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
