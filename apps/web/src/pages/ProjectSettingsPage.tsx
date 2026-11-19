import { ProjectConfigurationPanel } from "../components/ProjectConfigurationPanel.tsx";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectSettingsPage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
      <ProjectConfigurationPanel projectSlug={workspace.slug} />
    </ProjectSectionBody>
  );
}
