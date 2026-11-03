import { join } from "node:path";
import type {
  AgentInboxItem,
  AgentMessage,
  AgentModelInfo,
  AgentPromptInput,
  AgentRuntimePort,
  AgentSessionState,
} from "../../../application/ports/runtime.ts";
import { OpenCodeV2Adapter, ServiceClientFactory } from "./opencode-adapter.ts";

/**
 * Deterministic in-process runtime used for local development, E2E and tests
 * when OpenCode V2 is not running. Selected explicitly with OPENCODE_MODE=fake.
 */
export class FakeAgentRuntime implements AgentRuntimePort {
  private sessions = new Map<
    string,
    {
      directory: string;
      model?: string;
      agent?: string;
      active: boolean;
      outcome?: AgentSessionState["outcome"];
      messages: AgentMessage[];
      inbox: AgentInboxItem[];
      timer?: ReturnType<typeof setTimeout>;
    }
  >();
  private handlers = new Set<(event: unknown) => void>();
  private counter = 0;
  registeredKeys: Array<{ providerID: string; apiKey: string }> = [];
  prompts: string[] = [];
  promptCalls: Array<{ sessionId: string; text: string }> = [];
  switchedModels: Array<{ sessionId: string; model: string }> = [];
  scriptedReplies: string[] = [];
  scriptedEvents: Array<{ type: string; data?: Record<string, unknown>; durable?: { seq?: number } }> = [];
  completionDelayMs = 5;
  interruptedSessions: string[] = [];

  get sessionCount(): number {
    return this.sessions.size;
  }

  session(id: string): { directory: string; model?: string; agent?: string } | undefined {
    const session = this.sessions.get(id);
    return session ? { directory: session.directory, model: session.model, agent: session.agent } : undefined;
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
    this.sessions.set(id, {
      directory: input.directory,
      model: input.model,
      agent: input.agent,
      active: false,
      messages: [],
      inbox: [],
    });
    this.emit({ type: "session.created", sessionID: id });
    return { id };
  }

  async prompt(sessionId: string, text: string, _options?: { model?: string; agent?: string; timeoutMs?: number }): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    this.prompts.push(text);
    this.promptCalls.push({ sessionId, text });
    const scripted = this.scriptedReplies.shift();
    if (scripted !== undefined) {
      if (scripted) this.emit({ type: "session.text.delta", sessionID: sessionId, text: scripted });
      return scripted;
    }
    const schemaMatch = /Esquema de salida JSON obligatorio:\s*(\[[\s\S]*?\])\r?\n/.exec(text);
    if (schemaMatch) {
      try {
        const fields = JSON.parse(schemaMatch[1]!) as Array<{
          name: string;
          type: "string" | "number" | "boolean" | "json";
          example?: unknown;
        }>;
        const structured: Record<string, unknown> = {};
        for (const field of fields) {
          if (field.example !== undefined) {
            structured[field.name] = field.example;
          } else if (field.type === "number") {
            structured[field.name] = 1;
          } else if (field.type === "boolean") {
            structured[field.name] = false;
          } else if (field.type === "json") {
            structured[field.name] = {};
          } else {
            structured[field.name] = `simulado-${field.name}`;
          }
        }
        const reply = JSON.stringify(structured);
        this.emit({ type: "session.text.delta", sessionID: sessionId, text: reply });
        return reply;
      } catch {
        // Fall through to standard simulated text
      }
    }
    const model = session.model ?? "opencode-go/fast";
    const preview = text.replace(/\s+/g, " ").slice(0, 220);
    const reply = `[simulado · ${model}] Recibí: ${preview}`;
    this.emit({ type: "session.text.delta", sessionID: sessionId, text: reply });
    return reply;
  }

  async sendPrompt(sessionId: string, input: AgentPromptInput): Promise<{ inboxId?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.active) throw new Error("session is busy");
    const inboxId = input.id ?? `fake-inbox-${++this.counter}`;
    session.active = true;
    session.outcome = undefined;
    session.inbox = [{ id: inboxId, inboxId, type: "user", delivery: input.delivery ?? "steer" }];
    session.messages.push({
      id: inboxId,
      type: "user",
      text: input.text,
      created: Date.now(),
    });
    this.prompts.push(input.text);
    this.promptCalls.push({ sessionId, text: input.text });
    this.emit({ type: "session.inbox.enqueued", sessionID: sessionId, id: inboxId, data: { sessionID: sessionId, inboxID: inboxId } });
    session.timer = setTimeout(() => {
      if (!session.active) return;
      for (const event of this.scriptedEvents.splice(0)) {
        this.emit({
          ...event,
          data: { sessionID: sessionId, ...(event.data ?? {}) },
        });
      }
      const scripted = this.scriptedReplies.shift();
      const reply = scripted ?? `[simulado] ${input.text.replace(/\s+/g, " ").slice(0, 220)}`;
      session.messages.push({
        id: `fake-assistant-${++this.counter}`,
        type: "assistant",
        text: reply,
        created: Date.now(),
      });
      session.active = false;
      session.outcome = "succeeded";
      session.inbox = [];
      this.emit({ type: "session.text.delta", sessionID: sessionId, text: reply });
      this.emit({ type: "session.execution.succeeded", sessionID: sessionId });
    }, this.completionDelayMs);
    return { inboxId };
  }

  async getSession(sessionId: string): Promise<AgentSessionState | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return {
      id: sessionId,
      active: session.active,
      outcome: session.outcome,
      time: { created: 0, updated: Date.now(), busy: session.active ? Date.now() : undefined, idle: session.active ? undefined : Date.now() },
    };
  }

  async listActiveSessions(): Promise<Set<string>> {
    return new Set([...this.sessions.entries()].filter(([, session]) => session.active).map(([id]) => id));
  }

  async listInbox(sessionId: string): Promise<AgentInboxItem[]> {
    return this.sessions.get(sessionId)?.inbox ?? [];
  }

  async getMessages(sessionId: string, options: { order?: "asc" | "desc"; limit?: number } = {}): Promise<AgentMessage[]> {
    const messages = [...(this.sessions.get(sessionId)?.messages ?? [])];
    if (options.order === "desc") messages.reverse();
    return options.limit ? messages.slice(0, options.limit) : messages;
  }

  async getMessage(sessionId: string, messageId: string): Promise<AgentMessage | undefined> {
    return this.sessions.get(sessionId)?.messages.find((message) => message.id === messageId);
  }

  async interrupt(sessionId: string): Promise<void> {
    this.interruptedSessions.push(sessionId);
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return;
    if (session.timer) clearTimeout(session.timer);
    session.active = false;
    session.outcome = "interrupted";
    session.inbox = [];
    this.emit({ type: "session.execution.interrupted", sessionID: sessionId, reason: "user" });
  }

  async switchModel(sessionId: string, model: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    session.model = model;
    this.switchedModels.push({ sessionId, model });
    this.emit({ type: "session.model.selected", sessionID: sessionId, model });
  }

  async switchAgent(sessionId: string, agent: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    session.agent = agent;
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

export function createAgentRuntime(
  env: Record<string, string | undefined> = process.env,
  dataDir?: string,
): AgentRuntimePort {
  if (env.OPENCODE_MODE === "fake") {
    return new FakeAgentRuntime();
  }
  const serviceEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") serviceEnv[key] = value;
  }
  if (dataDir) {
    const opencodeDir = join(dataDir, "opencode");
    serviceEnv.OPENCODE_DB = env.OPENCODE_DB ?? join(opencodeDir, "opencode.db");
    serviceEnv.XDG_STATE_HOME = env.XDG_STATE_HOME ?? join(opencodeDir, "state");
  }
  return new OpenCodeV2Adapter(
    new ServiceClientFactory({
      baseUrl: env.OPENCODE_BASE_URL,
      serviceFile: env.OPENCODE_SERVICE_FILE,
      env: serviceEnv,
    }),
  );
}
