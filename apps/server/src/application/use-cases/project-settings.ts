import type { WorkflowGraph } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { EventBus } from "../ports/events.ts";
import type { ProjectRecord } from "../../domain/entities.ts";

export interface ProjectReadinessItem {
  id: string;
  label: string;
  ready: boolean;
  detail?: string;
}

export interface ProjectSettingsView {
  project: ProjectRecord;
  integrations: ReturnType<Store["integrations"]["list"]>;
  notebooks: Array<ReturnType<Store["notebooks"]["list"]>[number] & { sources: number }>;
  readiness: ProjectReadinessItem[];
}

export class GetProjectSettingsUseCase {
  constructor(
    private readonly store: Store,
    private readonly workspace: WorkspacePort,
  ) {}

  async execute(slug: string): Promise<ProjectSettingsView> {
    const project = this.store.projects.findBySlug(slug);
    if (!project) throw new Error(`project not found: ${slug}`);
    const graph = await this.workspace.readWorkflow(slug).catch(() => undefined);
    const integrations = this.store.integrations.list({ scope: "project", projectSlug: slug });
    const notebooks = this.store.notebooks
      .list(slug)
      .map((notebook) => ({ ...notebook, sources: this.store.knowledge.listSources(notebook.id).length }));
    return {
      project,
      integrations,
      notebooks,
      readiness: readinessFor(project, graph, integrations),
    };
  }
}

export class UpdateProjectSettingsUseCase {
  constructor(
    private readonly store: Store,
    private readonly events: EventBus,
  ) {}

  execute(
    slug: string,
    patch: Partial<Pick<ProjectRecord, "name" | "description">> & {
      defaultModel?: string | null;
      primaryAgent?: string | null;
    },
  ): ProjectRecord {
    if (!this.store.projects.findBySlug(slug)) throw new Error(`project not found: ${slug}`);
    this.store.projects.update(slug, patch);
    const project = this.store.projects.findBySlug(slug)!;
    this.events.publish({ type: "agent.updated", projectSlug: slug, agentId: "project-settings" });
    return project;
  }
}

export function readinessFor(
  project: ProjectRecord,
  graph: WorkflowGraph | undefined,
  integrations: Array<{ id: string }>,
): ProjectReadinessItem[] {
  const trigger = graph?.nodes.find((node) => node.type === "trigger");
  const integrationTriggers = (graph?.nodes ?? []).filter(
    (node) => node.type === "trigger" && node.config.kind === "integration",
  );
  const available = new Set(integrations.map((integration) => integration.id));
  const missingIntegrations = integrationTriggers
    .map((node) => String(node.config.integrationId ?? ""))
    .filter((id) => !id || !available.has(id));
  return [
    {
      id: "primary-agent",
      label: "Agente principal configurado",
      ready: Boolean(project.primaryAgent),
      detail: project.primaryAgent ? undefined : "Define el agente principal del proyecto.",
    },
    {
      id: "trigger",
      label: "El flujo tiene un trigger",
      ready: Boolean(trigger),
      detail: trigger ? undefined : "Agrega un nodo trigger al canvas.",
    },
    {
      id: "integrations",
      label: "Las integraciones del flujo existen",
      ready: missingIntegrations.length === 0,
      detail: missingIntegrations.length === 0 ? undefined : "Hay triggers que apuntan a integraciones inexistentes.",
    },
    {
      id: "knowledge",
      label: "Conocimiento del proyecto",
      ready: true,
      detail: "Los notebooks son opcionales; se pueden agregar cuando el flujo los use.",
    },
  ];
}
