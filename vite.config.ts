import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "./frontend",
  publicDir: "../public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend/src"),
      "@lib": path.resolve(__dirname, "./src/lib"),
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
