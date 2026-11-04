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
      approvalIntegrationId?: string | null;
      approvalRecipient?: string | null;
      transcriptionIntegrationId?: string | null;
    },
  ): ProjectRecord {
    if (!this.store.projects.findBySlug(slug)) throw new Error(`project not found: ${slug}`);
    if (patch.approvalIntegrationId) {
      const integration = this.store.integrations.findById(patch.approvalIntegrationId);
      if (!integration || integration.scope !== "project" || integration.projectSlug !== slug) {
        throw new Error("approval integration must belong to the project");
      }
    }
    if (patch.transcriptionIntegrationId) {
      const integration = this.store.integrations.findById(patch.transcriptionIntegrationId);
      if (
        !integration ||
        integration.scope !== "project" ||
        integration.projectSlug !== slug ||
        integration.kind !== "transcription" ||
        !integration.capabilities.includes("transcribe_audio")
      ) {
        throw new Error("transcription integration must be a transcription integration of the project");
      }
    }
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
  const hasApproval = graph?.nodes.some((node) => node.type === "approval") ?? false;
  const approvalReady = !hasApproval || Boolean(project.approvalIntegrationId) || integrationTriggers.length > 0;
  const transcribeNodes = (graph?.nodes ?? []).filter((node) => node.type === "transcribe");
  const transcribeNeedsDefault = transcribeNodes.some(
    (node) => typeof node.config.integrationId !== "string" || !node.config.integrationId,
  );
  const transcriptionReady = !transcribeNeedsDefault || Boolean(project.transcriptionIntegrationId);
  const items: ProjectReadinessItem[] = [
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
      id: "approval-channel",
      label: "Canal de aprobación configurado",
      ready: approvalReady,
      detail: approvalReady
        ? undefined
        : "El flujo tiene aprobaciones y no hay un canal de origen ni un canal de aprobación del proyecto.",
    },
    {
      id: "knowledge",
      label: "Conocimiento del proyecto",
      ready: true,
      detail: "Los notebooks son opcionales; se pueden agregar cuando el flujo los use.",
    },
  ];
  if (transcribeNeedsDefault) {
    items.push({
      id: "transcription",
      label: "Conexión de transcripción configurada",
      ready: transcriptionReady,
      detail: transcriptionReady
        ? undefined
        : "El flujo tiene un nodo Transcribir sin conexión propia; define una conexión de transcripción por defecto.",
    });
  }
  return items;
}
