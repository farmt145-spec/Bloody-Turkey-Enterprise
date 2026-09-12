import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { getWorkspace } from "@/lib/workspace";
import { useAuth } from "./auth";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // Na wspólnym serwerze (Railway/Render/VPS) zostaje "/api/trpc".
      // Gdy frontend jest na Netlify, a backend gdzie indziej, ustaw VITE_API_URL=https://twoj-backend.../api/trpc
      url: (import.meta as any).env?.VITE_API_URL || "/api/trpc",
      transformer: superjson,
      headers() {
        const w = getWorkspace();
        const h: Record<string, string> = {};
        if (w) {
          h["x-company-id"] = String(w.companyId);
          if (w.farmId > 0) h["x-farm-id"] = String(w.farmId);
        }
        return h;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  // Create dynamic client with auth token
  const createDynamicClient = () => {
    return trpc.createClient({
      links: [
        httpBatchLink({
          url: (import.meta as any).env?.VITE_API_URL || "/api/trpc",
          transformer: superjson,
          headers() {
            const w = getWorkspace();
            const h: Record<string, string> = {};
            if (w) {
              h["x-company-id"] = String(w.companyId);
              if (w.farmId > 0) h["x-farm-id"] = String(w.farmId);
            }
            // Add JWT token if available
            const session = localStorage.getItem("auth-session");
            if (session) {
              try {
                const { token } = JSON.parse(session);
                if (token) h["authorization"] = `Bearer ${token}`;
              } catch {}
            }
            return h;
          },
          fetch(input, init) {
            return globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });
          },
        }),
      ],
    });
  };

  const dynamicClient = createDynamicClient();

  return (
    <trpc.Provider client={dynamicClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
