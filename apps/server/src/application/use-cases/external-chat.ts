import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Store } from "../ports/store.ts";
import type { SecretVault } from "../ports/security.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { ChannelRecord } from "../../domain/entities.ts";
import { assertSafeUrl } from "../../domain/knowledge/url-safety.ts";
import type { ExecuteWorkflowRunUseCase } from "./execute-workflow.ts";

export class ChannelAuthError extends Error {
  constructor() {
    super("invalid channel key");
    this.name = "ChannelAuthError";
  }
}

export interface ExternalChatConfig {
  webhookSecret?: string;
  projectSlug?: string;
  workflowId?: string;
  agentId?: string;
  model?: string;
}

export function hashChannelKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyChannelKey(key: string, expectedHash: string | undefined): boolean {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashChannelKey(key));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class CreateChannelUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
  ) {}

  execute(input: {
    slug: string;
    type: "telegram" | "whatsapp" | "external_chat";
    name: string;
    adminAllowlist?: string[];
    isPublic?: boolean;
    config?: Record<string, unknown>;
  }): { channel: ChannelRecord; apiKey?: string; webhookSecret?: string } {
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(input.slug)) throw new Error("invalid channel slug");
    if (this.store.channels.findBySlug(input.slug)) throw new Error(`channel already exists: ${input.slug}`);
    const apiKey = input.type === "external_chat" ? `sk_chat_${crypto.randomUUID().replaceAll("-", "")}` : undefined;
    const webhookSecret = input.type === "external_chat" ? randomBytes(24).toString("hex") : undefined;
    const config = { ...(input.config ?? {}), ...(webhookSecret ? { webhookSecret } : {}) };
    const channel: ChannelRecord = {
      id: crypto.randomUUID(),
      slug: input.slug,
      type: input.type,
      name: input.name,
      configCiphertext: this.vault.encrypt(JSON.stringify(config)),
      keyHash: apiKey ? hashChannelKey(apiKey) : undefined,
      adminAllowlist: input.adminAllowlist ?? [],
      isPublic: input.isPublic ?? false,
      status: "disconnected",
      createdAt: new Date().toISOString(),
    };
    this.store.channels.create(channel);
    return { channel, apiKey, webhookSecret };
  }

  list(): ChannelRecord[] {
    return this.store.channels.list();
  }
}

export function signWebhook(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverWebhook(
  url: string,
  secret: string,
  payload: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const body = JSON.stringify(payload);
  await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-signature": `sha256=${signWebhook(secret, body)}`,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
}

export class SendExternalChatMessageUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      vault: SecretVault;
      agent: AgentRuntimePort;
      workspace: WorkspacePort;
      executor: Pick<ExecuteWorkflowRunUseCase, "execute">;
      defaultDirectory: string;
      fetchImpl?: typeof fetch;
      webhookValidator?: (url: string) => Promise<unknown>;
    },
  ) {}

  async execute(input: {
    channelSlug: string;
    apiKey: string;
    threadId: string;
    message: string;
    metadata?: Record<string, unknown>;
    webhookUrl?: string;
    onSession?: (sessionId: string) => Promise<void> | void;
  }): Promise<{ threadId: string; sessionId: string; reply: string; channel: ChannelRecord; config: ExternalChatConfig }> {
    const channel = this.deps.store.channels.findBySlug(input.channelSlug);
    if (!channel || channel.type !== "external_chat" || !verifyChannelKey(input.apiKey, channel.keyHash)) {
      throw new ChannelAuthError();
    }
    const config = JSON.parse(this.deps.vault.decrypt(channel.configCiphertext!)) as ExternalChatConfig;

    if (input.webhookUrl) {
      const validator = this.deps.webhookValidator ?? ((url: string) => assertSafeUrl(url));
      await validator(input.webhookUrl);
      this.deps.store.channels.setWebhook(channel.slug, input.webhookUrl);
    }

    const thread = this.deps.store.threads.findOrCreate({
      channelSlug: channel.slug,
      externalThreadId: input.threadId,
      projectSlug: config.projectSlug,
      workflowId: config.workflowId,
    });

    if (config.workflowId && config.projectSlug) {
      const graph = await this.deps.workspace.readWorkflow(config.projectSlug);
      const run = await this.deps.executor.execute({
        projectSlug: config.projectSlug,
        graph,
        payload: { message: input.message, threadId: input.threadId, metadata: input.metadata ?? {} },
        entryPoint: "external_chat",
      });
      const reply = typeof run.output === "string" ? run.output : JSON.stringify(run.output ?? run.status);
      this.deps.store.threads.touch(thread.id);
      await this.maybeDeliver(channel, config, input.webhookUrl, { threadId: input.threadId, runId: run.id, status: run.status, reply });
      return { threadId: input.threadId, sessionId: thread.opencodeSessionId ?? "", reply, channel, config };
    }

    let sessionId = thread.opencodeSessionId;
    if (!sessionId) {
      const directory = config.projectSlug
        ? await this.deps.workspace.projectDirectory(config.projectSlug)
        : this.deps.defaultDirectory;
      const session = await this.deps.agent.createSession({
        directory,
        title: `Chat externo ${channel.slug} · ${input.threadId}`,
        agent: config.agentId,
        model: config.model,
      });
      sessionId = session.id;
      this.deps.store.threads.setSession(thread.id, sessionId);
    }
    await input.onSession?.(sessionId);
    const reply = await this.deps.agent.prompt(sessionId, input.message);
    this.deps.store.threads.touch(thread.id);
    await this.maybeDeliver(channel, config, input.webhookUrl, { threadId: input.threadId, sessionId, reply });
    return { threadId: input.threadId, sessionId, reply, channel, config };
  }

  private async maybeDeliver(
    channel: ChannelRecord,
    config: ExternalChatConfig,
    webhookUrl: string | undefined,
    payload: unknown,
  ): Promise<void> {
    const url = webhookUrl ?? channel.webhookUrl;
    if (!url || !config.webhookSecret) return;
    await deliverWebhook(url, config.webhookSecret, payload, this.deps.fetchImpl);
  }
}
