/**
 * Self-Hosted Bundler Setup Script
 *
 * This script sets up a local bundler for ERC-4337 operations.
 * For a complete self-hosted solution, you can use:
 * - Alto (Pimlico): https://github.com/pimlicolabs/alto
 * - Rundler (Alchemy): https://github.com/alchemyplatform/rundler
 * - Stackup Bundler: https://github.com/stackup-wallet/stackup-bundler
 *
 * For this PoC, we'll use a simplified approach with direct execution.
 */

import { createServer } from "http";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LOCAL_CONFIG, ENTRYPOINT_ADDRESS_V07 } from "../src/lib/constants.js";
import { localChain } from "../src/lib/smartAccountClient.js";

// Default Hardhat/Anvil account for bundler operations
const BUNDLER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;

const bundlerAccount = privateKeyToAccount(BUNDLER_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: localChain,
  transport: http(LOCAL_CONFIG.rpcUrl),
});

const walletClient = createWalletClient({
  account: bundlerAccount,
  chain: localChain,
  transport: http(LOCAL_CONFIG.rpcUrl),
});

// EntryPoint ABI for handleOps
// Using JSON ABI format to avoid tuple array parsing issues
const entryPointAbi = [
  {
    type: "function",
    name: "handleOps",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getNonce",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

interface UserOperation {
  sender: Hex;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number | string;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: { code: number; message: string };
  id: number | string;
}

/**
 * Handle eth_sendUserOperation
 */
async function handleSendUserOperation(
  params: any[]
): Promise<Hex> {
  const [userOp, entryPointAddress] = params;

  console.log("Received UserOperation:", JSON.stringify(userOp, null, 2));

  // Verify entry point address
  if (entryPointAddress.toLowerCase() !== ENTRYPOINT_ADDRESS_V07.toLowerCase()) {
    throw new Error(`Unsupported entry point: ${entryPointAddress}`);
  }

  // Format user operation for contract call
  const formattedOp = {
    sender: userOp.sender as Hex,
    nonce: BigInt(userOp.nonce),
    initCode: (userOp.initCode || "0x") as Hex,
    callData: (userOp.callData || "0x") as Hex,
    accountGasLimits: userOp.accountGasLimits as Hex,
    preVerificationGas: BigInt(userOp.preVerificationGas),
    gasFees: userOp.gasFees as Hex,
    paymasterAndData: (userOp.paymasterAndData || "0x") as Hex,
    signature: (userOp.signature || "0x") as Hex,
  };

  try {
    // Call handleOps on the EntryPoint
    const hash = await walletClient.writeContract({
      address: ENTRYPOINT_ADDRESS_V07,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[formattedOp], bundlerAccount.address],
      gas: 3000000n,
    });

    console.log("UserOperation executed, tx hash:", hash);
    return hash;
  } catch (error) {
    console.error("Failed to execute UserOperation:", error);
    throw error;
  }
}

/**
 * Handle eth_estimateUserOperationGas
 */
async function handleEstimateGas(params: any[]): Promise<{
  preVerificationGas: Hex;
  verificationGasLimit: Hex;
  callGasLimit: Hex;
}> {
  // Return reasonable gas estimates for local testing
  return {
    preVerificationGas: "0xc350", // 50000
    verificationGasLimit: "0x30d40", // 200000
    callGasLimit: "0x30d40", // 200000
  };
}

/**
 * Handle eth_getUserOperationByHash
 */
async function handleGetUserOperationByHash(_params: any[]): Promise<null> {
  // Not implemented for this simple bundler
  return null;
}

/**
 * Handle eth_supportedEntryPoints
 */
async function handleSupportedEntryPoints(): Promise<Hex[]> {
  return [ENTRYPOINT_ADDRESS_V07];
}

/**
 * Handle eth_chainId
 */
async function handleChainId(): Promise<Hex> {
  return "0x7a69"; // 31337 in hex
}

/**
 * Process JSON-RPC request
 */
async function processRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const response: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: request.id,
  };

  try {
    switch (request.method) {
      case "eth_sendUserOperation":
        response.result = await handleSendUserOperation(request.params);
        break;
      case "eth_estimateUserOperationGas":
        response.result = await handleEstimateGas(request.params);
        break;
      case "eth_getUserOperationByHash":
        response.result = await handleGetUserOperationByHash(request.params);
        break;
      case "eth_supportedEntryPoints":
        response.result = await handleSupportedEntryPoints();
        break;
      case "eth_chainId":
        response.result = await handleChainId();
        break;
      case "pm_sponsorUserOperation":
        // Simple paymaster - sponsor all operations (for testing only!)
        response.result = {
          paymasterAndData: "0x",
          preVerificationGas: "0xc350",
          verificationGasLimit: "0x30d40",
          callGasLimit: "0x30d40",
        };
        break;
      default:
        // Forward unknown methods to the underlying node
        const result = await publicClient.request({
          method: request.method as any,
          params: request.params as any,
        });
        response.result = result;
    }
  } catch (error: any) {
    response.error = {
      code: -32000,
      message: error.message || "Internal error",
    };
  }

  return response;
}

/**
 * Start the bundler HTTP server
 */
function startBundler(port: number = 4337) {
  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const request: JsonRpcRequest = JSON.parse(body);
        console.log(`\n[Bundler] ${request.method}`);

        const response = await processRequest(request);
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch (error: any) {
        console.error("Failed to process request:", error);
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  });

  server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Passkey PoC - Self-Hosted ERC-4337 Bundler           ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Bundler URL:     http://127.0.0.1:${port}                       ║
║  EntryPoint:      ${ENTRYPOINT_ADDRESS_V07}  ║
║  Bundler Account: ${bundlerAccount.address}  ║
║                                                                ║
║  Supported Methods:                                            ║
║    - eth_sendUserOperation                                     ║
║    - eth_estimateUserOperationGas                              ║
║    - eth_getUserOperationByHash                                ║
║    - eth_supportedEntryPoints                                  ║
║    - eth_chainId                                               ║
║    - pm_sponsorUserOperation (mock paymaster)                  ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });

  return server;
}

// Start the bundler if this file is run directly
startBundler();
