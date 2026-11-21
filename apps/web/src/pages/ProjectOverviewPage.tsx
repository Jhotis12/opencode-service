import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { NodeIcon } from "../components/nodes/node-icons.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { projectTabPath } from "../components/ProjectTopBar.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { qk } from "../query.ts";
import { button, buttonGhost, buttonPrimary, card, friendlyError, muted, sectionTitle, smallMuted } from "../ui.ts";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

const LAST_RUNS = 5;

function SourceError({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
      <p className="text-xs text-danger">{message}</p>
      <button type="button" className={buttonGhost} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

function CountCard({
  title,
  testId,
  value,
  hint,
  zeroHint,
  errorMessage,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  readonly title: string;
  readonly testId: string;
  readonly value: number | undefined;
  readonly hint: string;
  readonly zeroHint: string;
  readonly errorMessage: string;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly onRetry: () => void;
  readonly onOpen: () => void;
}) {
  return (
    <article className={`${card} gap-2`} data-testid={testId} aria-busy={loading}>
      <h3 className={sectionTitle}>{title}</h3>
      {loading ? (
        <Skeleton shape="line" size="lg" className="max-w-14" />
      ) : error ? (
        <SourceError message={friendlyError(error, errorMessage)} onRetry={onRetry} />
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums text-slate-100">{value ?? 0}</p>
          <p className={smallMuted}>{value === 0 ? zeroHint : hint}</p>
        </>
      )}
      <button type="button" className={`${buttonGhost} self-start`} onClick={onOpen}>
        Ver {title.toLowerCase()}
      </button>
    </article>
  );
}

export function ProjectOverviewPage() {
  const workspace = useProjectWorkspace();
  const slug = workspace.slug;

  // The workspace layout already owns the settings and runs queries; the overview
  // subscribes to the same cache entries (same keys, same fetchers) so each section can
  // show its own loading and error state without firing extra requests. Agents and
  // integrations are intentionally absent: their counts live in the section tabs.
  const settingsQuery = useQuery({
    queryKey: qk.projectSettings(slug),
    queryFn: () => api.getProjectSettings(slug),
    enabled: Boolean(slug),
  });
  const runsQuery = useQuery({
    queryKey: qk.runs(slug),
    queryFn: () => api.listRuns(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  // The only query the workspace context does not define: project notebooks.
  const notebooksQuery = useQuery({
    queryKey: qk.notebooks(slug),
    queryFn: () => api.listNotebooks(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });

  const readiness = settingsQuery.data?.readiness ?? [];
  const readyCount = readiness.filter((item) => item.ready).length;
  const hasGaps = readiness.some((item) => !item.ready);
  const lastRuns = [...(runsQuery.data ?? [])]
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, LAST_RUNS);

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Resumen"
        description="Estado de la preparación, últimas ejecuciones y acciones rápidas del proyecto."
        actions={
          <>
            <button
              type="button"
              className={buttonGhost}
              onClick={() => workspace.requestNavigate(projectTabPath(slug, "flow"))}
            >
              Abrir flujo
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                workspace.setChatOpen(true);
                workspace.setChatUnread(false);
              }}
            >
              Abrir chat
            </button>
            <button type="button" className={buttonPrimary} onClick={() => workspace.setLaunchOpen(true)}>
              Ejecutar flujo
            </button>
          </>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={card} data-testid="overview-readiness" aria-busy={settingsQuery.isLoading}>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={sectionTitle}>Preparación del proyecto</h2>
            <div className="flex flex-wrap items-center gap-2">
              {!settingsQuery.isLoading && !settingsQuery.isError && readiness.length > 0 && (
                <p className={smallMuted}>
                  {readyCount} de {readiness.length} listas
                </p>
              )}
              {!settingsQuery.isLoading && !settingsQuery.isError && hasGaps && (
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={() => workspace.requestNavigate(projectTabPath(slug, "settings"))}
                >
                  Revisar ajustes
                </button>
              )}
            </div>
          </header>
          {settingsQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton shape="line" size="md" />
              <Skeleton shape="line" size="md" />
              <Skeleton shape="line" size="md" />
              <Skeleton shape="line" size="md" />
            </div>
          ) : settingsQuery.isError ? (
            <SourceError
              message={friendlyError(settingsQuery.error, "No se pudo cargar la preparación del proyecto.")}
              onRetry={() => void settingsQuery.refetch()}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {readiness.map((item) => (
                <li key={item.id} className="flex items-start gap-3" title={item.ready ? "Listo" : "Pendiente"}>
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.ready ? "bg-ok" : "bg-warn"}`}
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm text-slate-200">
                      {item.label}
                      <span className="sr-only">{item.ready ? " (listo)" : " (pendiente)"}</span>
                    </p>
                    {item.detail && <small className={smallMuted}>{item.detail}</small>}
                  </div>
                </li>
              ))}
              {readiness.length === 0 && <li className={muted}>Sin verificaciones por ahora.</li>}
            </ul>
          )}
        </section>

        <CountCard
          title="Conocimiento"
          testId="overview-count-knowledge"
          value={notebooksQuery.data?.length}
          hint="Notebooks de conocimiento del proyecto."
          zeroHint="Sin notebooks todavía."
          errorMessage="No se pudo cargar el conocimiento."
          loading={notebooksQuery.isLoading}
          error={notebooksQuery.error}
          onRetry={() => void notebooksQuery.refetch()}
          onOpen={() => workspace.requestNavigate(projectTabPath(slug, "knowledge"))}
        />
      </div>

      <section className={card} data-testid="overview-runs" aria-busy={runsQuery.isLoading}>
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={sectionTitle}>Últimas ejecuciones</h2>
          <button
            type="button"
            className={buttonGhost}
            onClick={() => workspace.requestNavigate(projectTabPath(slug, "runs"))}
          >
            Ver todas
          </button>
        </header>
        {runsQuery.isLoading ? (
          <div className="flex flex-col divide-y divide-line">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex flex-col gap-1.5">
                  <Skeleton shape="line" size="sm" className="max-w-24" />
                  <Skeleton shape="line" size="sm" className="max-w-48" />
                </div>
                <Skeleton shape="line" size="sm" className="max-w-24" />
              </div>
            ))}
          </div>
        ) : runsQuery.isError ? (
          <SourceError
            message={friendlyError(runsQuery.error, "No se pudo cargar las ejecuciones.")}
            onRetry={() => void runsQuery.refetch()}
          />
        ) : lastRuns.length === 0 ? (
          <EmptyState
            icon={<NodeIcon type="trigger" />}
            title="Sin ejecuciones todavía"
            description="Cuando ejecutes el flujo, las últimas corridas aparecen aquí con su estado."
            action={
              <button type="button" className={buttonPrimary} onClick={() => workspace.setLaunchOpen(true)}>
                Ejecutar flujo
              </button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {lastRuns.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <strong className="text-sm">{run.id.slice(0, 8)}</strong>
                  <small className={smallMuted}>
                    {new Date(run.startedAt).toLocaleString()} · {run.launchedBy ?? "sistema"}
                  </small>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  <button type="button" className={buttonGhost} onClick={() => workspace.setDetailRun(run)}>
                    Ver detalle
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProjectSectionBody>
  );
}
