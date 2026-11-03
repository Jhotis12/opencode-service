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
    if (!this.deps.turns) return;
    try {
      const turn = await this.deps.turns.waitForTerminal(turnId);
      if (turn.status !== "succeeded") {
        this.deps.logger?.warn({
          event: "channel_chat_turn_failed",
          turnId,
          integrationId,
          status: turn.status,
          errorCode: turn.errorCode,
        });
        return;
      }
      const reply = this.deps.turns.replyForTurn(turnId);
      await this.deps.egress.send(integrationId, reply || "(sin respuesta)", recipient);
    } catch (error) {
      this.deps.logger?.error({
        event: "channel_chat_delivery_failed",
        turnId,
        integrationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
      void (async () => {
        try {
          const final = await this.deps.turns!.waitForTerminal(turn.id);
          const reply = final.status === "succeeded" ? this.deps.turns!.replyForTurn(turn.id) : "";
          await this.deps.egress.send(integration.id, reply || "(sin respuesta)", message.senderId);
        } catch (error) {
          this.deps.logger.error({
            event: "global_channel_chat_delivery_failed",
            turnId: turn.id,
            integrationId: integration.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
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
