export interface WorkerRpcHandlers {
  db?: (args: { projectSlug: string; integrationId: string; sql: string; params: unknown[] }) => Promise<unknown>;
  notify?: (args: {
    projectSlug: string;
    integrationId: string;
    text: string;
    recipient?: string;
  }) => Promise<unknown>;
}

export interface CodeWorkerPort {
  execute(input: {
    nodeId: string;
    projectSlug: string;
    codePath: string;
    input: unknown;
    timeoutMs: number;
    env?: Record<string, string>;
    handlers?: WorkerRpcHandlers;
  }): Promise<{ output: unknown; logs: Array<{ message: string; fields: Record<string, unknown> }> }>;
}

export class WorkerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`code node timed out after ${timeoutMs}ms`);
    this.name = "WorkerTimeoutError";
  }
}
