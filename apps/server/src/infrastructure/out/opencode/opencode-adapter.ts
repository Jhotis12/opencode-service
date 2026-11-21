import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import type {
  AgentInboxItem,
  AgentMessage,
  AgentModelInfo,
  AgentPromptInput,
  AgentRuntimePort,
  AgentSessionState,
} from "../../../application/ports/runtime.ts";
import { AgentPromptTimeoutError } from "../../../application/ports/runtime.ts";
import { parseModelRef } from "@platform/shared";

/** A dropped response body is a transport hiccup, not a failed turn: the session keeps running. */
function isTransientStreamError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /input stream|terminated|other side closed|socket hang up|ECONNRESET|EPIPE|fetch failed|connection (?:reset|closed)/i.test(
    message,
  );
}

interface ModelLike {
  providerID: string;
  modelID?: string;
  id?: string;
  name: string;
  cost?: Array<{ input: number; output: number }>;
  capabilities?: { input?: string[] };
}

interface MessageLike {
  id?: string;
  type?: string;
  text?: string;
  content?: Array<{ type?: string; text?: string }>;
  time?: { created?: number };
}

export interface OpenCodeClientLike {
  server: { info(): Promise<{ version?: string }> };
  model: { list(): Promise<{ data: ModelLike[] }> };
  session: {
    create(input: {
      location: { directory: string };
      title?: string;
      agent?: string;
      model?: { providerID: string; id: string; variant?: string };
    }): Promise<{ id: string }>;
    prompt(input: {
      sessionID: string;
      text: string;
      id?: string;
      files?: Array<{ uri: string; name?: string; description?: string }>;
      metadata?: Record<string, unknown>;
      delivery?: "queue" | "steer";
    }): Promise<{ id?: string }>;
    get(input: { sessionID: string }): Promise<{
      id?: string;
      outcome?: "succeeded" | "failed" | "interrupted";
      cost?: number;
      tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number } };
      time?: { created?: number; updated?: number; busy?: number; idle?: number };
    }>;
    active(): Promise<Record<string, { type?: string }>>;
    inbox: { list(input: { sessionID: string }): Promise<AgentInboxItem[]> };
    message: { get(input: { sessionID: string; messageID: string }): Promise<MessageLike> };
    interrupt(input: { sessionID: string }): Promise<unknown>;
    switchModel(input: { sessionID: string; model: { providerID: string; id: string; variant?: string } }): Promise<void>;
    switchAgent(input: { sessionID: string; agent: string }): Promise<void>;
    context(input: { sessionID: string }): Promise<MessageLike[]>;
  };
  message: { list(input: { sessionID: string; order?: "asc" | "desc"; limit?: number }): Promise<{ data: MessageLike[] }> };
  experimental: {
    session: {
      wait(input: { sessionID: string }): Promise<void>;
      log?(input: { sessionID: string; after?: number; follow?: boolean }): AsyncIterable<unknown>;
    };
  };
  integration: { connect: { key(input: { integrationID: string; key: string }): Promise<void> } };
  location: { reload(): Promise<void> };
  event: { subscribe(): AsyncIterable<unknown> };
}

export interface OpenCodeClientFactory {
  create(): Promise<{ client: OpenCodeClientLike; url: string; version?: string }>;
}

export function extractAssistantText(messages: MessageLike[]): string {
  const assistant = [...messages].reverse().find((message) => message.type === "assistant");
  if (!assistant?.content) return "";
  return assistant.content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export class ServiceClientFactory implements OpenCodeClientFactory {
  constructor(
    private readonly options: {
      baseUrl?: string;
      serviceFile?: string;
      env?: Record<string, string>;
    } = {},
  ) {}

  async create() {
    const endpoint = this.options.baseUrl
      ? { url: this.options.baseUrl, auth: undefined }
      : await Service.ensure({
          ...(this.options.serviceFile ? { file: this.options.serviceFile } : {}),
          ...(this.options.env ? { env: this.options.env } : {}),
        });
    const longLivedFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...(init ?? {}), timeout: 20 * 60_000 } as RequestInit)) as unknown as typeof fetch;
    const client = OpenCode.make({
      baseUrl: endpoint.url,
      headers: Service.headers(endpoint as never),
      fetch: longLivedFetch,
    }) as unknown as OpenCodeClientLike;
    return { client, url: endpoint.url };
  }
}

export class OpenCodeV2Adapter implements AgentRuntimePort {
  private ready?: { client: OpenCodeClientLike; url: string; version?: string };
  private readyPromise?: Promise<{ client: OpenCodeClientLike; url: string; version?: string }>;

  constructor(private readonly factory: OpenCodeClientFactory = new ServiceClientFactory()) {}

  private async client(): Promise<OpenCodeClientLike> {
    if (this.ready) return this.ready.client;
    if (!this.readyPromise) {
      this.readyPromise = this.factory.create().then(async (result) => {
        this.ready = result;
        return result;
      });
    }
    return (await this.readyPromise).client;
  }

  private resetClient(): void {
    this.ready = undefined;
    this.readyPromise = undefined;
  }

  private isTransportError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /transport|timed out|timeout|fetch|econn|socket|connection/i.test(message);
  }

  async ensureReady(): Promise<{ url: string; version?: string }> {
    await this.client();
    return { url: this.ready!.url, version: this.ready!.version };
  }

  async health(): Promise<{ ok: boolean; detail: string; latencyMs?: number }> {
    const started = Date.now();
    try {
      const client = await this.client();
      const info = await Promise.race([
        client.server.info(),
        new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("health check timed out")), 3000)),
      ]);
      return { ok: true, detail: `OpenCode ${info.version ?? "service"}`, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started };
    }
  }

  async listModels(): Promise<AgentModelInfo[]> {
    const client = await this.client();
    const result = await client.model.list();
    return result.data.map((model) => ({
      providerID: model.providerID,
      modelID: model.modelID ?? model.id ?? model.name,
      name: model.name,
      ...(Array.isArray(model.capabilities?.input) ? { input: model.capabilities.input } : {}),
      cost: model.cost?.[0] ? { input: model.cost[0].input, output: model.cost[0].output } : undefined,
    }));
  }

  async registerProviderKey(providerID: string, apiKey: string): Promise<void> {
    const client = await this.client();
    await client.integration.connect.key({ integrationID: providerID, key: apiKey });
  }

  async createSession(input: {
    directory: string;
    title?: string;
    agent?: string;
    model?: string;
  }): Promise<{ id: string }> {
    const client = await this.client();
    const model = input.model ? parseModelRef(input.model) : undefined;
    const session = await client.session.create({
      location: { directory: input.directory },
      title: input.title,
      agent: input.agent,
      model: model ? { providerID: model.providerID, id: model.modelID, variant: model.variant } : undefined,
    });
    return { id: session.id };
  }

  async sendPrompt(sessionId: string, input: AgentPromptInput): Promise<{ inboxId?: string }> {
    const send = async () => {
      const client = await this.client();
      const result = await client.session.prompt({
        sessionID: sessionId,
        text: input.text,
        id: input.id,
        files: input.files,
        metadata: input.metadata,
        delivery: input.delivery,
      });
      return { inboxId: result?.id };
    };
    try {
      return await send();
    } catch (error) {
      if (!this.isTransportError(error)) throw error;
      this.resetClient();
      return send();
    }
  }

  async getSession(sessionId: string): Promise<AgentSessionState | undefined> {
    const read = async () => {
      const client = await this.client();
      try {
        const info = await client.session.get({ sessionID: sessionId });
        const active = (await client.session.active().catch(() => ({}))) as Record<string, { type?: string }>;
        return {
          id: info.id ?? sessionId,
          active: Boolean(active[sessionId]),
          outcome: info.outcome,
          cost: info.cost,
          tokens: info.tokens
            ? {
                input: info.tokens.input,
                output: info.tokens.output,
                reasoning: info.tokens.reasoning,
                cacheRead: info.tokens.cache?.read,
              }
            : undefined,
          time: info.time,
        } satisfies AgentSessionState;
      } catch (error) {
        if (/session not found/i.test(error instanceof Error ? error.message : String(error))) return undefined;
        throw error;
      }
    };
    try {
      return await read();
    } catch (error) {
      if (!this.isTransportError(error)) throw error;
      this.resetClient();
      return read();
    }
  }

  async listActiveSessions(): Promise<Set<string>> {
    const client = await this.client();
    const active = await client.session.active();
    return new Set(Object.keys(active));
  }

  async listInbox(sessionId: string): Promise<AgentInboxItem[]> {
    const client = await this.client();
    return client.session.inbox.list({ sessionID: sessionId });
  }

  async getMessages(sessionId: string, options: { order?: "asc" | "desc"; limit?: number } = {}): Promise<AgentMessage[]> {
    const client = await this.client();
    const result = await client.message.list({
      sessionID: sessionId,
      order: options.order ?? "asc",
      limit: options.limit ?? 50,
    });
    return (result.data ?? []).map((message) => this.toAgentMessage(message));
  }

  async *openSessionLog(sessionId: string, options: { after?: number; follow?: boolean } = {}): AsyncIterable<unknown> {
    const client = await this.client();
    if (!client.experimental.session.log) return;
    for await (const event of client.experimental.session.log({
      sessionID: sessionId,
      after: options.after ?? 0,
      follow: options.follow ?? true,
    })) {
      yield event;
    }
  }

  async getMessage(sessionId: string, messageId: string): Promise<AgentMessage | undefined> {
    const client = await this.client();
    try {
      return this.toAgentMessage(await client.session.message.get({ sessionID: sessionId, messageID: messageId }));
    } catch {
      return undefined;
    }
  }

  private toAgentMessage(message: MessageLike): AgentMessage {
    const text =
      typeof message.text === "string"
        ? message.text
        : (message.content ?? [])
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text)
            .join("\n");
    return {
      id: message.id ?? "",
      type: message.type ?? "unknown",
      text: text || undefined,
      created: message.time?.created,
    };
  }

  /**
   * `experimental.session.wait` is a long-lived HTTP call, and a dropped body throws
   * "Error in input stream" even though the session keeps running on the other side. That
   * used to fail the whole prompt: the user saw an error and then the answer arrived anyway.
   * A read failure is retried while the session is still active; a real turn failure surfaces
   * as an unsuccessful reconnect, not as a transport error.
   */
  private async waitForTurn(
    client: OpenCodeClientLike,
    sessionId: string,
  ): Promise<void> {
    const attempts = 5;
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.experimental.session.wait({ sessionID: sessionId });
        return;
      } catch (error) {
        if (attempt >= attempts || !isTransientStreamError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(2000, 250 * attempt)));
      }
    }
  }

  async prompt(
    sessionId: string,
    text: string,
    options: { timeoutMs?: number; files?: Array<{ uri: string; name?: string; description?: string }> } = {},
  ): Promise<string> {
    const client = await this.client();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const run = (async () => {
        await client.session.prompt({ sessionID: sessionId, text, files: options.files });
        await this.waitForTurn(client, sessionId);
      })();
      if (options.timeoutMs && options.timeoutMs > 0) {
        await Promise.race([
          run,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new AgentPromptTimeoutError(options.timeoutMs!)), options.timeoutMs);
          }),
        ]);
      } else {
        await run;
      }
    } catch (error) {
      if (error instanceof AgentPromptTimeoutError) {
        await this.interrupt(sessionId).catch(() => undefined);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
    const messages = await client.session.context({ sessionID: sessionId });
    return extractAssistantText(messages);
  }

  async interrupt(sessionId: string): Promise<void> {
    const client = await this.client();
    await client.session.interrupt({ sessionID: sessionId });
  }

  async switchModel(sessionId: string, model: string): Promise<void> {
    const client = await this.client();
    const ref = parseModelRef(model);
    if (!ref) throw new Error(`invalid model reference: ${model}`);
    await client.session.switchModel({
      sessionID: sessionId,
      model: { providerID: ref.providerID, id: ref.modelID, variant: ref.variant },
    });
  }

  async switchAgent(sessionId: string, agent: string): Promise<void> {
    const client = await this.client();
    await client.session.switchAgent({ sessionID: sessionId, agent });
  }

  async reloadLocation(): Promise<void> {
    const client = await this.client();
    await client.location.reload();
  }

  async subscribe(handler: (event: unknown) => void): Promise<() => void> {
    let stopped = false;
    void (async () => {
      while (!stopped) {
        try {
          const client = await this.client();
          for await (const event of client.event.subscribe()) {
            if (stopped) break;
            handler(event);
          }
        } catch {
          if (stopped) break;
          this.resetClient();
        }
        if (!stopped) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    })();
    return async () => {
      stopped = true;
    };
  }
}
