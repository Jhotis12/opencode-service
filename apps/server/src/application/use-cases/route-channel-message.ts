import { ChannelRoutingSchema, integrationEvents, type MediaRef } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type {
  EgressSendResult,
  IncomingIntegrationMessage,
  IntegrationEgressPort,
  OutgoingMedia,
  TriggerRef,
} from "../ports/channels.ts";
import type { MediaScope, MediaStorePort } from "../ports/media.ts";
import { MediaStoreError } from "../ports/media.ts";
import type { EventBus } from "../ports/events.ts";
import type { TranscriptionPort } from "../ports/transcription.ts";
import { SPEECH_MAX_CHARS, type SpeechPort } from "../ports/speech.ts";
import type { Logger, Metrics } from "../../domain/telemetry/index.ts";
import { readMedia, toAttachmentFiles } from "../../domain/media.ts";
import { routeGlobalMessage, routeProjectMessage } from "../../domain/channels/router.ts";
import type { ExecuteWorkflowRunUseCase } from "./execute-workflow.ts";
import type { IntegrationRecord } from "../../domain/entities.ts";
import { validateWorkflowResources } from "./workflow-resources.ts";
import { resolveDestinationList } from "./destinations.ts";
import { ensureChatSession, promptWithSessionRecovery } from "./chat-session.ts";
import type { ChatTarget, ChatTurnService } from "./chat-turns.ts";

const deliveriesInFlight = new Set<string>();

async function deliverChatTurn(
  deps: {
    store: Store;
    egress: IntegrationEgressPort;
    turns?: ChatTurnService;
    speech?: SpeechPort;
    metrics?: Metrics;
    logger: Logger;
  },
  integrationId: string,
  recipient: string,
  turnId: string,
  options: { voiceReply?: boolean; speechIntegrationId?: string } = {},
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
      const integration = deps.store.integrations.findById(integrationId);
      let media: OutgoingMedia | undefined;
      if (options.voiceReply) {
        const fallback = (reason: string, error?: unknown) => {
          deps.metrics?.increment("voice_reply_fallback");
          deps.logger.warn({
            event: "voice_reply_fallback",
            projectSlug: integration?.projectSlug,
            integrationId,
            turnId,
            reason,
            ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
          });
        };
        if (!integration?.projectSlug) fallback("missing_project");
        else if (!options.speechIntegrationId) fallback("missing_speech");
        else if (!deps.speech) fallback("missing_speech");
        else if (!deps.egress.sendMedia) fallback("media_unsupported");
        else if (reply.length > SPEECH_MAX_CHARS) fallback("text_too_long");
        else {
          try {
            const speech = await deps.speech.synthesize({
              integrationId: options.speechIntegrationId,
              scope: "project",
              projectSlug: integration.projectSlug,
              text: reply,
              timeoutMs: 120_000,
            });
            const extension = speech.mime === "audio/wav" ? "wav" : speech.mime === "audio/flac" ? "flac" : "mp3";
            media = { bytes: speech.bytes, filename: `reply.${extension}`, mime: speech.mime, caption: reply };
          } catch (error) {
            fallback("synthesis_failed", error);
          }
        }
      }

      const deliver = async (attempt: number): Promise<EgressSendResult> => {
        if (media && deps.egress.sendMedia) return deps.egress.sendMedia(integrationId, media, recipient);
        return deps.egress.send(integrationId, reply, recipient);
      };
      for (let attempt = delivery.attempts + 1; attempt <= 3; attempt += 1) {
        try {
          const result = await deliver(attempt);
          deps.store.deliveries.update(delivery.id, {
            status: "delivered",
            providerMessageId: result.providerMessageId,
            attempts: attempt,
          });
          if (media) {
            deps.metrics?.increment("voice_reply_sent");
            deps.logger.info({
              event: "voice_reply_sent",
              projectSlug: integration?.projectSlug,
              integrationId,
              turnId,
              bytes: media.bytes.byteLength,
            });
          }
          return;
        } catch (error) {
          const lastError = error instanceof Error ? error.message : String(error);
          deps.store.deliveries.update(delivery.id, { status: "failed", lastError, attempts: attempt });
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
      if (media) {
        deps.metrics?.increment("voice_reply_fallback");
        deps.logger.warn({
          event: "voice_reply_fallback",
          projectSlug: integration?.projectSlug,
          integrationId,
          turnId,
          reason: "delivery_failed",
        });
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const result = await deps.egress.send(integrationId, reply, recipient);
            deps.store.deliveries.update(delivery.id, {
              status: "delivered",
              providerMessageId: result.providerMessageId,
              attempts: delivery.attempts + attempt,
            });
            return;
          } catch (error) {
            const lastError = error instanceof Error ? error.message : String(error);
            deps.store.deliveries.update(delivery.id, {
              status: "failed",
              lastError,
              attempts: delivery.attempts + attempt,
            });
            if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
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
  media: MediaStorePort;
  transcription?: TranscriptionPort;
  speech?: SpeechPort;
  metrics?: Metrics;
  events: EventBus;
  logger: Logger;
}

function imagePrompt(text: string, attachments: MediaRef[]): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  if (attachments.some((attachment) => attachment.kind === "image")) {
    return "Analiza la imagen adjunta y responde.";
  }
  if (attachments.some((attachment) => attachment.kind === "audio")) {
    return "Analiza el audio adjunto y responde.";
  }
  return "";
}

async function storeIncomingMedia(
  deps: { media: MediaStorePort; egress: IntegrationEgressPort; logger: Logger; metrics?: Metrics },
  integration: IntegrationRecord,
  message: IncomingIntegrationMessage,
  scope: MediaScope,
  projectSlug?: string,
): Promise<MediaRef[] | undefined> {
  const incoming = message.attachments ?? [];
  if (incoming.length === 0) return [];
  if (incoming.length > 5) {
    await deps.egress
      .send(integration.id, "Puedo procesar hasta 5 archivos por mensaje.", message.senderId)
      .catch(() => undefined);
    deps.metrics?.increment("channel_media_rejected");
    deps.logger.warn({
      event: "channel_media_rejected",
      entryPoint: ENTRY_POINTS[message.kind],
      integrationId: integration.id,
      reason: "too_many_attachments",
    });
    return undefined;
  }
  try {
    const refs: MediaRef[] = [];
    for (const attachment of incoming) {
      const ref = await deps.media.save({
        scope,
        projectSlug,
        filename: attachment.filename,
        mime: attachment.mime,
        bytes: attachment.bytes,
        durationSeconds: attachment.durationSeconds,
      });
      refs.push(ref);
      deps.metrics?.increment("channel_media_captured");
      deps.logger.info({
        event: "channel_media_captured",
        entryPoint: ENTRY_POINTS[message.kind],
        integrationId: integration.id,
        kind: ref.kind,
        size: ref.size,
        durationSeconds: ref.durationSeconds,
      });
    }
    return refs;
  } catch (error) {
    const code = error instanceof MediaStoreError ? error.code : "UNSUPPORTED_TYPE";
    const text =
      code === "TOO_LARGE"
        ? "El archivo supera el límite permitido (20 MB o 5 minutos de audio)."
        : code === "UNSUPPORTED_TYPE"
          ? "Formato no soportado. Envía una imagen JPEG/PNG/WebP/GIF o un audio OGG/MP3/M4A/WAV/WebM/FLAC."
          : "No pude procesar el archivo.";
    await deps.egress.send(integration.id, text, message.senderId).catch(() => undefined);
    deps.metrics?.increment("channel_media_rejected");
    deps.logger.warn({
      event: "channel_media_rejected",
      entryPoint: ENTRY_POINTS[message.kind],
      integrationId: integration.id,
      reason: code,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
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
    const kinds = new Set<string>();
    if (message.text.trim()) kinds.add("text");
    for (const attachment of message.attachments ?? []) kinds.add(attachment.kind);
    const event = message.event ?? "message.received";
    const triggers = graph
      ? graph.nodes
          .filter((node) => node.type === "trigger" && node.config.kind === "integration")
          .filter((node) => node.config.integrationId === integration.id)
          .filter(() => integration.capabilities.includes("inbound_message"))
          .filter(() => integrationEvents(integration.kind).includes(event))
          .filter((node) => String(node.config.event ?? "message.received") === event)
          .filter((node) => {
            const accepts = Array.isArray(node.config.accepts) ? node.config.accepts : ["text"];
            return accepts.some((kind) => kinds.has(String(kind)));
          })
          .map<TriggerRef>((node) => ({
            projectSlug: integration.projectSlug!,
            workflowId: graph.id,
            nodeId: node.id,
            integrationId: integration.id,
            event: String(node.config.event ?? "message.received"),
          }))
      : [];
    const routing = ChannelRoutingSchema.parse(integration.config.routing ?? {});
    let allowlist: string[];
    try {
      allowlist = resolveDestinationList(this.deps.store, integration.projectSlug, routing.allowlist);
    } catch {
      this.logDrop(message, "invalid_destination_reference");
      return { decision: "dropped" };
    }
    const decision = routeProjectMessage({
      senderId: message.senderId,
      text: message.text,
      mode: routing.mode,
      allowlist,
      publicTriggers: routing.public,
      triggers,
    });

    if (decision.type === "agent") {
      const attachments = await storeIncomingMedia(
        this.deps,
        integration,
        message,
        "project",
        integration.projectSlug,
      );
      if (!attachments) return { decision: "dropped" };
      await this.handleAgent(
        integration,
        project.primaryAgent,
        project.defaultModel,
        project.transcriptionIntegrationId,
        project.speechIntegrationId,
        routing.voiceReplies === "auto" && attachments.some((attachment) => attachment.kind === "audio"),
        message,
        attachments,
      );
      return { decision: "agent" };
    }
    if (decision.type === "workflow") {
      const triggerNode = graph?.nodes.find((node) => node.id === decision.trigger.nodeId);
      const accepts = Array.isArray(triggerNode?.config.accepts) ? triggerNode.config.accepts : ["text"];
      const acceptedMessage = {
        ...message,
        attachments: (message.attachments ?? []).filter((attachment) => accepts.includes(attachment.kind)),
      };
      const attachments = await storeIncomingMedia(
        this.deps,
        integration,
        acceptedMessage,
        "project",
        integration.projectSlug,
      );
      if (!attachments) return { decision: "dropped" };
      await this.handleWorkflow(integration, decision.trigger, acceptedMessage, attachments);
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
    transcriptionIntegrationId: string | undefined,
    speechIntegrationId: string | undefined,
    voiceReply: boolean,
    message: IncomingIntegrationMessage,
    attachments: MediaRef[],
  ): Promise<void> {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "project",
      projectSlug: integration.projectSlug,
      integrationId: integration.id,
      externalThreadId: message.senderId,
      title: `${integration.name} · ${message.senderId}`,
    });
    const directory = await this.deps.workspace.projectDirectory(integration.projectSlug!);
    let text = message.text.trim();
    const audio = attachments.filter((attachment) => attachment.kind === "audio");
    if (audio.length > 0) {
      if (!this.deps.transcription) {
        await this.deps.egress.send(
          integration.id,
          "La transcripción de audio no está configurada en este servidor.",
          message.senderId,
        );
        this.deps.logger.warn({
          event: "channel_transcription_unavailable",
          entryPoint: ENTRY_POINTS[message.kind],
          integrationId: integration.id,
          reason: "provider_missing",
        });
        return;
      }
      if (!transcriptionIntegrationId) {
        await this.deps.egress.send(
          integration.id,
          "El proyecto no tiene una conexión de transcripción por defecto. Configúrala en Ajustes.",
          message.senderId,
        );
        this.deps.logger.warn({
          event: "channel_transcription_unavailable",
          entryPoint: ENTRY_POINTS[message.kind],
          integrationId: integration.id,
          reason: "project_default_missing",
        });
        return;
      }
      const transcriptionStarted = Date.now();
      this.deps.metrics?.increment("transcription_requests");
      try {
        const parts: string[] = [];
        for (const item of audio) {
          const media = await readMedia(directory, item);
          const result = await this.deps.transcription.transcribe({
            integrationId: transcriptionIntegrationId,
            scope: "project",
            projectSlug: integration.projectSlug,
            bytes: media.bytes,
            filename: media.filename,
            mime: item.mime,
            timeoutMs: 120_000,
          });
          if (result.text.trim()) parts.push(result.text.trim());
        }
        const transcript = parts.join("\n\n");
        if (!transcript) throw new Error("empty transcript");
        text = [text, `Transcripción de audio:\n${transcript}`].filter(Boolean).join("\n\n");
        this.deps.metrics?.increment("transcription_succeeded");
        this.deps.logger.info({
          event: "transcription_completed",
          entryPoint: ENTRY_POINTS[message.kind],
          integrationId: integration.id,
          durationMs: Date.now() - transcriptionStarted,
          audioCount: audio.length,
        });
      } catch (error) {
        this.deps.metrics?.increment("transcription_failed");
        this.deps.logger.error({
          event: "channel_transcription_failed",
          entryPoint: ENTRY_POINTS[message.kind],
          integrationId: integration.id,
          durationMs: Date.now() - transcriptionStarted,
          error: error instanceof Error ? error.message : String(error),
        });
        await this.deps.egress.send(
          integration.id,
          "No pude transcribir el audio. Intenta de nuevo o envía un texto.",
          message.senderId,
        );
        return;
      }
    }
    const prompt = text || imagePrompt("", attachments);
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
        message: prompt,
        attachments,
        idempotencyKey: message.externalMessageId ? `${integration.id}:${message.externalMessageId}` : undefined,
      });
      void this.deliverTurn(integration.id, message.senderId, turn.id, { voiceReply, speechIntegrationId });
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
      prompt,
      sessionFactory,
      undefined,
      toAttachmentFiles(directory, attachments),
    );
    this.deps.store.chatThreads.touch(thread.id);
    await this.sendReply(integration, message.senderId, result.reply || "(sin respuesta)", {
      voiceReply,
      speechIntegrationId,
    });
  }

  private async sendReply(
    integration: IntegrationRecord,
    recipient: string,
    reply: string,
    options: { voiceReply?: boolean; speechIntegrationId?: string },
  ): Promise<void> {
    const fallback = (reason: string, error?: unknown) => {
      this.deps.metrics?.increment("voice_reply_fallback");
      this.deps.logger.warn({
        event: "voice_reply_fallback",
        projectSlug: integration.projectSlug,
        integrationId: integration.id,
        reason,
        ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
      });
    };
    if (options.voiceReply) {
      if (!integration.projectSlug) fallback("missing_project");
      else if (!options.speechIntegrationId) fallback("missing_speech");
      else if (!this.deps.speech) fallback("missing_speech");
      else if (!this.deps.egress.sendMedia) fallback("media_unsupported");
      else if (reply.length > SPEECH_MAX_CHARS) fallback("text_too_long");
      else {
        try {
          const speech = await this.deps.speech.synthesize({
            integrationId: options.speechIntegrationId,
            scope: "project",
            projectSlug: integration.projectSlug,
            text: reply,
            timeoutMs: 120_000,
          });
          const extension = speech.mime === "audio/wav" ? "wav" : speech.mime === "audio/flac" ? "flac" : "mp3";
          await this.deps.egress.sendMedia(
            integration.id,
            { bytes: speech.bytes, filename: `reply.${extension}`, mime: speech.mime, caption: reply },
            recipient,
          );
          this.deps.metrics?.increment("voice_reply_sent");
          return;
        } catch (error) {
          fallback("synthesis_failed", error);
        }
      }
    }
    await this.deps.egress.send(integration.id, reply, recipient);
  }

  private async deliverTurn(
    integrationId: string,
    recipient: string,
    turnId: string,
    options: { voiceReply?: boolean; speechIntegrationId?: string } = {},
  ): Promise<void> {
    await deliverChatTurn(this.deps, integrationId, recipient, turnId, options);
  }

  private async handleWorkflow(
    integration: IntegrationRecord,
    trigger: TriggerRef,
    message: IncomingIntegrationMessage,
    attachments: MediaRef[],
  ): Promise<void> {
    const graph = await this.deps.workspace.readWorkflow(trigger.projectSlug);
    await validateWorkflowResources(this.deps.store, this.deps.workspace, trigger.projectSlug, graph, {
      requireConnected: true,
    });
    const run = await this.deps.executor.execute({
      projectSlug: trigger.projectSlug,
      graph,
      payload: {
        message: message.text,
        senderId: message.senderId,
        integrationId: integration.id,
        attachments,
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
    const attachments = await storeIncomingMedia(this.deps, integration, message, "global");
    if (!attachments) return { decision: "dropped" };
    if (attachments.some((attachment) => attachment.kind === "audio")) {
      await this.deps.egress.send(
        integration.id,
        "El orquestador global todavía no procesa audio. Envía un texto o una imagen.",
        message.senderId,
      );
      this.deps.logger.warn({
        event: "global_transcription_unsupported",
        entryPoint: "global_orchestrator",
        integrationId: integration.id,
      });
      return { decision: "dropped" };
    }
    const prompt = imagePrompt(message.text, attachments);
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
        message: prompt,
        attachments,
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
      prompt,
      sessionFactory,
      undefined,
      toAttachmentFiles(this.deps.controlDirectory, attachments),
    );
    this.deps.store.chatThreads.touch(thread.id);
    await this.deps.egress.send(integration.id, result.reply || "(sin respuesta)", message.senderId);
    return { decision: "orchestrator" };
  }
}
