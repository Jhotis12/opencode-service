/**
 * Sandbox entry point. Runs a single code node inside a Bun Worker and proxies
 * privileged capabilities (db, notify) back to the parent, so secrets never
 * enter this thread.
 */
type RpcMethod = "db" | "notify";

const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
let rpcId = 0;
let allowlistedEnv: Record<string, string> = {};

function rpc(method: RpcMethod, args: unknown): Promise<unknown> {
  const id = ++rpcId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    self.postMessage({ type: "rpc", id, method, args });
  });
}

const ctx = {
  log(message: string, fields?: Record<string, unknown>) {
    self.postMessage({ type: "log", message, fields: fields ?? {} });
  },
  async http(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body,
      signal: AbortSignal.timeout(15_000),
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { status: response.status, headers, body: await response.text() };
  },
  db(integrationId: string, sql: string, params: unknown[] = []) {
    return rpc("db", { integrationId, sql, params });
  },
  notify(integrationId: string, text: string, recipient?: string) {
    return rpc("notify", { integrationId, text, recipient });
  },
  env(key: string) {
    return allowlistedEnv[key];
  },
};

self.onmessage = async (event: MessageEvent) => {
  const data = event.data as
    | { type: "run"; codePath: string; input: unknown; env?: Record<string, string> }
    | { type: "rpc-result"; id: number; ok: boolean; value?: unknown; error?: string };

  if (data.type === "rpc-result") {
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.value);
    else entry.reject(new Error(data.error ?? "rpc failed"));
    return;
  }

  if (data.type !== "run") return;
  allowlistedEnv = data.env ?? {};
  try {
    const module = (await import(`${data.codePath}?v=${Date.now()}`)) as {
      default?: (input: unknown, context: typeof ctx) => unknown;
    };
    if (typeof module.default !== "function") throw new Error("node must export a default async function");
    const output = await module.default(data.input, ctx);
    self.postMessage({ type: "done", output });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};
