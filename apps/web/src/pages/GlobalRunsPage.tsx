import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RunRecord } from "../api.ts";
import { qk } from "../query.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { Field } from "../components/Field.tsx";
import { RunsNavIcon } from "../components/Layout.tsx";
import { Modal } from "../components/Modal.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { RunDetailModal } from "../components/RunDetailModal.tsx";
import {
  RUN_STATUS_OPTIONS,
  RunsTable,
  downloadRunsExport,
  groupRunsByParent,
} from "../components/RunsTable.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { button, buttonGhost, card, friendlyError, input, statusLabel } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 200;
const GLOBAL_RUNS_KEY = "global-runs";
const GLOBAL_RUN_KEY = "global-run";

type ExportFeedback = { readonly exported: number; readonly total: number };

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim() ?? "";
}

export function GlobalRunsPage() {
  useDocumentTitle("Ejecuciones");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const status = readParam(searchParams, "status");
  const project = readParam(searchParams, "project");
  const from = readParam(searchParams, "from");
  const to = readParam(searchParams, "to");
  const runId = readParam(searchParams, "run");
  const page = Math.max(1, Math.floor(Number(searchParams.get("page") ?? "1")) || 1);
  const filtersActive = Boolean(status || project || from || to);
  const offset = (page - 1) * PAGE_SIZE;

  const filters = useMemo(
    () => ({
      status: status || undefined,
      project: project || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [status, project, from, to],
  );

  const runsQuery = useQuery({
    queryKey: [GLOBAL_RUNS_KEY, { ...filters, offset }],
    queryFn: () => api.listGlobalRuns({ ...filters, limit: PAGE_SIZE, offset }),
  });

  const projectsQuery = useQuery({
    queryKey: qk.projects,
    queryFn: () => api.listProjects().then((result) => result.data),
    staleTime: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: [GLOBAL_RUN_KEY, runId],
    queryFn: () => api.getGlobalRun(runId),
    enabled: Boolean(runId),
  });

  const [exporting, setExporting] = useState<"json" | "csv" | undefined>();
  const [exportError, setExportError] = useState<string | undefined>();
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback | undefined>();

  const replay = useMutation({
    mutationFn: (input: { id: string; fromNodeId?: string }) => api.replayRun(input.id, input.fromNodeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GLOBAL_RUNS_KEY] });
    },
  });

  const total = runsQuery.data?.total ?? 0;
  const rows = useMemo(() => groupRunsByParent(runsQuery.data?.data ?? []), [runsQuery.data]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : offset + 1;
  const last = offset + (runsQuery.data?.data.length ?? 0);
  const projectSlugs = projectsQuery.data?.map((item) => item.slug) ?? [];
  const rowRun = runsQuery.data?.data.find((run) => run.id === runId);
  const detailRun = detailQuery.data ?? rowRun;

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  function setFilter(key: "status" | "project" | "from" | "to", value: string) {
    updateParams({ [key]: value || undefined, page: undefined });
  }

  function clearFilters() {
    updateParams({ status: undefined, project: undefined, from: undefined, to: undefined, page: undefined });
  }

  function goToPage(next: number) {
    updateParams({ page: next === 1 ? undefined : String(next) });
  }

  function closeDetail() {
    replay.reset();
    updateParams({ run: undefined });
  }

  async function exportRuns(format: "json" | "csv") {
    setExporting(format);
    setExportError(undefined);
    setExportFeedback(undefined);
    try {
      const result = await api.listGlobalRuns({ ...filters, limit: EXPORT_LIMIT, offset: 0 });
      downloadRunsExport(format, result.data, "ejecuciones-globales");
      if (result.total > result.data.length) {
        setExportFeedback({ exported: result.data.length, total: result.total });
      }
    } catch (error) {
      setExportError(friendlyError(error, "No se pudieron exportar las ejecuciones."));
    } finally {
      setExporting(undefined);
    }
  }

  const countLabel = runsQuery.isLoading
    ? "Cargando ejecuciones…"
    : total === 0
      ? "0 ejecuciones"
      : `Mostrando ${first}–${last} de ${total} ejecuciones`;

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        title="Ejecuciones"
        description="Histórico global de las ejecuciones de todos los proyectos, con filtros por estado, proyecto y fecha, detalle paso a paso y exportación en JSON/CSV."
      />

      <search className={card} aria-label="Filtros de ejecuciones">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field id="global-runs-status" label="Estado">
            <select
              className={input}
              value={status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">Todos</option>
              {RUN_STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="global-runs-project" label="Proyecto" hint="Slug exacto del proyecto.">
            <input
              className={input}
              list="global-runs-project-options"
              value={project}
              placeholder="Todos los proyectos"
              onChange={(event) => setFilter("project", event.target.value)}
            />
          </Field>
          <Field id="global-runs-from" label="Desde" hint="Día de inicio en UTC (inclusivo).">
            <input
              type="date"
              className={input}
              value={from}
              onChange={(event) => setFilter("from", event.target.value)}
            />
          </Field>
          <Field id="global-runs-to" label="Hasta" hint="Día de inicio en UTC (inclusivo).">
            <input
              type="date"
              className={input}
              value={to}
              onChange={(event) => setFilter("to", event.target.value)}
            />
          </Field>
        </div>
        <datalist id="global-runs-project-options">
          {projectSlugs.map((slug) => (
            <option key={slug} value={slug} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted" data-testid="global-runs-count" aria-live="polite">
            {countLabel}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonGhost}
              disabled={!filtersActive}
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={runsQuery.isFetching}
              onClick={() => void runsQuery.refetch()}
            >
              Actualizar
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={total === 0 || exporting !== undefined}
              onClick={() => void exportRuns("json")}
            >
              Exportar JSON
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={total === 0 || exporting !== undefined}
              onClick={() => void exportRuns("csv")}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {exportFeedback && (
          <p className="text-xs text-warn" data-testid="global-runs-export-note">
            La exportación se limitó a {exportFeedback.exported} de {exportFeedback.total} ejecuciones (máximo{" "}
            {EXPORT_LIMIT}). Ajusta los filtros para exportar el resto.
          </p>
        )}
        {exportError && (
          <p className="text-xs text-danger" role="alert">
            {exportError}
          </p>
        )}
      </search>

      {runsQuery.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando ejecuciones">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} shape="block" size="sm" />
          ))}
        </div>
      ) : runsQuery.isError ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-danger">
            {friendlyError(runsQuery.error, "No se pudieron cargar las ejecuciones.")}
          </p>
          <button type="button" className={button} onClick={() => void runsQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : rows.length === 0 && total > 0 ? (
        <EmptyState
          icon={<RunsNavIcon />}
          title="Página fuera de rango"
          description="La página solicitada ya no existe para estos filtros. Vuelve a la primera página para seguir revisando ejecuciones."
          action={
            <button type="button" className={buttonGhost} onClick={() => goToPage(1)}>
              Ir a la primera página
            </button>
          }
        />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={<RunsNavIcon />}
            title="Ninguna ejecución coincide"
            description="Ninguna ejecución cumple los filtros actuales. Ajusta o limpia los filtros para ver más ejecuciones."
            action={
              <button type="button" className={buttonGhost} onClick={clearFilters}>
                Limpiar filtros
              </button>
            }
          />
        ) : (
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
        )
      ) : (
        <>
          <RunsTable
            rows={rows}
            caption="Ejecuciones de todos los proyectos"
            onOpenDetail={(run: RunRecord) => updateParams({ run: run.id })}
          />
          {totalPages > 1 && (
            <nav
              className="flex flex-wrap items-center justify-between gap-2"
              aria-label="Paginación de ejecuciones"
            >
              <p className="text-xs text-muted tabular-nums" data-testid="global-runs-page">
                Página {page} de {totalPages}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonGhost}
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={buttonGhost}
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {runId && detailRun && (
        <RunDetailModal
          run={detailRun}
          onClose={closeDetail}
          onReplay={(fromNodeId) => replay.mutate({ id: detailRun.id, fromNodeId })}
          notice={
            replay.isError ? (
              <p className="text-xs text-danger" role="alert">
                {friendlyError(replay.error, "No se pudo re-ejecutar la ejecución.")}
              </p>
            ) : undefined
          }
        />
      )}

      {runId && !detailRun && (
        <Modal title="Ejecución" onClose={closeDetail} size="lg">
          {detailQuery.isError ? (
            <>
              <p className="text-sm text-danger" role="alert">
                {friendlyError(detailQuery.error, "No se pudo cargar el detalle de la ejecución.")}
              </p>
              <button type="button" className={button} onClick={() => void detailQuery.refetch()}>
                Reintentar
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando ejecución">
              <Skeleton shape="line" />
              <Skeleton shape="block" />
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
