import type {
  EntryPointType,
  IntegrationCapability,
  IntegrationKind,
  IntegrationScope,
  IntegrationStatus,
  StepStatus,
  WorkflowGraph,
  WorkflowRunStatus,
  ChatTurnStatus,
  ChatTurnErrorCode,
  ChatTurnUsage,
  DestinationKind,
  MediaRef,
} from "@platform/shared";

export type EntityScope = "project" | "global";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface VaultSecretRecord {
  id: string;
  scope: EntityScope;
  projectSlug?: string;
  alias: string;
  kind: string;
  ciphertext: string;
  metadata?: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  defaultModel?: string;
  primaryAgent?: string;
  approvalIntegrationId?: string;
  approvalRecipient?: string;
  transcriptionIntegrationId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IntegrationRecord {
  id: string;
  scope: IntegrationScope;
  projectSlug?: string;
  kind: IntegrationKind;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  secretRefs: Record<string, string>;
  capabilities: IntegrationCapability[];
  status: IntegrationStatus;
  keyHash?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDestinationRecord {
  id: string;
  projectSlug: string;
  kind: DestinationKind;
  label: string;
  value: string;
  createdAt: string;
  updatedAt: string;
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
  launchedBy?: string;
  graphHash?: string;
  versionId?: string;
  integrationId?: string;
  sourceDetail?: string;
  parentRunId?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowVersionRecord {
  id: string;
  projectSlug: string;
  version: number;
  graphHash: string;
  graph: WorkflowGraph;
  codeBundle: Record<string, string>;
  createdBy?: string;
  createdAt: string;
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

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface WorkflowDeliveryRecord {
  id: string;
  projectSlug: string;
  runId?: string;
  nodeId?: string;
  integrationId: string;
  actionKey: string;
  recipient?: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowScheduleStateRecord {
  id: string;
  projectSlug: string;
  workflowId: string;
  nodeId: string;
  timezone: string;
  enabled: boolean;
  overlapPolicy: "skip" | "allow";
  catchUp: boolean;
  catchUpWindowMinutes: number;
  lastWindowAt?: string;
  nextWindowAt?: string;
  lastRunId?: string;
  updatedAt: string;
}

export interface SessionContextRecord {
  sessionId: string;
  scope: EntityScope;
  projectSlug?: string;
  agentId?: string;
  context: "chat" | "workflow" | "external_channel";
  runId?: string;
  integrationId?: string;
  externalThreadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTimerRecord {
  id: string;
  runId: string;
  nodeId: string;
  dueAt: string;
  status: "pending" | "running" | "fired";
  payload?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedRunRecord {
  runId: string;
  projectSlug: string;
  createdAt: string;
}

export interface ChatThreadRecord {
  id: string;
  scope: EntityScope;
  projectSlug?: string;
  integrationId?: string;
  externalThreadId?: string;
  opencodeSessionId?: string;
  title?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface ChatMessageRecord {
  id: string;
  threadId: string;
  turnId?: string;
  role: "user" | "agent" | "system";
  content: string;
  attachments?: MediaRef[];
  errorCode?: ChatTurnErrorCode;
  createdAt: string;
}

export type ChatTurnDeliveryState = "created" | "enqueued" | "delivered" | "completed";

export interface ChatTurnRecord {
  id: string;
  threadId: string;
  scope: EntityScope;
  projectSlug?: string;
  integrationId?: string;
  externalThreadId?: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  inboxId?: string;
  assistantOpencodeMessageId?: string;
  status: ChatTurnStatus;
  deliveryState: ChatTurnDeliveryState;
  attempt: number;
  startedAt: string;
  finishedAt?: string;
  lastActivityAt: string;
  lastSeq?: number;
  errorCode?: ChatTurnErrorCode;
  errorMessage?: string;
  usage?: ChatTurnUsage;
  hasSideEffects?: boolean;
  idempotencyKey?: string;
  entryPoint: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatTurnEventRecord {
  turnId: string;
  seq: number;
  type: string;
  payload: string;
  createdAt: string;
}

export interface NotebookRecord {
  id: string;
  projectSlug: string;
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
