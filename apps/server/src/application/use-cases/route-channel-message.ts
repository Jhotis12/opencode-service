import { ChannelRoutingSchema } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { IncomingIntegrationMessage, IntegrationEgressPort, TriggerRef } from "../ports/channels.ts";
import type { EventBus } from "../ports/events.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
import { routeGlobalMessage, routeProjectMessage } from "../../domain/channels/router.ts";
import type { ExecuteWorkflowRunUseCase } from "./execute-workflow.ts";
import type { IntegrationRecord } from "../../domain/entities.ts";
import { validateWorkflowResources } from "./workflow-resources.ts";
import { ensureChatSession, promptWithSessionRecovery } from "./chat-session.ts";
import type { ChatTarget, ChatTurnService } from "./chat-turns.ts";

const deliveriesInFlight = new Set<string>();

async function deliverChatTurn(
  deps: {
    store: Store;
    egress: IntegrationEgressPort;
    turns?: ChatTurnService;
    logger: Logger;
  },
  integrationId: string,
  recipient: string,
  turnId: string,
): Promise<void> {
  if (!deps.turns) return;
  const actionKey = `chat:${turnId}`;
  if (deliveriesInFlight.has(actionKey)) return;
  deliveriesInFlight.add(actionKey);
  try {
  const existing = deps.store.deliveries.findByActionKey({ actionKey, integrationId });
  if (existing?.status === "delivered") return;
  const now = new Date().toISOString();
  const delivery =
    existing ?? {
      id: crypto.randomUUID(),
      projectSlug: deps.turns.get(turnId)?.projectSlug ?? "",
      runId: undefined,
      nodeId: undefined,
      integrationId,
      actionKey,
      recipient,
      status: "pending" as const,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
  if (!existing) deps.store.deliveries.create(delivery);
  try {
    const final = await deps.turns.waitForTerminal(turnId);
    if (final.status !== "succeeded") {
      deps.store.deliveries.update(delivery.id, {
        status: "failed",
        lastError: `turn ${final.status}`,
        attempts: delivery.attempts + 1,
      });
      deps.logger.warn({
        event: "channel_chat_turn_failed",
        turnId,
        integrationId,
        status: final.status,
        errorCode: final.errorCode,
      });
      return;
    }
    const reply = deps.turns.replyForTurn(turnId) || "(sin respuesta)";
    for (let attempt = delivery.attempts + 1; attempt <= 3; attempt += 1) {
      try {
        const result = await deps.egress.send(integrationId, reply, recipient);
        deps.store.deliveries.update(delivery.id, {
          status: "delivered",
          providerMessageId: result.providerMessageId,
          attempts: attempt,
        });
        return;
      } catch (error) {
        const lastError = error instanceof Error ? error.message : String(error);
        deps.store.deliveries.update(delivery.id, { status: "failed", lastError, attempts: attempt });
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  } catch (error) {
    deps.store.deliveries.update(delivery.id, {
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
      attempts: delivery.attempts + 1,
    });
    deps.logger.error({
      event: "channel_chat_delivery_failed",
      turnId,
      integrationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  } finally {
    deliveriesInFlight.delete(actionKey);
  }
}

export interface ChannelRouterDeps {
  store: Store;
  workspace: WorkspacePort;
  agent: AgentRuntimePort;
  turns?: ChatTurnService;
  executor: Pick<ExecuteWorkflowRunUseCase, "execute" | "resumeWithApproval">;
  egress: IntegrationEgressPort;
  events: EventBus;
  logger: Logger;
}

const ENTRY_POINTS = {
  telegram: "telegram",
  whatsapp: "whatsapp",
  external_chat: "external_chat",
  email: "email",
} as const;

export class RouteProjectIntegrationMessageUseCase {
  constructor(private readonly deps: ChannelRouterDeps) {}

  async execute(message: IncomingIntegrationMessage): Promise<{ decision: string }> {
    const integration = this.deps.store.integrations.findById(message.integrationId);
    if (!integration || integration.scope !== "project" || !integration.projectSlug) {
      this.logDrop(message, "unknown_project_integration");
      return { decision: "dropped" };
    }
    const project = this.deps.store.projects.findBySlug(integration.projectSlug);
    if (!project) {
      this.logDrop(message, "unknown_project");
      return { decision: "dropped" };
    }
    const graph = await this.deps.workspace.readWorkflow(integration.projectSlug).catch(() => undefined);
    const triggers = graph
      ? graph.nodes
          .filter((node) => node.type === "trigger")
          .filter((node) => node.config.integrationId === integration.id)
          .filter((node) => String(node.config.event ?? "message.received") === (message.event ?? "message.received"))
          .map<TriggerRef>((node) => ({
            projectSlug: integration.projectSlug!,
            workflowId: graph.id,
            nodeId: node.id,
            integrationId: integration.id,
            event: String(node.config.event ?? "message.received"),
          }))
      : [];
    const routing = ChannelRoutingSchema.parse(integration.config.routing ?? {});
    const decision = routeProjectMessage({
      senderId: message.senderId,
      text: message.text,
      mode: routing.mode,
      allowlist: routing.allowlist,
      publicTriggers: routing.public,
      triggers,
    });

    if (decision.type === "agent") {
      await this.handleAgent(integration, project.primaryAgent, project.defaultModel, message);
      return { decision: "agent" };
    }
    if (decision.type === "workflow") {
      await this.handleWorkflow(integration, decision.trigger, message);
      return { decision: "workflow" };
    }
    if (decision.type === "approval") {
      await this.handleApproval(integration, decision.command, message);
      return { decision: "approval" };
    }
    this.logDrop(message, decision.reason);
    return { decision: "dropped" };
  }

  private async handleAgent(
    integration: IntegrationRecord,
    primaryAgent: string | undefined,
    defaultModel: string | undefined,
    message: IncomingIntegrationMessage,
  ): Promise<void> {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "project",
      projectSlug: integration.projectSlug,
      integrationId: integration.id,
      externalThreadId: message.senderId,
      title: `${integration.name} · ${message.senderId}`,
    });
    const directory = await this.deps.workspace.projectDirectory(integration.projectSlug!);
    if (this.deps.turns) {
      const target: ChatTarget = {
        scope: "project",
        projectSlug: integration.projectSlug,
        directory,
        agentId: primaryAgent,
        model: defaultModel,
        context: "external_channel",
        entryPoint: ENTRY_POINTS[message.kind],
      };
      const turn = await this.deps.turns.start({
        thread,
        target,
        message: message.text,
        idempotencyKey: message.externalMessageId ? `${integration.id}:${message.externalMessageId}` : undefined,
      });
      void this.deliverTurn(integration.id, message.senderId, turn.id);
      return;
    }
    const create = () =>
      this.deps.agent.createSession({
        directory,
        title: thread.title,
        agent: primaryAgent,
        model: defaultModel,
      });
    const sessionFactory = { create, agentId: primaryAgent, logger: this.deps.logger };
    const sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);
    const result = await promptWithSessionRecovery(
      this.deps.store,
      this.deps.agent,
      thread,
      sessionId,
      message.text,
      sessionFactory,
    );
    this.deps.store.chatThreads.touch(thread.id);
    await this.deps.egress.send(integration.id, result.reply || "(sin respuesta)", message.senderId);
  }

  private async deliverTurn(integrationId: string, recipient: string, turnId: string): Promise<void> {
    await deliverChatTurn(this.deps, integrationId, recipient, turnId);
  }

  private async handleWorkflow(
    integration: IntegrationRecord,
    trigger: TriggerRef,
    message: IncomingIntegrationMessage,
  ): Promise<void> {
    const graph = await this.deps.workspace.readWorkflow(trigger.projectSlug);
    await validateWorkflowResources(this.deps.store, this.deps.workspace, trigger.projectSlug, graph);
    const run = await this.deps.executor.execute({
      projectSlug: trigger.projectSlug,
      graph,
      payload: {
        message: message.text,
        senderId: message.senderId,
        integrationId: integration.id,
        metadata: message.metadata ?? {},
      },
      entryPoint: ENTRY_POINTS[message.kind],
      integrationId: integration.id,
      launchedBy: message.senderId,
      sourceDetail: `integration:${integration.id}`,
    });
    if (run.status === "paused") {
      const approval = this.deps.store.runs.pendingApproval(run.id);
      await this.deps.egress.send(
        integration.id,
        `Ejecución pausada esperando aprobación.\n/approve ${run.id} ${approval?.nodeId ?? ""}`,
        message.senderId,
      );
      return;
    }
    const output = typeof run.output === "string" ? run.output : JSON.stringify(run.output ?? run.status);
    await this.deps.egress.send(integration.id, output, message.senderId);
  }

  private async handleApproval(
    integration: IntegrationRecord,
    command: { action: "approve" | "reject"; runId: string; nodeId: string },
    message: IncomingIntegrationMessage,
  ): Promise<void> {
    const run = await this.deps.executor.resumeWithApproval(
      command.runId,
      command.nodeId,
      command.action === "approve",
      message.senderId,
    );
    await this.deps.egress.send(integration.id, `Ejecución ${command.runId}: ${run.status}`, message.senderId);
  }

  private logDrop(message: IncomingIntegrationMessage, reason: string): void {
    this.deps.logger.warn({
      event: "integration_message_dropped",
      entryPoint: ENTRY_POINTS[message.kind],
      integrationId: message.integrationId,
      reason,
    });
  }
}

export class RouteGlobalIntegrationMessageUseCase {
  constructor(
    private readonly deps: ChannelRouterDeps & {
      controlDirectory: string;
      orchestratorAgent: string;
    },
  ) {}

  async execute(message: IncomingIntegrationMessage): Promise<{ decision: string }> {
    const integration = this.deps.store.integrations.findById(message.integrationId);
    if (!integration || integration.scope !== "global") {
      this.deps.logger.warn({
        event: "global_message_dropped",
        entryPoint: "global_orchestrator",
        integrationId: message.integrationId,
        reason: "unknown_global_integration",
      });
      return { decision: "dropped" };
    }
    const routing = ChannelRoutingSchema.parse(integration.config.routing ?? {});
    const decision = routeGlobalMessage({ senderId: message.senderId, allowlist: routing.allowlist });
    if (decision.type === "dropped") {
      this.deps.logger.warn({
        event: "global_message_dropped",
        entryPoint: "global_orchestrator",
        integrationId: integration.id,
        reason: decision.reason,
      });
      return { decision: "dropped" };
    }
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "global",
      integrationId: integration.id,
      externalThreadId: message.senderId,
      title: `Orquestador · ${message.senderId}`,
    });
    if (this.deps.turns) {
      const target: ChatTarget = {
        scope: "global",
        directory: this.deps.controlDirectory,
        agentId: this.deps.orchestratorAgent,
        context: "external_channel",
        entryPoint: "global_orchestrator",
        readOnly: true,
      };
      const turn = await this.deps.turns.start({
        thread,
        target,
        message: message.text,
        idempotencyKey: message.externalMessageId ? `${integration.id}:${message.externalMessageId}` : undefined,
      });
      void deliverChatTurn(
        {
          store: this.deps.store,
          egress: this.deps.egress,
          turns: this.deps.turns,
          logger: this.deps.logger,
        },
        integration.id,
        message.senderId,
        turn.id,
      );
      return { decision: "orchestrator" };
    }
    const create = () =>
      this.deps.agent.createSession({
        directory: this.deps.controlDirectory,
        title: thread.title,
        agent: this.deps.orchestratorAgent,
      });
    const sessionFactory = { create, agentId: this.deps.orchestratorAgent, logger: this.deps.logger };
    const sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);
    const result = await promptWithSessionRecovery(
      this.deps.store,
      this.deps.agent,
      thread,
      sessionId,
      message.text,
      sessionFactory,
    );
    this.deps.store.chatThreads.touch(thread.id);
    await this.deps.egress.send(integration.id, result.reply || "(sin respuesta)", message.senderId);
    return { decision: "orchestrator" };
  }
}
