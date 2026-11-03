import type { ChatProgressEvent } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { ChatMessageRecord } from "../../domain/entities.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
import { createChatProgressHandler } from "./chat-progress.ts";
import { ensureChatSession, promptWithSessionRecovery } from "./chat-session.ts";

export interface OrchestratorOverview {
  projects: Array<{ slug: string; name: string; description: string; status: string }>;
  recentRuns: Array<{
    id: string;
    projectSlug: string;
    workflowId: string;
    status: string;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  }>;
  recentErrors: Array<{ id: string; message: string; entryPoint: string; createdAt: string }>;
  integrations: Array<{ id: string; scope: string; projectSlug?: string; kind: string; name: string; status: string }>;
}

const DEFAULT_TIMEOUT_MS = 900_000;
const ENTRY_POINT = "global_orchestrator";

export class OrchestratorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrchestratorConfigurationError";
  }
}

export class EmptyAgentReplyError extends Error {
  constructor(message = "the orchestrator returned an empty response") {
    super(message);
    this.name = "EmptyAgentReplyError";
  }
}

export function resolveOrchestratorModel(
  envValue: string | undefined,
  platformDefault: string | undefined,
): string | undefined {
  const fromEnv = envValue?.trim();
  if (fromEnv) return fromEnv;
  const fromPlatform = platformDefault?.trim();
  return fromPlatform || undefined;
}

export class ChatWithOrchestratorUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      agent: AgentRuntimePort;
      controlDirectory: string;
      orchestratorAgent: string;
      timeoutMs?: number;
      logger?: Logger;
      model?: () => string | undefined;
    },
  ) {}

  history(limit = 200): ChatMessageRecord[] {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "global",
      externalThreadId: "web",
      title: "Orquestador global",
    });
    return this.deps.store.chat
      .listByThread(thread.id, limit)
      .filter((message) => message.role !== "agent" || message.content.trim().length > 0);
  }

  async execute(
    message: string,
    onProgress?: (event: ChatProgressEvent) => void,
  ): Promise<{ reply: string; sessionId: string; threadId: string }> {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "global",
      externalThreadId: "web",
      title: "Orquestador global",
    });
    this.deps.store.chat.append({
      id: crypto.randomUUID(),
      threadId: thread.id,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    });

    let sessionId: string | undefined;
    try {
      const model = this.resolveModel();
      const create = () =>
        this.deps.agent.createSession({
          directory: this.deps.controlDirectory,
          title: "Orquestador global",
          agent: this.deps.orchestratorAgent,
          model,
        });
      const sessionFactory = {
        create,
        agentId: this.deps.orchestratorAgent,
        model,
        logger: this.deps.logger,
      };
      sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);
      const progress = onProgress ? createChatProgressHandler(onProgress) : undefined;
      const runPrompt = (activeSessionId: string) =>
        Promise.race([
          promptWithSessionRecovery(
            this.deps.store,
            this.deps.agent,
            thread,
            activeSessionId,
            message,
            sessionFactory,
            progress,
          ),
          new Promise<{ reply: string; sessionId: string }>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error("the orchestrator did not respond in time")),
              this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            ),
          ),
        ]);

      let result = await runPrompt(sessionId);
      sessionId = result.sessionId;
      if (!result.reply.trim()) {
        this.deps.logger?.warn(
          {
            event: "orchestrator_empty_reply",
            threadId: thread.id,
            sessionId: result.sessionId,
            attempt: 1,
            entryPoint: ENTRY_POINT,
          },
          "orchestrator returned an empty reply",
        );
        const replacement = await sessionFactory.create();
        this.deps.store.chatThreads.setSession(thread.id, replacement.id);
        this.deps.logger?.info(
          {
            event: "orchestrator_session_replaced",
            threadId: thread.id,
            previousSessionId: result.sessionId,
            sessionId: replacement.id,
            entryPoint: ENTRY_POINT,
          },
          "orchestrator session replaced after an empty reply",
        );
        result = await runPrompt(replacement.id);
        sessionId = result.sessionId;
        if (!result.reply.trim()) {
          this.deps.logger?.warn(
            {
              event: "orchestrator_empty_reply",
              threadId: thread.id,
              sessionId: result.sessionId,
              attempt: 2,
              entryPoint: ENTRY_POINT,
            },
            "orchestrator returned an empty reply",
          );
          throw new EmptyAgentReplyError();
        }
      }

      this.deps.store.chat.append({
        id: crypto.randomUUID(),
        threadId: thread.id,
        role: "agent",
        content: result.reply,
        createdAt: new Date().toISOString(),
      });
      this.deps.store.chatThreads.touch(thread.id);
      return { reply: result.reply, sessionId: result.sessionId, threadId: thread.id };
    } catch (error) {
      if (error instanceof OrchestratorConfigurationError) {
        this.deps.logger?.warn(
          { event: "orchestrator_model_missing", threadId: thread.id, entryPoint: ENTRY_POINT },
          "orchestrator model is not configured",
        );
      }
      this.deps.store.chat.append({
        id: crypto.randomUUID(),
        threadId: thread.id,
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        createdAt: new Date().toISOString(),
      });
      this.deps.logger?.error(
        {
          event: "orchestrator_turn_failed",
          threadId: thread.id,
          sessionId,
          entryPoint: ENTRY_POINT,
          error: error instanceof Error ? error.message : String(error),
        },
        "orchestrator turn failed",
      );
      throw error;
    }
  }

  private resolveModel(): string {
    const model = this.deps.model?.()?.trim();
    if (!model) {
      throw new OrchestratorConfigurationError(
        "orchestrator model is not configured; set ORCHESTRATOR_MODEL or the platform default model",
      );
    }
    return model;
  }

  overview(): OrchestratorOverview {
    const projects = this.deps.store.projects.list();
    return {
      projects: projects.map((project) => ({
        slug: project.slug,
        name: project.name,
        description: project.description,
        status: "active",
      })),
      recentRuns: this.deps.store.runs.listRecent(20).map((run) => ({
        id: run.id,
        projectSlug: run.projectSlug,
        workflowId: run.workflowId,
        status: run.status,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      })),
      recentErrors: this.deps.store.errors.recent(20).map((error) => ({
        id: error.id,
        message: error.message,
        entryPoint: error.entryPoint,
        createdAt: error.createdAt,
      })),
      integrations: this.deps.store.integrations.listAll().map((integration) => ({
        id: integration.id,
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        kind: integration.kind,
        name: integration.name,
        status: integration.status,
      })),
    };
  }
}
