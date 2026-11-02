import type { HealthSnapshot, NodeSpec, SubagentProfile, User, WorkflowGraph } from "@platform/shared";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | { error?: { code?: string; message?: string } }
      | undefined;
    throw new ApiClientError(
      response.status,
      payload?.error?.code ?? "HTTP_ERROR",
      payload?.error?.message ?? `request failed (${response.status})`,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface StepRun {
  id: string;
  nodeId: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  model?: string;
  agentId?: string;
  logs?: Array<{ message: string; fields: Record<string, unknown> }>;
  durationMs: number;
  startedAt: string;
  finishedAt?: string;
}

export interface RunRecord {
  id: string;
  status: string;
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  steps: StepRun[];
}

export interface ModelInfo {
  providerID: string;
  modelID: string;
  name: string;
}

export interface NotebookSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  sources: number;
  createdAt: string;
}

export interface SourceSummary {
  id: string;
  title: string;
  kind: string;
  summary: string;
  createdAt: string;
}

export interface SearchHit {
  chunkId: string;
  documentTitle: string;
  section: string;
  content: string;
  citation: string;
  score: number;
}

export interface ChannelSummary {
  id: string;
  slug: string;
  type: "telegram" | "whatsapp" | "external_chat";
  name: string;
  status: string;
  adminAllowlist: string[];
  isPublic: boolean;
  hasKey?: boolean;
}

export interface ChatHistoryMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  createdAt: string;
}

export interface HealthPayload extends HealthSnapshot {}

async function chatStream(slug: string, message: string): Promise<{ reply: string; sessionId: string }> {
  const response = await fetch(`/api/projects/${slug}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | { error?: { code?: string; message?: string } }
      | undefined;
    throw new ApiClientError(
      response.status,
      payload?.error?.code ?? "HTTP_ERROR",
      payload?.error?.message ?? `request failed (${response.status})`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    return (await response.json()) as { reply: string; sessionId: string };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: { reply: string; sessionId: string } | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const event = /event:\s*(.+)/.exec(block)?.[1]?.trim();
      const data = /data:\s*([\s\S]*)/.exec(block)?.[1]?.trim();
      if (event === "done" && data) result = JSON.parse(data) as { reply: string; sessionId: string };
      if (event === "error" && data) {
        throw new Error((JSON.parse(data) as { message?: string }).message ?? "the agent failed");
      }
      separator = buffer.indexOf("\n\n");
    }
  }
  if (!result) throw new Error("the chat stream ended without a reply");
  return result;
}

export const api = {
  me: () => request<{ user: User | null; mustChangePassword: boolean }>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: User; mustChangePassword: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ user: User }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  listProjects: () => request<{ data: ProjectSummary[] }>("/api/projects"),
  createProject: (input: { slug: string; name: string; description?: string }) =>
    request<{ project: ProjectSummary; graph: WorkflowGraph }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getWorkflow: (slug: string) => request<WorkflowGraph>(`/api/projects/${slug}/workflow`),
  saveWorkflow: (slug: string, graph: WorkflowGraph) =>
    request<WorkflowGraph>(`/api/projects/${slug}/workflow`, { method: "PUT", body: JSON.stringify(graph) }),
  listRuns: (slug: string) => request<{ data: RunRecord[] }>(`/api/projects/${slug}/runs?limit=20`),
  runWorkflow: (slug: string, payload: unknown) =>
    request<RunRecord>(`/api/projects/${slug}/runs`, { method: "POST", body: JSON.stringify({ payload }) }),
  replayRun: (runId: string, fromNodeId?: string) =>
    request<RunRecord>(`/api/runs/${runId}/replay`, { method: "POST", body: JSON.stringify({ fromNodeId }) }),
  chat: chatStream,
  chatHistory: (slug: string) => request<{ data: ChatHistoryMessage[] }>(`/api/projects/${slug}/chat?limit=200`),
  getRun: (id: string) => request<RunRecord>(`/api/runs/${id}`),
  readNode: (slug: string, file: string) =>
    request<{ code: string }>(`/api/projects/${slug}/nodes/${file.replace(/^nodes\//, "")}`),
  writeNode: (slug: string, file: string, code: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/nodes/${file.replace(/^nodes\//, "")}`, {
      method: "PUT",
      body: JSON.stringify({ code }),
    }),

  listAgents: (slug: string) => request<{ data: SubagentProfile[] }>(`/api/projects/${slug}/agents`),
  upsertAgent: (
    slug: string,
    category: string,
    role: string,
    input: { description: string; mode?: string; model?: string; body: string; notebooks?: string[] },
  ) =>
    request<SubagentProfile>(`/api/projects/${slug}/agents/${category}/${role}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteAgent: (slug: string, category: string, role: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/agents/${category}/${role}`, { method: "DELETE" }),

  listModels: () => request<{ data: ModelInfo[] }>("/api/models"),
  connectProvider: (apiKey: string) =>
    request<{ models: ModelInfo[] }>("/api/providers/opencode-go", { method: "POST", body: JSON.stringify({ apiKey }) }),

  listSecrets: () => request<{ data: Array<{ alias: string; kind: string; createdAt: string }> }>("/api/vault/secrets"),
  saveSecret: (alias: string, value: string, kind = "generic") =>
    request<{ ok: boolean }>("/api/vault/secrets", { method: "POST", body: JSON.stringify({ alias, value, kind }) }),

  listDatabases: () => request<{ data: Array<{ alias: string; driver: string }> }>("/api/databases"),
  saveDatabase: (alias: string, config: unknown) =>
    request<{ ok: boolean }>("/api/databases", { method: "POST", body: JSON.stringify({ alias, config }) }),
  testDatabase: (alias: string) =>
    request<{ ok: boolean; latencyMs: number; detail?: string }>(`/api/databases/${alias}/test`, { method: "POST" }),

  listNotebooks: () => request<{ data: NotebookSummary[] }>("/api/notebooks"),
  createNotebook: (input: { slug: string; name: string; description?: string }) =>
    request<NotebookSummary>("/api/notebooks", { method: "POST", body: JSON.stringify(input) }),
  listSources: (slug: string) => request<{ data: SourceSummary[] }>(`/api/notebooks/${slug}/sources`),
  uploadSource: (slug: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<{ source: SourceSummary; chunks: number }>(`/api/notebooks/${slug}/sources`, {
      method: "POST",
      body: form,
    });
  },
  ingestUrl: (slug: string, url: string) =>
    request<{ source: SourceSummary; chunks: number }>(`/api/notebooks/${slug}/url`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  searchNotebook: (slug: string, query: string) =>
    request<{ data: SearchHit[] }>(`/api/notebooks/${slug}/search`, { method: "POST", body: JSON.stringify({ query }) }),

  listChannels: () => request<{ data: ChannelSummary[] }>("/api/channels"),
  createChannel: (input: {
    slug: string;
    type: ChannelSummary["type"];
    name: string;
    adminAllowlist?: string[];
    isPublic?: boolean;
    config?: Record<string, unknown>;
  }) =>
    request<{ channel: ChannelSummary; apiKey?: string; webhookSecret?: string }>("/api/channels", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  startChannel: (slug: string) => request<{ ok: boolean; status?: string }>(`/api/channels/${slug}/start`, { method: "POST" }),

  getSettings: () =>
    request<{
      data: {
        opencodeMode: string;
        sentryConfigured: boolean;
        providerConnected: boolean;
        defaultModel?: string;
        dataDir: string;
      };
    }>("/api/settings"),
  saveSettings: (input: { sentryDsn?: string; defaultModel?: string | null }) =>
    request<{ ok: boolean; requiresRestart: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify(input) }),

  health: () => request<HealthPayload>("/api/system/health"),
  errors: () => request<{ data: HealthPayload["recentErrors"] }>("/api/system/errors"),
};

export type { NodeSpec, WorkflowGraph, SubagentProfile, User };
