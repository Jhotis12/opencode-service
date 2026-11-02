import type { EntryPointType, StepStatus, WorkflowRunStatus } from "@platform/shared";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface VaultSecretRecord {
  id: string;
  alias: string;
  kind: string;
  ciphertext: string;
  metadata?: string;
  createdAt: string;
}

export interface ExternalDatabaseRecord {
  id: string;
  alias: string;
  driver: string;
  ciphertext: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  chatSessionId?: string;
  createdAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  projectSlug: string;
  workflowId: string;
  status: WorkflowRunStatus;
  idempotencyKey?: string;
  payloadHash: string;
  input: unknown;
  output?: unknown;
  error?: string;
  entryPoint: EntryPointType;
  startedAt: string;
  finishedAt?: string;
}

export interface StepRunRecord {
  id: string;
  runId: string;
  nodeId: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  model?: string;
  agentId?: string;
  logs?: Array<{ message: string; fields: Record<string, unknown> }>;
  durationMs: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
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

export interface ConversationThreadRecord {
  id: string;
  channelSlug: string;
  externalThreadId: string;
  opencodeSessionId?: string;
  projectSlug?: string;
  workflowId?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface ChannelRecord {
  id: string;
  slug: string;
  type: "telegram" | "whatsapp" | "external_chat";
  name: string;
  configCiphertext?: string;
  keyHash?: string;
  adminAllowlist: string[];
  isPublic: boolean;
  status: string;
  webhookUrl?: string;
  createdAt: string;
}

export interface ChatMessageRecord {
  id: string;
  projectSlug: string;
  sessionId?: string;
  role: "user" | "agent" | "system";
  content: string;
  createdAt: string;
}

export interface NotebookRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface KbSourceRecord {
  id: string;
  notebookId: string;
  title: string;
  kind: string;
  uri?: string;
  markdownPath?: string;
  summary: string;
  createdAt: string;
}

export interface KbChunkRecord {
  id: string;
  sourceId: string;
  notebookId: string;
  ordinal: number;
  section: string;
  content: string;
  embedding?: string;
  createdAt: string;
}

export interface ErrorEventRecord {
  id: string;
  requestId?: string;
  entryPoint: EntryPointType;
  level: "warn" | "error" | "fatal";
  message: string;
  stack?: string;
  context?: string;
  createdAt: string;
}
