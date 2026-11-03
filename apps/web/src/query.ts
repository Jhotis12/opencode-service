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
  schedules: (slug: string) => ["schedules", slug] as const,
  workflowVersions: (slug: string) => ["workflow-versions", slug] as const,
  runs: (slug: string) => ["runs", slug] as const,
  agents: (slug: string) => ["agents", slug] as const,
  models: ["models"] as const,
  chat: (slug: string) => ["chat", slug] as const,
  projectSettings: (slug: string) => ["project-settings", slug] as const,
  integrations: (slug: string) => ["integrations", slug] as const,
  notebooks: (slug: string) => ["notebooks", slug] as const,
  sources: (slug: string, notebookSlug: string) => ["sources", slug, notebookSlug] as const,
  secrets: ["secrets"] as const,
  projectSecrets: (slug: string) => ["project-secrets", slug] as const,
  controlIntegrations: ["control-integrations"] as const,
  controlOverview: ["control-overview"] as const,
  controlChat: ["control-chat"] as const,
  settings: ["settings"] as const,
  health: ["health"] as const,
};
