import { ProjectKnowledgePanel } from "../components/ProjectKnowledgePanel.tsx";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectKnowledgePage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
      <ProjectKnowledgePanel projectSlug={workspace.slug} />
    </ProjectSectionBody>
  );
}
