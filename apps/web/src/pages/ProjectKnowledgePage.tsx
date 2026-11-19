import { PageHeader } from "../components/PageHeader.tsx";
import { ProjectKnowledgePanel } from "../components/ProjectKnowledgePanel.tsx";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectKnowledgePage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Conocimiento"
        description="Organiza el conocimiento del proyecto en notebooks: sube documentos o indexa URLs y consúltalos con búsqueda semántica citada desde los agentes y el flujo."
      />
      <ProjectKnowledgePanel projectSlug={workspace.slug} />
    </ProjectSectionBody>
  );
}
