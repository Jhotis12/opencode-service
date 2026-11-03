export interface AgentModelInfo {
  providerID: string;
  modelID: string;
  name: string;
  cost?: { input: number; output: number };
}

export interface AgentSessionRef {
  id: string;
}

export interface AgentSessionState {
  id: string;
  active: boolean;
  outcome?: "succeeded" | "failed" | "interrupted";
  error?: { type?: string; message?: string; status?: number };
  cost?: number;
  tokens?: { input?: number; output?: number; reasoning?: number; cacheRead?: number };
  time?: { created?: number; updated?: number; busy?: number; idle?: number };
}

export interface AgentMessage {
  id: string;
  type: string;
  text?: string;
  created?: number;
}

export interface AgentInboxItem {
  id?: string;
  inboxId?: string;
  type?: string;
  delivery?: string;
}

export interface AgentPromptInput {
  id?: string;
  text: string;
  metadata?: Record<string, unknown>;
  delivery?: "queue" | "steer";
}

export class AgentPromptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`agent prompt timed out after ${timeoutMs}ms`);
    this.name = "AgentPromptTimeoutError";
  }
}

export interface AgentRuntimePort {
  ensureReady(): Promise<{ url: string; version?: string }>;
  health(): Promise<{ ok: boolean; detail: string; latencyMs?: number }>;
  listModels(): Promise<AgentModelInfo[]>;
  registerProviderKey(providerID: string, apiKey: string): Promise<void>;
  createSession(input: {
    directory: string;
    title?: string;
    agent?: string;
    model?: string;
  }): Promise<AgentSessionRef>;
  prompt(
    sessionId: string,
    text: string,
    options?: { model?: string; agent?: string; timeoutMs?: number },
  ): Promise<string>;
  sendPrompt(sessionId: string, input: AgentPromptInput): Promise<{ inboxId?: string }>;
  getSession(sessionId: string): Promise<AgentSessionState | undefined>;
  listActiveSessions(): Promise<Set<string>>;
  listInbox(sessionId: string): Promise<AgentInboxItem[]>;
  getMessages(sessionId: string, options?: { order?: "asc" | "desc"; limit?: number }): Promise<AgentMessage[]>;
  getMessage(sessionId: string, messageId: string): Promise<AgentMessage | undefined>;
  openSessionLog?(sessionId: string, options?: { after?: number; follow?: boolean }): AsyncIterable<unknown>;
  interrupt(sessionId: string): Promise<void>;
  switchModel(sessionId: string, model: string): Promise<void>;
  switchAgent(sessionId: string, agent: string): Promise<void>;
  reloadLocation(directory: string): Promise<void>;
  subscribe(handler: (event: unknown) => void): Promise<() => void>;
}

export interface ExternalDatabaseStatement {
  sql: string;
  params?: unknown[];
}

export interface ExternalDatabaseStatementResult {
  rows: unknown[];
  affectedRows: number;
}

export interface ExternalDatabaseAdapter {
  test(config: ExternalDbConfig): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
  query(config: ExternalDbConfig, sql: string, params?: unknown[]): Promise<unknown[]>;
  transaction(config: ExternalDbConfig, statements: ExternalDatabaseStatement[]): Promise<ExternalDatabaseStatementResult[]>;
}

export interface ExternalDbConfig {
  driver: "postgres" | "mysql" | "mssql" | "sqlite";
  connectionString?: string;
  filename?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}
