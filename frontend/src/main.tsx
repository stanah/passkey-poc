import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import { AlchemyAccountProvider } from "@account-kit/react";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { config, queryClient } from "./config";
import "@account-kit/react/styles.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AlchemyAccountProvider config={config} queryClient={queryClient}>
      <App />
    </AlchemyAccountProvider>
  </QueryClientProvider>
);
