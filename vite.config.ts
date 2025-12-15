import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  root: "./frontend",
  envDir: "../",  // Read .env from project root
  publicDir: "../public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend/src"),
      "@lib": path.resolve(__dirname, "./frontend/src/lib"),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: "../dist/frontend",
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
