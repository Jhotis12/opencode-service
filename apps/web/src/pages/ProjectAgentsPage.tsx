import { AgentCatalog } from "../components/AgentCatalog.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectAgentsPage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Agentes"
        description="El agente principal conversa con el proyecto; los sub-agentes se especializan por categoría y rol. Ajusta sus instrucciones, modelo y permisos por herramienta."
      />
      <AgentCatalog
        projectSlug={workspace.slug}
        agents={workspace.agents}
        modelOptions={workspace.modelOptions}
        isLoading={workspace.agentsLoading}
        error={workspace.agentsError}
      />
    </ProjectSectionBody>
  );
}
