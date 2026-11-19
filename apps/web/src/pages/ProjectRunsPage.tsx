import { StatusBadge } from "../components/StatusBadge.tsx";
import { previewValue } from "../components/RunDetailModal.tsx";
import { buttonGhost, card } from "../ui.ts";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectRunsPage() {
  const workspace = useProjectWorkspace();

  return (
    <ProjectSectionBody>
      <div className="flex flex-col gap-3">
        {workspace.runs.length === 0 && <p className="text-sm text-muted">Sin ejecuciones todavía.</p>}
        {workspace.runs.map((run) => (
          <article className={`${card} gap-2`} key={run.id}>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <strong className="text-sm">{run.id.slice(0, 8)}</strong>
              <StatusBadge status={run.status} />
            </header>
            <small className="text-xs text-muted">
              {new Date(run.startedAt).toLocaleString()} · {run.launchedBy ?? "sistema"} · {run.sourceDetail ?? run.entryPoint}
            </small>
            {run.error && <p className="text-sm text-danger">{run.error}</p>}
            {run.output !== undefined && <p className="text-xs text-muted">Resultado: {previewValue(run.output)}</p>}
            <div className="flex flex-wrap gap-1.5">
              <button className={buttonGhost} onClick={() => workspace.setDetailRun(run)}>
                Ver detalle
              </button>
              <button className={buttonGhost} onClick={() => workspace.replayRun(run.id)}>
                Re-ejecutar
              </button>
            </div>
          </article>
        ))}
      </div>
    </ProjectSectionBody>
  );
}
