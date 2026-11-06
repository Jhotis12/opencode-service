import type {
  ChatProgressEvent,
  ChatThread,
  ChatTurn,
  ChatTurnEvent,
  ChatTurnStatus,
  EffectiveConfig,
  HealthSnapshot,
  IntegrationRecord,
  NodeSpec,
  PermissionRule,
  ProjectDestination,
  ProjectTemplate,
  SubagentProfile,
  User,
  WorkflowGraph,
  WorkflowVersion,
} from "@platform/shared";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: string[],
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
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;
    const issues = Array.isArray(payload?.error?.details)
      ? payload.error.details.filter((item): item is string => typeof item === "string")
      : undefined;
    throw new ApiClientError(
      response.status,
      payload?.error?.code ?? "HTTP_ERROR",
      payload?.error?.message ?? `request failed (${response.status})`,
      issues,
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
  defaultModel?: string;
  primaryAgent?: string;
  approvalIntegrationId?: string;
  approvalRecipient?: string;
  transcriptionIntegrationId?: string;
  speechIntegrationId?: string;
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
  projectSlug: string;
  workflowId: string;
  status: string;
  entryPoint: string;
  launchedBy?: string;
  graphHash?: string;
  integrationId?: string;
  sourceDetail?: string;
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  steps: StepRun[];
}

export interface ScheduleState {
  nodeId: string;
  workflowId: string;
  timezone: string;
  enabled: boolean;
  overlapPolicy: "skip" | "allow";
  catchUp: boolean;
  catchUpWindowMinutes: number;
  lastWindowAt?: string;
  nextWindowAt?: string;
  lastRunId?: string;
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  nodeId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface DeliveryRecord {
  id: string;
  projectSlug: string;
  runId?: string;
  nodeId?: string;
  integrationId: string;
  actionKey: string;
  recipient?: string;
  status: "pending" | "delivered" | "failed";
  providerMessageId?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  providerID: string;
  modelID: string;
  name: string;
  input?: string[];
}

export interface NotebookSummary {
  id: string;
  projectSlug: string;
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
  sourceId: string;
  documentTitle: string;
  section: string;
  content: string;
  citation: string;
  score: number;
  projectSlug?: string;
  notebookSlug?: string;
  notebookName?: string;
}

export interface ChatHistoryMessage {
  id: string;
  threadId: string;
  turnId?: string;
  role: "user" | "agent" | "system";
  content: string;
  errorCode?: string;
  turnStatus?: ChatTurnStatus;
  createdAt: string;
}

export interface ChatTurnResult {
  reply: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  status?: ChatTurnStatus;
  startedAt?: string;
}

export class ChatTurnStreamError extends Error {
  constructor(
    message: string,
    public readonly turnId?: string,
    public readonly code?: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ChatTurnStreamError";
  }
}

export interface HealthPayload extends HealthSnapshot {}

export interface ProjectReadinessItem {
  id: string;
  label: string;
  ready: boolean;
  detail?: string;
}

export interface ProjectSettingsView {
  project: ProjectSummary;
  integrations: IntegrationRecord[];
  notebooks: NotebookSummary[];
  readiness: ProjectReadinessItem[];
}

export interface OrchestratorOverview {
  projects: Array<{ slug: string; name: string; description: string; status: string }>;
  recentRuns: Array<{
    id: string;
    projectSlug: string;
    workflowId: string;
    status: string;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  }>;
  recentErrors: Array<{ id: string; message: string; entryPoint: string; createdAt: string }>;
  integrations: Array<{ id: string; scope: string; projectSlug?: string; kind: string; name: string; status: string }>;
}

async function readTurnStream(
  response: Response,
  onEvent?: (event: ChatTurnEvent) => void,
): Promise<ChatTurnResult> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | { error?: { code?: string; message?: string; details?: { turnId?: string } } }
      | undefined;
    throw new ApiClientError(
      response.status,
      payload?.error?.code ?? "HTTP_ERROR",
      payload?.error?.message ?? `request failed (${response.status})`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    return (await response.json()) as ChatTurnResult;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatTurnResult | undefined;
  let lastTurnId: string | undefined;
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
      if (!data || !event || event === "heartbeat") {
        separator = buffer.indexOf("\n\n");
        continue;
      }
      const payload = JSON.parse(data) as any;
      if (event === "error" && !payload.type) {
        throw new ChatTurnStreamError(payload.message ?? "the agent failed", payload.turnId, payload.code, true);
      }
      if (payload.type === "turn") {
        lastTurnId = payload.turn.id;
      } else if ("turnId" in payload && payload.turnId) {
        lastTurnId = payload.turnId;
      }
      if (payload.type === "done") {
        result = {
          reply: payload.reply,
          turnId: payload.turnId,
          threadId: payload.threadId,
          sessionId: payload.sessionId,
          status: payload.status,
          startedAt: payload.startedAt,
        };
      }
      if (payload.type === "error") {
        throw new ChatTurnStreamError(payload.message, payload.turnId, payload.code, payload.retryable);
      }
      onEvent?.(payload);
      separator = buffer.indexOf("\n\n");
    }
  }
  if (!result) {
    throw new ChatTurnStreamError("the chat stream ended without a reply", lastTurnId, "transport_interrupted", true);
  }
  return result;
}

async function chatStream(
  path: string,
  message: string,
  onEvent?: (event: ChatTurnEvent) => void,
  clientMessageId?: string,
): Promise<ChatTurnResult> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ message, clientMessageId }),
  });
  return readTurnStream(response, onEvent);
}

async function attachTurnStream(
  path: string,
  onEvent?: (event: ChatTurnEvent) => void,
): Promise<ChatTurnResult> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { accept: "text/event-stream" },
  });
  return readTurnStream(response, onEvent);
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
  createProject: (input: { slug: string; name: string; description?: string; template?: ProjectTemplate }) =>
    request<{ project: ProjectSummary; graph: WorkflowGraph }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteProject: (slug: string) =>
    request<undefined>(`/api/projects/${slug}`, { method: "DELETE" }),
  getProjectSettings: (slug: string) => request<ProjectSettingsView>(`/api/projects/${slug}/settings`),
  updateProjectSettings: (
    slug: string,
    input: {
      name?: string;
      description?: string;
      defaultModel?: string | null;
      primaryAgent?: string | null;
      approvalIntegrationId?: string | null;
      approvalRecipient?: string | null;
      transcriptionIntegrationId?: string | null;
      speechIntegrationId?: string | null;
    },
  ) =>
    request<ProjectSummary>(`/api/projects/${slug}/settings`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  getWorkflow: (slug: string) => request<WorkflowGraph>(`/api/projects/${slug}/workflow`),
  listSchedules: (slug: string) =>
    request<{ data: ScheduleState[] }>(`/api/projects/${slug}/workflow/schedule`),
  saveWorkflow: (slug: string, graph: WorkflowGraph) =>
    request<WorkflowGraph>(`/api/projects/${slug}/workflow`, { method: "PUT", body: JSON.stringify(graph) }),
  listWorkflowVersions: (slug: string) =>
    request<{ data: WorkflowVersion[] }>(`/api/projects/${slug}/workflow/versions`),
  rollbackWorkflowVersion: (slug: string, version: number) =>
    request<{ graph: WorkflowGraph; version: WorkflowVersion }>(
      `/api/projects/${slug}/workflow/versions/${version}/rollback`,
      { method: "POST" },
    ),
  listRuns: (slug: string) => request<{ data: RunRecord[] }>(`/api/projects/${slug}/runs?limit=20`),
  runWorkflow: (slug: string, payload: unknown, idempotencyKey?: string) =>
    request<RunRecord>(`/api/projects/${slug}/runs`, {
      method: "POST",
      body: JSON.stringify({ payload, idempotencyKey }),
    }),
  replayRun: (runId: string, fromNodeId?: string) =>
    request<RunRecord>(`/api/runs/${runId}/replay`, { method: "POST", body: JSON.stringify({ fromNodeId }) }),
  chat: (slug: string, message: string, onEvent?: (event: ChatTurnEvent) => void, clientMessageId?: string) =>
    chatStream(`/api/projects/${slug}/chat`, message, onEvent, clientMessageId),
  chatHistory: (slug: string) => request<{ data: ChatHistoryMessage[] }>(`/api/projects/${slug}/chat?limit=200`),
  getChatTurn: (slug: string, turnId: string) =>
    request<{ turn: ChatTurn; messages: ChatHistoryMessage[] }>(`/api/projects/${slug}/chat/turns/${turnId}`),
  attachChatTurn: (slug: string, turnId: string, onEvent?: (event: ChatTurnEvent) => void) =>
    attachTurnStream(`/api/projects/${slug}/chat/turns/${turnId}/events`, onEvent),
  cancelChatTurn: (slug: string, turnId: string) =>
    request<{ turn: ChatTurn }>(`/api/projects/${slug}/chat/turns/${turnId}/cancel`, { method: "POST" }),
  retryChatTurn: (slug: string, turnId: string) =>
    request<{ turn: ChatTurn; warning?: string }>(`/api/projects/${slug}/chat/turns/${turnId}/retry`, { method: "POST" }),
  getRun: (id: string) => request<RunRecord>(`/api/runs/${id}`),
  listApprovals: (slug: string, runId: string) =>
    request<{ data: ApprovalRecord[] }>(`/api/projects/${slug}/runs/${runId}/approvals`),
  listDeliveries: (slug: string, runId: string) =>
    request<{ data: DeliveryRecord[] }>(`/api/projects/${slug}/runs/${runId}/deliveries`),
  decideApproval: (slug: string, runId: string, nodeId: string, decision: "approve" | "reject") =>
    request<RunRecord>(`/api/projects/${slug}/runs/${runId}/approvals/${nodeId}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
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
    input: {
      description: string;
      mode?: string;
      model?: string;
      body: string;
      notebooks?: string[];
      permissions?: PermissionRule[];
    },
  ) =>
    request<SubagentProfile>(`/api/projects/${slug}/agents/${category}/${role}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteAgent: (slug: string, category: string, role: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/agents/${category}/${role}`, { method: "DELETE" }),
  listMcp: (slug: string) => request<{ data: Record<string, unknown> }>(`/api/projects/${slug}/mcp`),
  upsertMcp: (slug: string, name: string, config: unknown) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/mcp`, { method: "PUT", body: JSON.stringify({ name, config }) }),
  deleteMcp: (slug: string, name: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/mcp/${name}`, { method: "DELETE" }),

  listIntegrations: (slug: string) =>
    request<{ data: IntegrationRecord[] }>(`/api/projects/${slug}/integrations`),
  createIntegration: (
    slug: string,
    input: {
      kind: IntegrationRecord["kind"];
      name: string;
      slug: string;
      config?: Record<string, unknown>;
      secrets?: Record<string, string>;
      capabilities?: IntegrationRecord["capabilities"];
    },
  ) =>
    request<{ integration: IntegrationRecord; apiKey?: string; webhookSecret?: string }>(
      `/api/projects/${slug}/integrations`,
      { method: "POST", body: JSON.stringify({ ...input, scope: "project", projectSlug: slug }) },
    ),
  updateIntegration: (
    slug: string,
    id: string,
    input: { name?: string; config?: Record<string, unknown>; secrets?: Record<string, string>; capabilities?: IntegrationRecord["capabilities"] },
  ) =>
    request<IntegrationRecord>(`/api/projects/${slug}/integrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteIntegration: (slug: string, id: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/integrations/${id}`, { method: "DELETE" }),
  testIntegration: (slug: string, id: string, recipient?: string) =>
    request<{ ok: boolean; detail?: string; latencyMs?: number; models?: string[] }>(`/api/projects/${slug}/integrations/${id}/test`, {
      method: "POST",
      body: JSON.stringify({ recipient }),
    }),
  connectIntegration: (slug: string, id: string) =>
    request<IntegrationRecord>(`/api/projects/${slug}/integrations/${id}/connect`, { method: "POST" }),
  disconnectIntegration: (slug: string, id: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/integrations/${id}/disconnect`, { method: "POST" }),
  clearIntegrationWebhook: (slug: string, id: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/integrations/${id}/telegram/clear-webhook`, { method: "POST" }),
  integrationQr: (slug: string, id: string) => request<{ qr: string }>(`/api/projects/${slug}/integrations/${id}/qr`),
  listDestinations: (slug: string) =>
    request<{ data: ProjectDestination[] }>(`/api/projects/${slug}/destinations`),
  createDestination: (slug: string, input: { kind: ProjectDestination["kind"]; label: string; value: string }) =>
    request<ProjectDestination>(`/api/projects/${slug}/destinations`, { method: "POST", body: JSON.stringify(input) }),
  updateDestination: (
    slug: string,
    id: string,
    input: Partial<Pick<ProjectDestination, "kind" | "label" | "value">>,
  ) =>
    request<ProjectDestination>(`/api/projects/${slug}/destinations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteDestination: (slug: string, id: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/destinations/${id}`, { method: "DELETE" }),

  listProjectSecrets: (slug: string) =>
    request<{ data: Array<{ alias: string; kind: string; metadata?: string; createdAt: string }> }>(
      `/api/projects/${slug}/secrets`,
    ),
  saveProjectSecret: (slug: string, alias: string, value: string, kind = "generic") =>
    request<{ ok: boolean }>(`/api/projects/${slug}/secrets`, {
      method: "POST",
      body: JSON.stringify({ alias, value, kind }),
    }),
  deleteProjectSecret: (slug: string, alias: string) =>
    request<{ ok: boolean }>(`/api/projects/${slug}/secrets/${alias}`, { method: "DELETE" }),

  listModels: () => request<{ data: ModelInfo[] }>("/api/models"),
  connectProvider: (apiKey: string) =>
    request<{ models: ModelInfo[] }>("/api/providers/opencode-go", { method: "POST", body: JSON.stringify({ apiKey }) }),

  listSecrets: () => request<{ data: Array<{ alias: string; kind: string; createdAt: string }> }>("/api/vault/secrets"),
  saveSecret: (alias: string, value: string, kind = "generic") =>
    request<{ ok: boolean }>("/api/vault/secrets", { method: "POST", body: JSON.stringify({ alias, value, kind }) }),
  deleteSecret: (alias: string) => request<{ ok: boolean }>(`/api/vault/secrets/${alias}`, { method: "DELETE" }),

  listNotebooks: (slug: string) => request<{ data: NotebookSummary[] }>(`/api/projects/${slug}/notebooks`),
  createNotebook: (slug: string, input: { slug: string; name: string; description?: string }) =>
    request<NotebookSummary>(`/api/projects/${slug}/notebooks`, { method: "POST", body: JSON.stringify(input) }),
  listSources: (slug: string, notebookSlug: string) =>
    request<{ data: SourceSummary[] }>(`/api/projects/${slug}/notebooks/${notebookSlug}/sources`),
  uploadSource: (slug: string, notebookSlug: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<{ source: SourceSummary; chunks: number }>(`/api/projects/${slug}/notebooks/${notebookSlug}/sources`, {
      method: "POST",
      body: form,
    });
  },
  ingestUrl: (slug: string, notebookSlug: string, url: string) =>
    request<{ source: SourceSummary; chunks: number }>(`/api/projects/${slug}/notebooks/${notebookSlug}/url`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  searchNotebook: (slug: string, notebookSlug: string, query: string) =>
    request<{ data: SearchHit[] }>(`/api/projects/${slug}/notebooks/${notebookSlug}/search`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  searchProjectKnowledge: (slug: string, query: string) =>
    request<{ data: SearchHit[] }>(`/api/projects/${slug}/knowledge/search`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  controlIntegrations: () => request<{ data: IntegrationRecord[] }>("/api/control/integrations"),
  createControlIntegration: (input: {
    kind: IntegrationRecord["kind"];
    name: string;
    slug: string;
    config?: Record<string, unknown>;
    secrets?: Record<string, string>;
    capabilities?: IntegrationRecord["capabilities"];
  }) =>
    request<{ integration: IntegrationRecord; apiKey?: string; webhookSecret?: string }>("/api/control/integrations", {
      method: "POST",
      body: JSON.stringify({ ...input, scope: "global" }),
    }),
  updateControlIntegration: (
    id: string,
    input: { name?: string; config?: Record<string, unknown>; secrets?: Record<string, string>; capabilities?: IntegrationRecord["capabilities"] },
  ) =>
    request<IntegrationRecord>(`/api/control/integrations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteControlIntegration: (id: string) =>
    request<{ ok: boolean }>(`/api/control/integrations/${id}`, { method: "DELETE" }),
  testControlIntegration: (id: string, recipient?: string) =>
    request<{ ok: boolean; detail?: string; latencyMs?: number }>(`/api/control/integrations/${id}/test`, {
      method: "POST",
      body: JSON.stringify({ recipient }),
    }),
  connectControlIntegration: (id: string) =>
    request<IntegrationRecord>(`/api/control/integrations/${id}/connect`, { method: "POST" }),
  disconnectControlIntegration: (id: string) =>
    request<{ ok: boolean }>(`/api/control/integrations/${id}/disconnect`, { method: "POST" }),
  clearControlIntegrationWebhook: (id: string) =>
    request<{ ok: boolean }>(`/api/control/integrations/${id}/telegram/clear-webhook`, { method: "POST" }),
  controlIntegrationQr: (id: string) => request<{ qr: string }>(`/api/control/integrations/${id}/qr`),
  controlOverview: () => request<OrchestratorOverview>("/api/control/overview"),
  controlChat: (message: string, onEvent?: (event: ChatTurnEvent) => void, clientMessageId?: string) =>
    chatStream("/api/control/chat", message, onEvent, clientMessageId),
  controlChatHistory: () => request<{ data: ChatHistoryMessage[] }>("/api/control/chat?limit=200"),
  getControlChatTurn: (turnId: string) =>
    request<{ turn: ChatTurn; messages: ChatHistoryMessage[] }>(`/api/control/chat/turns/${turnId}`),
  attachControlChatTurn: (turnId: string, onEvent?: (event: ChatTurnEvent) => void) =>
    attachTurnStream(`/api/control/chat/turns/${turnId}/events`, onEvent),
  cancelControlChatTurn: (turnId: string) =>
    request<{ turn: ChatTurn }>(`/api/control/chat/turns/${turnId}/cancel`, { method: "POST" }),
  retryControlChatTurn: (turnId: string) =>
    request<{ turn: ChatTurn; warning?: string }>(`/api/control/chat/turns/${turnId}/retry`, { method: "POST" }),
  controlKnowledgeSearch: (query: string, projectSlug?: string) =>
    request<{ data: SearchHit[] }>("/api/control/knowledge/search", {
      method: "POST",
      body: JSON.stringify({ query, projectSlug }),
    }),

  getSettings: () =>
    request<{
      data: {
        opencodeMode: string;
        sentryConfigured: boolean;
        providerConnected: boolean;
        defaultModel?: string;
        orchestratorModel?: string;
        dataDir: string;
      };
    }>("/api/settings"),
  saveSettings: (input: { sentryDsn?: string; defaultModel?: string | null; orchestratorModel?: string | null }) =>
    request<{ ok: boolean; requiresRestart: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify(input) }),
  getEffectiveConfig: (project?: string) =>
    request<EffectiveConfig>(`/api/config/effective${project ? `?project=${encodeURIComponent(project)}` : ""}`),

  health: () => request<HealthPayload>("/api/system/health"),
  errors: () => request<{ data: HealthPayload["recentErrors"] }>("/api/system/errors"),
};

export type { ChatThread, IntegrationRecord, NodeSpec, WorkflowGraph, WorkflowVersion, SubagentProfile, User };
