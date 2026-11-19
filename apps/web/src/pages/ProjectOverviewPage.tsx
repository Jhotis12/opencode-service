import { PageHeader } from "../components/PageHeader.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { NodeIcon } from "../components/nodes/node-icons.tsx";
import { ProjectSectionBody } from "./project-workspace.tsx";

export function ProjectOverviewPage() {
  return (
    <ProjectSectionBody>
      <PageHeader
        title="Resumen"
        description="Estado de la preparación, últimas ejecuciones y acciones rápidas del proyecto."
      />
      <EmptyState
        icon={<NodeIcon type="trigger" />}
        title="Todavía no hay resumen"
        description="Aquí verás la preparación del proyecto, las últimas ejecuciones y las acciones frecuentes para operarlo."
      />
    </ProjectSectionBody>
  );
}
