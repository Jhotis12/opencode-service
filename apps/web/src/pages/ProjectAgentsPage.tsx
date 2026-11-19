import { AgentCatalog } from "../components/AgentCatalog.tsx";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectAgentsPage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
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
