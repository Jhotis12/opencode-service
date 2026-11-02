import type { ChatProgressEvent, WorkflowGraph } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { EventBus } from "../ports/events.ts";
import type { ChatMessageRecord, ProjectRecord } from "../../domain/entities.ts";
import { validateWorkflowResources } from "./workflow-resources.ts";
import { ensureChatSession, promptWithSessionRecovery } from "./chat-session.ts";
import { createChatProgressHandler } from "./chat-progress.ts";
import type { Logger } from "../../domain/telemetry/index.ts";

export class CreateProjectUseCase {
  constructor(
    private readonly store: Store,
    private readonly workspace: WorkspacePort,
    private readonly events: EventBus,
  ) {}

  async execute(input: { slug: string; name: string; description?: string }): Promise<{ project: ProjectRecord; graph: WorkflowGraph }> {
    if (this.store.projects.findBySlug(input.slug)) throw new Error(`project already exists: ${input.slug}`);
    await this.workspace.createProject(input);
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? "",
      primaryAgent: "principal/agente",
      createdAt: now,
      updatedAt: now,
    };
    this.store.projects.create(project);
    const graph = await this.workspace.readWorkflow(input.slug);
    this.events.publish({ type: "workflow.updated", projectSlug: input.slug, graph });
    return { project, graph };
  }
}

export class DeleteProjectUseCase {
  constructor(
    private readonly store: Store,
    private readonly workspace: WorkspacePort,
    private readonly events: EventBus,
  ) {}

  async execute(slug: string): Promise<void> {
    if (!this.store.projects.findBySlug(slug)) throw new Error(`project not found: ${slug}`);
    await this.workspace.removeProject(slug);
    this.store.deleteProjectData(slug);
    this.events.publish({ type: "project.deleted", projectSlug: slug });
  }
}

export class SaveWorkflowUseCase {
  constructor(
    private readonly store: Store,
    private readonly workspace: WorkspacePort,
    private readonly events: EventBus,
  ) {}

  async execute(slug: string, graph: WorkflowGraph): Promise<WorkflowGraph> {
    await validateWorkflowResources(this.store, this.workspace, slug, graph);
    await this.workspace.writeWorkflow(slug, graph);
    const saved = await this.workspace.readWorkflow(slug);
    this.events.publish({ type: "workflow.updated", projectSlug: slug, graph: saved });
    return saved;
  }
}

const DEFAULT_CHAT_TIMEOUT_MS = 900_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`the agent did not respond within ${Math.round(timeoutMs / 1000)}s`)), timeoutMs),
    ),
  ]);
}

export class ChatWithProjectUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      workspace: WorkspacePort;
      agent: AgentRuntimePort;
      events: EventBus;
      defaultModel?: () => string | undefined;
      timeoutMs?: number;
      logger?: Logger;
    },
  ) {}

  history(slug: string, limit = 200): ChatMessageRecord[] {
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "project",
      projectSlug: slug,
      externalThreadId: "web",
      title: `Chat · ${slug}`,
    });
    return this.deps.store.chat.listByThread(thread.id, limit);
  }

  async execute(
    slug: string,
    message: string,
    onProgress?: (event: ChatProgressEvent) => void,
  ): Promise<{ reply: string; sessionId: string; threadId: string }> {
    const project = this.deps.store.projects.findBySlug(slug);
    if (!project) throw new Error(`project not found: ${slug}`);
    const directory = await this.deps.workspace.projectDirectory(slug);
    const thread = this.deps.store.chatThreads.findOrCreate({
      scope: "project",
      projectSlug: slug,
      externalThreadId: "web",
      title: `Chat · ${project.name}`,
    });
    const create = () =>
      this.deps.agent.createSession({
        directory,
        title: `Chat · ${project.name}`,
        agent: project.primaryAgent,
        model: project.defaultModel ?? this.deps.defaultModel?.(),
      });
    const sessionFactory = { create, agentId: project.primaryAgent, logger: this.deps.logger };
    const sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);

    const now = new Date().toISOString();
    this.deps.store.chat.append({
      id: crypto.randomUUID(),
      threadId: thread.id,
      role: "user",
      content: message,
      createdAt: now,
    });

    try {
      const result = await withTimeout(
        promptWithSessionRecovery(
          this.deps.store,
          this.deps.agent,
          thread,
          sessionId,
          message,
          sessionFactory,
          onProgress ? createChatProgressHandler(onProgress) : undefined,
        ),
        this.deps.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS,
      );
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
}

export async function syncProjectsFromDisk(store: Store, workspace: WorkspacePort): Promise<void> {
  for (const slug of await workspace.listProjects()) {
    if (store.projects.findBySlug(slug)) continue;
    const now = new Date().toISOString();
    store.projects.create({
      id: crypto.randomUUID(),
      slug,
      name: slug,
      description: "",
      primaryAgent: "principal/agente",
      createdAt: now,
      updatedAt: now,
    });
  }
}
