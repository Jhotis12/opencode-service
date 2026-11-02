import type { AgentModelInfo, AgentRuntimePort } from "../../../application/ports/runtime.ts";
import { OpenCodeV2Adapter, ServiceClientFactory } from "./opencode-adapter.ts";

/**
 * Deterministic in-process runtime used for local development, E2E and tests
 * when OpenCode V2 is not running. Selected explicitly with OPENCODE_MODE=fake.
 */
export class FakeAgentRuntime implements AgentRuntimePort {
  private sessions = new Map<string, { directory: string; model?: string; agent?: string }>();
  private handlers = new Set<(event: unknown) => void>();
  private counter = 0;
  registeredKeys: Array<{ providerID: string; apiKey: string }> = [];
  prompts: string[] = [];

  get sessionCount(): number {
    return this.sessions.size;
  }

  async ensureReady() {
    return { url: "fake://opencode", version: "fake" };
  }

  async health() {
    return { ok: true, detail: "fake runtime", latencyMs: 0 };
  }

  async listModels(): Promise<AgentModelInfo[]> {
    return [
      { providerID: "opencode-go", modelID: "fast", name: "OpenCode Go Fast" },
      { providerID: "opencode-go", modelID: "reasoning", name: "OpenCode Go Reasoning" },
      { providerID: "opencode", modelID: "default", name: "OpenCode Default" },
    ];
  }

  async registerProviderKey(providerID: string, apiKey: string): Promise<void> {
    this.registeredKeys.push({ providerID, apiKey });
  }

  async createSession(input: { directory: string; title?: string; agent?: string; model?: string }) {
    const id = `fake-session-${++this.counter}`;
    this.sessions.set(id, { directory: input.directory, model: input.model, agent: input.agent });
    this.emit({ type: "session.created", sessionID: id });
    return { id };
  }

  async prompt(sessionId: string, text: string): Promise<string> {
    this.prompts.push(text);
    const session = this.sessions.get(sessionId);
    const model = session?.model ?? "opencode-go/fast";
    const preview = text.replace(/\s+/g, " ").slice(0, 220);
    const reply = `[simulado · ${model}] Recibí: ${preview}`;
    this.emit({ type: "session.text.delta", sessionID: sessionId, text: reply });
    return reply;
  }

  async switchModel(sessionId: string, model: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.model = model;
    this.emit({ type: "session.model.selected", sessionID: sessionId, model });
  }

  async switchAgent(sessionId: string, agent: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.agent = agent;
    this.emit({ type: "session.agent.selected", sessionID: sessionId, agent });
  }

  async reloadLocation(): Promise<void> {}

  async subscribe(handler: (event: unknown) => void): Promise<() => void> {
    this.handlers.add(handler);
    return async () => {
      this.handlers.delete(handler);
    };
  }

  private emit(event: unknown): void {
    for (const handler of this.handlers) handler(event);
  }
}

export function createAgentRuntime(env: Record<string, string | undefined> = process.env): AgentRuntimePort {
  if (env.OPENCODE_MODE === "fake") {
    return new FakeAgentRuntime();
  }
  return new OpenCodeV2Adapter(
    new ServiceClientFactory({ baseUrl: env.OPENCODE_BASE_URL, serviceFile: env.OPENCODE_SERVICE_FILE }),
  );
}
