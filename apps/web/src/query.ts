import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const qk = {
  session: ["session"] as const,
  projects: ["projects"] as const,
  workflow: (slug: string) => ["workflow", slug] as const,
  runs: (slug: string) => ["runs", slug] as const,
  agents: (slug: string) => ["agents", slug] as const,
  models: ["models"] as const,
  chat: (slug: string) => ["chat", slug] as const,
  notebooks: ["notebooks"] as const,
  sources: (slug: string) => ["sources", slug] as const,
  settings: ["settings"] as const,
  secrets: ["secrets"] as const,
  databases: ["databases"] as const,
  channels: ["channels"] as const,
  health: ["health"] as const,
};
