import { useMemo, useState } from "react";
import { RUNS_LIST_LIMIT, runOriginLabel, type RunRecord } from "../api.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { Field } from "../components/Field.tsx";
import { RunsNavIcon } from "../components/Layout.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { previewValue } from "../components/RunDetailModal.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { button, buttonGhost, card, input, statusLabel } from "../ui.ts";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

const RUN_STATUS_VALUES = [
  "queued",
  "running",
  "paused",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
] as const;

const RUN_ORIGIN_VALUES = [
  "web_ui",
  "global_orchestrator",
  "schedule",
  "scheduler",
  "webhook",
  "telegram",
  "whatsapp",
  "email",
  "external_chat",
  "replay",
  "bootstrap",
  "worker",
  "system",
] as const;

/** Campos exportables en JSON/CSV. Excluye entrada, salida, logs y errores. */
export const RUN_EXPORT_FIELDS = [
  "id",
  "projectSlug",
  "workflowId",
  "status",
  "entryPoint",
  "launchedBy",
  "startedAt",
  "finishedAt",
] as const;

export type ExportableRun = {
  id: string;
  projectSlug: string;
  workflowId: string;
  status: string;
  entryPoint: string;
  launchedBy?: string;
  startedAt: string;
  finishedAt?: string;
  steps: Array<{
    nodeId: string;
    status: string;
    durationMs: number;
    startedAt: string;
    finishedAt?: string;
  }>;
};

export type RunFilters = { status: string; origin: string; from: string; to: string };

function startedWithinDayRange(startedAt: string, fromDayInclusive: string, toDayInclusive: string): boolean {
  const day = startedAt.slice(0, 10);
  if (fromDayInclusive && day < fromDayInclusive) return false;
  if (toDayInclusive && day > toDayInclusive) return false;
  return true;
}

export function filterRuns(runs: RunRecord[], filters: RunFilters): RunRecord[] {
  return runs.filter((run) => {
    if (filters.status && run.status !== filters.status) return false;
    if (filters.origin && runOriginLabel(run.entryPoint) !== filters.origin) return false;
    if (!startedWithinDayRange(run.startedAt, filters.from, filters.to)) return false;
    return true;
  });
}

export function groupRunsByParent(runs: RunRecord[]): Array<{ run: RunRecord; child: boolean }> {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const childrenByParent = new Map<string, RunRecord[]>();
  const roots: RunRecord[] = [];
  for (const run of runs) {
    const parent = run.parentRunId !== undefined ? byId.get(run.parentRunId) : undefined;
    if (parent) {
      childrenByParent.set(parent.id, [...(childrenByParent.get(parent.id) ?? []), run]);
    } else {
      roots.push(run);
    }
  }
  const rows: Array<{ run: RunRecord; child: boolean }> = [];
  for (const root of roots) {
    rows.push({ run: root, child: false });
    for (const child of childrenByParent.get(root.id) ?? []) {
      rows.push({ run: child, child: true });
    }
  }
  return rows;
}

export function exportableRun(run: RunRecord): ExportableRun {
  return {
    id: run.id,
    projectSlug: run.projectSlug,
    workflowId: run.workflowId,
    status: run.status,
    entryPoint: run.entryPoint,
    launchedBy: run.launchedBy,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    steps: run.steps.map((step) => ({
      nodeId: step.nodeId,
      status: step.status,
      durationMs: step.durationMs,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
    })),
  };
}

export function runsToJson(runs: RunRecord[]): string {
  return JSON.stringify(runs.map(exportableRun), null, 2);
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function runsToCsv(runs: RunRecord[]): string {
  const lines = [[...RUN_EXPORT_FIELDS, "steps"].join(",")];
  for (const run of runs) {
    const exported = exportableRun(run);
    lines.push(
      [
        exported.id,
        exported.projectSlug,
        exported.workflowId,
        exported.status,
        exported.entryPoint,
        exported.launchedBy ?? "",
        exported.startedAt,
        exported.finishedAt ?? "",
        JSON.stringify(exported.steps),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function downloadFile(filename: string, content: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProjectRunsPage() {
  const workspace = useProjectWorkspace();
  const runs = workspace.runs;
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () => filterRuns(runs, { status: statusFilter, origin: originFilter, from, to }),
    [runs, statusFilter, originFilter, from, to],
  );
  const rows = useMemo(() => groupRunsByParent(filtered), [filtered]);
  const originOptions = useMemo(() => [...new Set(RUN_ORIGIN_VALUES.map(runOriginLabel))], []);
  const filtersActive = Boolean(statusFilter || originFilter || from || to);

  function clearFilters() {
    setStatusFilter("");
    setOriginFilter("");
    setFrom("");
    setTo("");
  }

  function exportRuns(format: "json" | "csv") {
    const stamp = new Date().toISOString().slice(0, 10);
    const mediaType = format === "json" ? "application/json" : "text/csv";
    const content = format === "json" ? runsToJson(filtered) : runsToCsv(filtered);
    downloadFile(`ejecuciones-${workspace.slug}-${stamp}.${format}`, content, mediaType);
  }

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Ejecuciones"
        description="Historial del proyecto con filtros por estado, origen y fecha, jerarquía de ejecuciones hijas y exportación en JSON/CSV."
      />
      {runs.length === 0 ? (
        <EmptyState
          icon={<RunsNavIcon />}
          title="Sin ejecuciones todavía"
          description="Lanza el flujo y sus ejecuciones aparecerán aquí con estado, recorrido y detalle paso a paso."
          action={
            <button type="button" className={button} onClick={() => workspace.setLaunchOpen(true)}>
              Ejecutar flujo
            </button>
          }
        />
      ) : (
        <>
          <search className={card} aria-label="Filtros de ejecuciones">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field id="runs-status-filter" label="Estado">
                <select
                  className={input}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {RUN_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="runs-origin-filter" label="Origen">
                <select
                  className={input}
                  value={originFilter}
                  onChange={(event) => setOriginFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {originOptions.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="runs-from-filter" label="Desde" hint="Fecha de inicio en UTC (día inclusivo).">
                <input
                  type="date"
                  className={input}
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </Field>
              <Field id="runs-to-filter" label="Hasta" hint="Fecha de inicio en UTC (día inclusivo).">
                <input
                  type="date"
                  className={input}
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted" data-testid="runs-filter-count">
                Mostrando {rows.length} de {runs.length} ejecuciones.
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
                  disabled={filtered.length === 0}
                  onClick={() => exportRuns("json")}
                >
                  Exportar JSON
                </button>
                <button
                  type="button"
                  className={buttonGhost}
                  disabled={filtered.length === 0}
                  onClick={() => exportRuns("csv")}
                >
                  Exportar CSV
                </button>
              </div>
            </div>
            {runs.length >= RUNS_LIST_LIMIT && (
              <p className="text-xs text-warn" data-testid="runs-truncation-note">
                La lista solo carga las {RUNS_LIST_LIMIT} ejecuciones más recientes; la exportación incluye
                únicamente las ejecuciones visibles aquí.
              </p>
            )}
          </search>
          {rows.length === 0 ? (
            <EmptyState
              icon={<RunsNavIcon />}
              title="Ninguna ejecución coincide"
              description="Ninguna de las ejecuciones cargadas cumple los filtros actuales. Ajusta o limpia los filtros para ver más ejecuciones."
              action={
                <button type="button" className={buttonGhost} onClick={clearFilters}>
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map(({ run, child }) => (
                <div
                  key={run.id}
                  className={child ? "ml-6 border-l-2 border-l-accent/50 pl-4" : undefined}
                >
                  <article
                    className={`${card} gap-2`}
                    data-testid="run-row"
                    data-child={child ? "true" : undefined}
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-sm">
                        {child ? <span className="mr-1.5 text-faint" aria-hidden="true">↳</span> : null}
                        {run.id.slice(0, 8)}
                      </strong>
                      <StatusBadge status={run.status} />
                    </header>
                    <small className="text-xs text-muted">
                      {new Date(run.startedAt).toLocaleString()} · {run.launchedBy ?? "sistema"} ·{" "}
                      <span title={run.entryPoint}>{runOriginLabel(run.entryPoint)}</span>
                      {run.sourceDetail ? ` · ${run.sourceDetail}` : ""}
                    </small>
                    {child && run.parentRunId && (
                      <small className="text-xs text-faint">
                        Ejecución hija de {run.parentRunId.slice(0, 8)}.
                      </small>
                    )}
                    {run.error && <p className="text-sm text-danger">{run.error}</p>}
                    {run.output !== undefined && (
                      <p className="text-xs text-muted">Resultado: {previewValue(run.output)}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={buttonGhost}
                        onClick={() => workspace.setDetailRun(run)}
                      >
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        className={buttonGhost}
                        onClick={() => workspace.replayRun(run.id)}
                      >
                        Re-ejecutar
                      </button>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ProjectSectionBody>
  );
}
