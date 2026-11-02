import type { WorkflowGraph } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { EventBus } from "../ports/events.ts";
import type { ChatMessageRecord, ProjectRecord } from "../../domain/entities.ts";

export class CreateProjectUseCase {
  constructor(
    private readonly store: Store,
    private readonly workspace: WorkspacePort,
    private readonly events: EventBus,
  ) {}

  async execute(input: { slug: string; name: string; description?: string }): Promise<{ project: ProjectRecord; graph: WorkflowGraph }> {
    if (this.store.projects.findBySlug(input.slug)) throw new Error(`project already exists: ${input.slug}`);
    await this.workspace.createProject(input);
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? "",
      createdAt: new Date().toISOString(),
    };
    this.store.projects.create(project);
    const graph = await this.workspace.readWorkflow(input.slug);
    this.events.publish({ type: "workflow.updated", projectSlug: input.slug, graph });
    return { project, graph };
  }
}

export class SaveWorkflowUseCase {
  constructor(
    private readonly workspace: WorkspacePort,
    private readonly events: EventBus,
  ) {}

  async execute(slug: string, graph: WorkflowGraph): Promise<WorkflowGraph> {
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
    },
  ) {}

  history(slug: string, limit = 200): ChatMessageRecord[] {
    return this.deps.store.chat.list(slug, limit);
  }

  async execute(slug: string, message: string): Promise<{ reply: string; sessionId: string }> {
    const project = this.deps.store.projects.findBySlug(slug);
    if (!project) throw new Error(`project not found: ${slug}`);
    const directory = await this.deps.workspace.projectDirectory(slug);
    let sessionId = project.chatSessionId;
    if (!sessionId) {
      const session = await this.deps.agent.createSession({
        directory,
        title: `Chat · ${project.name}`,
        model: this.deps.defaultModel?.(),
      });
      sessionId = session.id;
      this.deps.store.projects.setChatSession(slug, sessionId);
    }

    const now = new Date().toISOString();
    this.deps.store.chat.append({
      id: crypto.randomUUID(),
      projectSlug: slug,
      sessionId,
      role: "user",
      content: message,
      createdAt: now,
    });

    try {
      const reply = await withTimeout(
        this.deps.agent.prompt(sessionId, message),
        this.deps.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS,
      );
      this.deps.store.chat.append({
        id: crypto.randomUUID(),
        projectSlug: slug,
        sessionId,
        role: "agent",
        content: reply,
        createdAt: new Date().toISOString(),
      });
      return { reply, sessionId };
    } catch (error) {
      this.deps.store.chat.append({
        id: crypto.randomUUID(),
        projectSlug: slug,
        sessionId,
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
    store.projects.create({
      id: crypto.randomUUID(),
      slug,
      name: slug,
      description: "",
      createdAt: new Date().toISOString(),
    });
  }
}
