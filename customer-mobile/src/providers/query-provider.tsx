import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: (failureCount, error) => {
          if (failureCount >= 3) return false;
          const status = (error as { status?: number })?.status;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return true;
        },
        refetchOnWindowFocus: false
      },
      mutations: { retry: 1 }
    }
  });
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      {children as Parameters<typeof QueryClientProvider>[0]["children"]}
    </QueryClientProvider>
  );
}
