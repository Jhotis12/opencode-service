import { createHmac } from "node:crypto";
import { ChannelRoutingSchema, integrationEvents } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { SecretVault } from "../ports/security.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import { assertSafeUrl } from "../../domain/knowledge/url-safety.ts";
import type { ExecuteWorkflowRunUseCase } from "./execute-workflow.ts";
import { verifyIntegrationKey } from "./manage-integrations.ts";
import { validateWorkflowResources } from "./workflow-resources.ts";
import { ensureChatSession, promptWithSessionRecovery } from "./chat-session.ts";
import type { ChatTarget, ChatTurnService } from "./chat-turns.ts";
import type { Logger } from "../../domain/telemetry/index.ts";

export class ChannelAuthError extends Error {
  constructor() {
    super("invalid integration key");
    this.name = "ChannelAuthError";
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
      turns?: ChatTurnService;
      workspace: WorkspacePort;
      executor: Pick<ExecuteWorkflowRunUseCase, "execute">;
      controlDirectory: string;
      fetchImpl?: typeof fetch;
      webhookValidator?: (url: string) => Promise<unknown>;
      logger?: Logger;
    },
  ) {}

  async execute(input: {
    integrationId: string;
    apiKey: string;
    threadId: string;
    message: string;
    metadata?: Record<string, unknown>;
    webhookUrl?: string;
    messageId?: string;
    onSession?: (sessionId: string) => Promise<void> | void;
  }): Promise<{ threadId: string; sessionId: string; reply: string; integrationId: string; turnId?: string }> {
    const integration = this.deps.store.integrations.findById(input.integrationId);
    if (
      !integration ||
      integration.kind !== "external_chat" ||
      !verifyIntegrationKey(input.apiKey, integration.keyHash)
    ) {
      throw new ChannelAuthError();
    }
    if (input.webhookUrl) {
      const validator = this.deps.webhookValidator ?? ((url: string) => assertSafeUrl(url));
      await validator(input.webhookUrl);
      integration.config = { ...integration.config, webhookUrl: input.webhookUrl };
      this.deps.store.integrations.update(integration.id, { config: integration.config });
    }

    const routing = ChannelRoutingSchema.parse(integration.config.routing ?? {});
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: integration.scope,
      projectSlug: integration.projectSlug,
      integrationId: integration.id,
      externalThreadId: input.threadId,
      title: `${integration.name} · ${input.threadId}`,
    });

    if (routing.mode !== "agent" && integration.projectSlug) {
      const graph = await this.deps.workspace.readWorkflow(integration.projectSlug);
      const trigger = graph.nodes.find(
        (node) =>
          node.type === "trigger" &&
          node.config.kind === "integration" &&
          node.config.integrationId === integration.id &&
          integration.capabilities.includes("inbound_message") &&
          integrationEvents(integration.kind).includes("message.received") &&
          String(node.config.event ?? "message.received") === "message.received",
      );
      if (trigger) {
        await validateWorkflowResources(this.deps.store, this.deps.workspace, integration.projectSlug, graph, {
          requireConnected: true,
        });
        const run = await this.deps.executor.execute({
          projectSlug: integration.projectSlug,
          graph,
          payload: { message: input.message, threadId: input.threadId, metadata: input.metadata ?? {} },
          entryPoint: "external_chat",
          integrationId: integration.id,
          launchedBy: `external:${input.threadId}`,
          sourceDetail: `integration:${integration.id}`,
        });
        const reply = typeof run.output === "string" ? run.output : JSON.stringify(run.output ?? run.status);
        this.deps.store.chatThreads.touch(thread.id);
        await this.maybeDeliver(integration, input.webhookUrl, {
          threadId: input.threadId,
          runId: run.id,
          status: run.status,
          reply,
        });
        return { threadId: input.threadId, sessionId: thread.opencodeSessionId ?? "", reply, integrationId: integration.id };
      }
    }

    const project = integration.projectSlug ? this.deps.store.projects.findBySlug(integration.projectSlug) : undefined;
    const directory = integration.projectSlug
      ? await this.deps.workspace.projectDirectory(integration.projectSlug)
      : this.deps.controlDirectory;
    if (this.deps.turns) {
      const target: ChatTarget = {
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        directory,
        agentId: project?.primaryAgent,
        model: project?.defaultModel,
        context: "external_channel",
        entryPoint: "external_chat",
        readOnly: !integration.projectSlug,
      };
      const turn = await this.deps.turns.start({ thread, target, message: input.message, idempotencyKey: input.messageId });
      await input.onSession?.(turn.sessionId ?? "");
      const final = await this.deps.turns.waitForTerminal(turn.id);
      const reply = final.status === "succeeded" ? this.deps.turns.replyForTurn(turn.id) : "";
      this.deps.store.chatThreads.touch(thread.id);
      await this.maybeDeliver(integration, input.webhookUrl, {
        threadId: input.threadId,
        turnId: turn.id,
        sessionId: final.sessionId,
        reply,
        status: final.status,
      });
      return {
        threadId: input.threadId,
        sessionId: final.sessionId ?? "",
        turnId: turn.id,
        reply,
        integrationId: integration.id,
      };
    }
    const create = () =>
      this.deps.agent.createSession({
        directory,
        title: thread.title,
        agent: project?.primaryAgent,
        model: project?.defaultModel,
      });
    const sessionFactory = { create, agentId: project?.primaryAgent, logger: this.deps.logger };
    const sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);
    await input.onSession?.(sessionId);
    const result = await promptWithSessionRecovery(
      this.deps.store,
      this.deps.agent,
      thread,
      sessionId,
      input.message,
      sessionFactory,
    );
    this.deps.store.chatThreads.touch(thread.id);
    await this.maybeDeliver(integration, input.webhookUrl, {
      threadId: input.threadId,
      sessionId: result.sessionId,
      reply: result.reply,
    });
    return { threadId: input.threadId, sessionId: result.sessionId, reply: result.reply, integrationId: integration.id };
  }

  private async maybeDeliver(
    integration: { scope: "project" | "global"; projectSlug?: string; secretRefs: Record<string, string>; config: Record<string, unknown> },
    webhookUrl: string | undefined,
    payload: unknown,
  ): Promise<void> {
    const url = webhookUrl ?? (typeof integration.config.webhookUrl === "string" ? integration.config.webhookUrl : undefined);
    const alias = integration.secretRefs.webhookSecret;
    if (!url || !alias) return;
    const secret = this.deps.store.vault.findByAlias({
      scope: integration.scope,
      projectSlug: integration.projectSlug,
      alias,
    });
    if (!secret) return;
    await deliverWebhook(url, this.deps.vault.decrypt(secret.ciphertext), payload, this.deps.fetchImpl);
  }
}
