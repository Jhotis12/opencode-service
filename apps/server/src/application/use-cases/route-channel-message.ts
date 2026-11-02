import { mkdir } from "node:fs/promises";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { ChannelEgressPort, IncomingChannelMessage, TriggerRef } from "../ports/channels.ts";
import type { EventBus } from "../ports/events.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
import { routeMessage } from "../../domain/channels/router.ts";
import type { ExecuteWorkflowRunUseCase } from "./execute-workflow.ts";

export interface ChannelRouterDeps {
  store: Store;
  workspace: WorkspacePort;
  agent: AgentRuntimePort;
  executor: Pick<ExecuteWorkflowRunUseCase, "execute" | "resumeWithApproval">;
  egress: ChannelEgressPort;
  events: EventBus;
  logger: Logger;
  orchestratorDirectory: string;
}

export class RouteIncomingMessageUseCase {
  constructor(private readonly deps: ChannelRouterDeps) {}

  async execute(message: IncomingChannelMessage): Promise<{ decision: string }> {
    const channel = this.deps.store.channels.findBySlug(message.channelSlug);
    if (!channel) {
      this.deps.logger.warn({
        event: "channel_message_dropped",
        entryPoint: message.channelType,
        channelSlug: message.channelSlug,
        reason: "unknown_channel",
      });
      return { decision: "dropped" };
    }
    const triggers = await this.discoverTriggers(channel.slug, channel.type);
    const decision = routeMessage({
      senderId: message.senderId,
      text: message.text,
      channelSlug: channel.slug,
      allowlist: channel.adminAllowlist,
      triggers,
    });

    if (decision.type === "orchestrator") {
      await this.handleOrchestrator(message, channel.slug);
      return { decision: "orchestrator" };
    }
    if (decision.type === "workflow") {
      await this.handleWorkflow(message, decision.trigger);
      return { decision: "workflow" };
    }
    if (decision.type === "approval") {
      await this.handleApproval(message, decision.command);
      return { decision: "approval" };
    }

    this.deps.logger.warn({
      event: "channel_message_dropped",
      entryPoint: message.channelType,
      channelSlug: message.channelSlug,
      reason: decision.reason,
    });
    return { decision: "dropped" };
  }

  private async discoverTriggers(channelSlug: string, type: string): Promise<TriggerRef[]> {
    const triggers: TriggerRef[] = [];
    for (const projectSlug of await this.deps.workspace.listProjects()) {
      const graph = await this.deps.workspace.readWorkflow(projectSlug).catch(() => undefined);
      if (!graph) continue;
      for (const node of graph.nodes) {
        if (node.type !== "trigger") continue;
        const config = node.config as { kind?: string; channelSlug?: string; isPublic?: boolean };
        if (config.kind !== type || config.channelSlug !== channelSlug) continue;
        triggers.push({
          projectSlug,
          workflowId: graph.id,
          nodeId: node.id,
          channelSlug,
          isPublic: config.isPublic === true,
        });
      }
    }
    return triggers;
  }

  private async handleOrchestrator(message: IncomingChannelMessage, channelSlug: string): Promise<void> {
    const thread = this.deps.store.threads.findOrCreate({
      channelSlug,
      externalThreadId: `admin:${message.senderId}`,
    });
    let sessionId = thread.opencodeSessionId;
    if (!sessionId) {
      await mkdir(this.deps.orchestratorDirectory, { recursive: true });
      const session = await this.deps.agent.createSession({
        directory: this.deps.orchestratorDirectory,
        title: `Orquestador ${channelSlug}`,
      });
      sessionId = session.id;
      this.deps.store.threads.setSession(thread.id, sessionId);
    }
    const reply = await this.deps.agent.prompt(sessionId, message.text);
    this.deps.store.threads.touch(thread.id);
    await this.deps.egress.send(channelSlug, reply || "(sin respuesta)", message.senderId);
  }

  private async handleWorkflow(message: IncomingChannelMessage, trigger: TriggerRef): Promise<void> {
    const graph = await this.deps.workspace.readWorkflow(trigger.projectSlug);
    const run = await this.deps.executor.execute({
      projectSlug: trigger.projectSlug,
      graph,
      payload: {
        message: message.text,
        senderId: message.senderId,
        channelSlug: message.channelSlug,
      },
      entryPoint: message.channelType,
    });
    if (run.status === "paused") {
      const approval = this.deps.store.runs.pendingApproval(run.id);
      await this.deps.egress.send(
        message.channelSlug,
        `Ejecución pausada esperando aprobación.\n/approve ${run.id} ${approval?.nodeId ?? ""}`,
        message.senderId,
      );
      return;
    }
    const output = typeof run.output === "string" ? run.output : JSON.stringify(run.output ?? run.status);
    await this.deps.egress.send(message.channelSlug, output, message.senderId);
  }

  private async handleApproval(
    message: IncomingChannelMessage,
    command: { action: "approve" | "reject"; runId: string; nodeId: string },
  ): Promise<void> {
    const run = await this.deps.executor.resumeWithApproval(
      command.runId,
      command.nodeId,
      command.action === "approve",
      message.senderId,
    );
    await this.deps.egress.send(message.channelSlug, `Ejecución ${command.runId}: ${run.status}`, message.senderId);
  }
}
