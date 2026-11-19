import { Link } from "react-router-dom";
import { RunsNavIcon } from "../components/Layout.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { button } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

export function RunsPage() {
  useDocumentTitle("Ejecuciones");
  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        title="Ejecuciones"
        description="Histórico global de las ejecuciones de los flujos de todos los proyectos, con estado y recorrido de nodos."
      />
      <EmptyState
        icon={<RunsNavIcon />}
        title="Sin ejecuciones todavía"
        description="Lanza un flujo desde un proyecto y su ejecución aparecerá aquí con estado, duración y detalle paso a paso."
        action={
          <Link className={button} to="/projects">
            Ir a proyectos
          </Link>
        }
      />
    </section>
  );
}
