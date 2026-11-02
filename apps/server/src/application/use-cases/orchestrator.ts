import type { Store } from "../ports/store.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { ChatMessageRecord } from "../../domain/entities.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
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

export class ChatWithOrchestratorUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      agent: AgentRuntimePort;
      controlDirectory: string;
      orchestratorAgent: string;
      timeoutMs?: number;
      logger?: Logger;
    },
  ) {}

  history(limit = 200): ChatMessageRecord[] {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "global",
      externalThreadId: "web",
      title: "Orquestador global",
    });
    return this.deps.store.chat.listByThread(thread.id, limit);
  }

  async execute(message: string): Promise<{ reply: string; sessionId: string; threadId: string }> {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "global",
      externalThreadId: "web",
      title: "Orquestador global",
    });
    const create = () =>
      this.deps.agent.createSession({
        directory: this.deps.controlDirectory,
        title: "Orquestador global",
        agent: this.deps.orchestratorAgent,
      });
    const sessionFactory = { create, agentId: this.deps.orchestratorAgent, logger: this.deps.logger };
    const sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);
    this.deps.store.chat.append({
      id: crypto.randomUUID(),
      threadId: thread.id,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    });
    try {
      const result = await Promise.race([
        promptWithSessionRecovery(
          this.deps.store,
          this.deps.agent,
          thread,
          sessionId,
          message,
          sessionFactory,
        ),
        new Promise<{ reply: string; sessionId: string }>((_resolve, reject) =>
          setTimeout(
            () => reject(new Error("the orchestrator did not respond in time")),
            this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          ),
        ),
      ]);
      const reply = result.reply;
      this.deps.store.chat.append({
        id: crypto.randomUUID(),
        threadId: thread.id,
        role: "agent",
        content: reply,
        createdAt: new Date().toISOString(),
      });
      this.deps.store.chatThreads.touch(thread.id);
      return { reply, sessionId: result.sessionId, threadId: thread.id };
    } catch (error) {
      this.deps.store.chat.append({
        id: crypto.randomUUID(),
        threadId: thread.id,
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        createdAt: new Date().toISOString(),
      });
      throw error;
    }
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
