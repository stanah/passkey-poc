import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated" as const,
      chainId: 31337,
      // Fork from Sepolia to get deployed EntryPoint contracts
      forking: {
        url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
        blockNumber: 7000000, // Specific block for consistency
      },
      accounts: {
        count: 10,
        accountsBalance: "10000000000000000000000", // 10000 ETH
      },
    },
    localhost: {
      type: "http" as const,
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};

export default config;
