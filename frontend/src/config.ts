import { createConfig } from "@account-kit/react";
import { alchemy, sepolia } from "@account-kit/infra";
import { QueryClient } from "@tanstack/react-query";

// Environment Configuration
const USE_LOCAL = import.meta.env.VITE_USE_LOCAL === "true";
const LOCAL_RPC_URL = import.meta.env.VITE_LOCAL_RPC_URL || "http://127.0.0.1:8545";
const TENDERLY_RPC_URL = import.meta.env.VITE_TENDERLY_RPC_URL || "";
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "";

// Validate required env vars
if (!ALCHEMY_API_KEY) {
  console.error("ERROR: VITE_ALCHEMY_API_KEY is required!");
}

// Transport configuration
// Account Kit REQUIRES Alchemy transport for its features to work
// For local mode: Bundler/Paymaster -> Alchemy, Node RPC -> Local Anvil
// For Tenderly mode: All traffic -> Alchemy (with Tenderly RPC override on chain)
const transport = USE_LOCAL
  ? alchemy({
      alchemyConnection: {
        apiKey: ALCHEMY_API_KEY,
      },
      nodeRpcUrl: LOCAL_RPC_URL, // Node traffic goes to local Anvil
    })
  : alchemy({
      apiKey: ALCHEMY_API_KEY,
    });

// Chain configuration
const chainConfig = USE_LOCAL
  ? sepolia // Use Sepolia chain definition but node traffic goes to local via nodeRpcUrl
  : TENDERLY_RPC_URL
    ? {
        ...sepolia,
        rpcUrls: {
          ...sepolia.rpcUrls,
          default: { http: [TENDERLY_RPC_URL] },
          public: { http: [TENDERLY_RPC_URL] },
        },
      }
    : sepolia;

export const config = createConfig(
  {
    transport,
    chain: chainConfig,
  },
  {
    auth: {
      sections: [[{ type: "email" }], [{ type: "passkey" }]],
      addPasskeyOnSignup: true,
    },
  }
);

export const queryClient = new QueryClient();
