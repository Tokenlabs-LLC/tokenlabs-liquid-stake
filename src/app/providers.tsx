"use client";

import { createNetworkConfig, IotaClientProvider, WalletProvider } from "@iota/dapp-kit";
import { getFullnodeUrl } from "@iota/iota-sdk/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
// Custom styles override the dapp-kit defaults
import "@iota/dapp-kit/dist/index.css";
import "./dapp-kit-overrides.css";

// Network configuration
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create query client with useState to avoid recreation on re-renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000, // 10 seconds
            refetchInterval: 30_000, // Refresh every 30 seconds
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <IotaClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect={true}>
          {children}
        </WalletProvider>
      </IotaClientProvider>
    </QueryClientProvider>
  );
}
