export interface AgentModelInfo {
  providerID: string;
  modelID: string;
  name: string;
  cost?: { input: number; output: number };
}

export interface AgentSessionRef {
  id: string;
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
  prompt(sessionId: string, text: string, options?: { model?: string; agent?: string }): Promise<string>;
  switchModel(sessionId: string, model: string): Promise<void>;
  switchAgent(sessionId: string, agent: string): Promise<void>;
  reloadLocation(directory: string): Promise<void>;
  subscribe(handler: (event: unknown) => void): Promise<() => void>;
}

export interface ExternalDatabaseAdapter {
  test(config: ExternalDbConfig): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
  query(config: ExternalDbConfig, sql: string, params?: unknown[]): Promise<unknown[]>;
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
