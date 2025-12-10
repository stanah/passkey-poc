/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TENDERLY_RPC_URL: string;
  readonly VITE_TENDERLY_CHAIN_ID: string;
  readonly VITE_BUNDLER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
