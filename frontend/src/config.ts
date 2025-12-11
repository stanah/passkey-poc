import { createConfig } from "@account-kit/react";
import { alchemy, sepolia } from "@account-kit/infra";
import { QueryClient } from "@tanstack/react-query";

// Tenderly Virtual TestNet Configuration
// We use Sepolia as the base chain but override the RPC URL
// @ts-ignore: Vite env types might not be picked up correctly in this context yet
const TENDERLY_RPC_URL = import.meta.env.VITE_TENDERLY_RPC_URL || "https://virtual.sepolia.rpc.tenderly.co/YOUR_ACCESS_KEY";
// @ts-ignore
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY";

export const config = createConfig({
  // connection to Alchemy
  transport: alchemy({
    apiKey: import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY",
  }),
  chain: {
    ...sepolia,
    rpcUrls: {
      ...sepolia.rpcUrls,
      default: {
         http: [TENDERLY_RPC_URL],
      },
      public: {
         http: [TENDERLY_RPC_URL],
      }
    }
  },

}, {
  // Authentication UI configuration
  auth: {
    sections: [
      [{ type: "email" }],
      [{ type: "passkey" }],
    ],
    addPasskeyOnSignup: true,
  },
});

export const queryClient = new QueryClient();
