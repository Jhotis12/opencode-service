import { PageHeader } from "../components/PageHeader.tsx";
import { ProjectConfigurationPanel } from "../components/ProjectConfigurationPanel.tsx";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectSettingsPage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Ajustes"
        description="Identidad del proyecto, modelo por defecto, conexiones de transcripción y voz, y preparación para ejecutar el flujo."
      />
      <ProjectConfigurationPanel
        projectSlug={workspace.slug}
        navigationBlocked={workspace.dirty}
        onNavigateBlocked={(target) => workspace.requestNavigate(target)}
      />
    </ProjectSectionBody>
  );
}
