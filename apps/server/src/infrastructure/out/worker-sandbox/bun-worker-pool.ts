import type { CodeWorkerPort, WorkerRpcHandlers } from "../../../application/ports/worker.ts";
import { WorkerTimeoutError } from "../../../application/ports/worker.ts";

interface RpcMessage {
  type: "rpc";
  id: number;
  method: "db" | "notify";
  args: unknown;
}

export class BunWorkerPoolAdapter implements CodeWorkerPort {
  async execute(input: {
    nodeId: string;
    codePath: string;
    input: unknown;
    timeoutMs: number;
    env?: Record<string, string>;
    handlers?: WorkerRpcHandlers;
  }): Promise<{ output: unknown; logs: Array<{ message: string; fields: Record<string, unknown> }> }> {
    const worker = new Worker(new URL("./worker-entry.ts", import.meta.url).href, { type: "module" });
    const logs: Array<{ message: string; fields: Record<string, unknown> }> = [];
    const handlers = input.handlers ?? {};

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        fn();
      };
      const timer = setTimeout(() => finish(() => reject(new WorkerTimeoutError(input.timeoutMs))), input.timeoutMs);

      worker.onmessage = async (event: MessageEvent) => {
        const data = event.data as
          | { type: "done"; output: unknown }
          | { type: "error"; message: string; stack?: string }
          | { type: "log"; message: string; fields: Record<string, unknown> }
          | RpcMessage;

        if (data.type === "log") {
          logs.push({ message: data.message, fields: data.fields });
          return;
        }
        if (data.type === "done") {
          finish(() => resolve({ output: data.output, logs }));
          return;
        }
        if (data.type === "error") {
          const error = new Error(data.message);
          if (data.stack) error.stack = data.stack;
          finish(() => reject(error));
          return;
        }
        if (data.type === "rpc") {
          try {
            const handler = handlers[data.method];
            if (!handler) throw new Error(`capability not available: ${data.method}`);
            const value = await handler(data.args as never);
            worker.postMessage({ type: "rpc-result", id: data.id, ok: true, value });
          } catch (error) {
            worker.postMessage({
              type: "rpc-result",
              id: data.id,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      };

      worker.onerror = (event) => {
        finish(() => reject(new Error(event.message || "worker crashed")));
      };

      worker.postMessage({ type: "run", codePath: input.codePath, input: input.input, env: input.env ?? {} });
    });
  }
}
