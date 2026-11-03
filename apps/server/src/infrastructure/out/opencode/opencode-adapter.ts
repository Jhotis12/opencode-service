import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import type { AgentModelInfo, AgentRuntimePort } from "../../../application/ports/runtime.ts";
import { AgentPromptTimeoutError } from "../../../application/ports/runtime.ts";
import { parseModelRef } from "@platform/shared";

interface ModelLike {
  providerID: string;
  modelID?: string;
  id?: string;
  name: string;
  cost?: Array<{ input: number; output: number }>;
}

interface MessageLike {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
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
    prompt(input: { sessionID: string; text: string }): Promise<unknown>;
    interrupt(input: { sessionID: string }): Promise<unknown>;
    switchModel(input: { sessionID: string; model: { providerID: string; id: string; variant?: string } }): Promise<void>;
    switchAgent(input: { sessionID: string; agent: string }): Promise<void>;
    context(input: { sessionID: string }): Promise<MessageLike[]>;
  };
  experimental: { session: { wait(input: { sessionID: string }): Promise<void> } };
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
    const client = OpenCode.make({
      baseUrl: endpoint.url,
      headers: Service.headers(endpoint as never),
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

  async prompt(
    sessionId: string,
    text: string,
    options: { timeoutMs?: number } = {},
  ): Promise<string> {
    const client = await this.client();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const run = (async () => {
        await client.session.prompt({ sessionID: sessionId, text });
        await client.experimental.session.wait({ sessionID: sessionId });
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
    const client = await this.client();
    let stopped = false;
    void (async () => {
      try {
        for await (const event of client.event.subscribe()) {
          if (stopped) break;
          handler(event);
        }
      } catch {
        // Live-only subscription: consumers re-subscribe after a source failure.
      }
    })();
    return async () => {
      stopped = true;
    };
  }
}
