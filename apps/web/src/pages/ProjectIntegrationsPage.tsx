import { PageHeader } from "../components/PageHeader.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { NodeIcon } from "../components/nodes/node-icons.tsx";
import { ProjectSectionBody } from "./project-workspace.tsx";

export function ProjectIntegrationsPage() {
  return (
    <ProjectSectionBody>
      <PageHeader
        title="Integraciones"
        description="Conexiones, canales y destinos del proyecto, agrupados por tipo y estado."
      />
      <EmptyState
        icon={<NodeIcon type="http" />}
        title="Las integraciones aparecerán aquí"
        description="Cada integración del proyecto se administrará en esta sección, con su estado y sus acciones."
      />
    </ProjectSectionBody>
  );
}
