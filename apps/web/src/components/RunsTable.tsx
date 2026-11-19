import { Link } from "react-router-dom";
import { runOriginLabel, type RunRecord } from "../api.ts";
import { buttonGhost, card } from "../ui.ts";
import { StatusBadge } from "./StatusBadge.tsx";

export const RUN_STATUS_OPTIONS = [
  "queued",
  "running",
  "paused",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
] as const;

export const RUN_ORIGIN_VALUES = [
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

export const RUN_ORIGIN_OPTIONS = [...new Set(RUN_ORIGIN_VALUES.map(runOriginLabel))];

export type RunRow = { readonly run: RunRecord; readonly child: boolean };

export type RunFilters = { readonly status: string; readonly origin: string; readonly from: string; readonly to: string };

export function groupRunsByParent(runs: readonly RunRecord[]): RunRow[] {
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
  const rows: RunRow[] = [];
  for (const root of roots) {
    rows.push({ run: root, child: false });
    for (const child of childrenByParent.get(root.id) ?? []) {
      rows.push({ run: child, child: true });
    }
  }
  return rows;
}

function startedWithinDayRange(startedAt: string, fromDayInclusive: string, toDayInclusive: string): boolean {
  const day = startedAt.slice(0, 10);
  if (fromDayInclusive && day < fromDayInclusive) return false;
  if (toDayInclusive && day > toDayInclusive) return false;
  return true;
}

export function filterRuns(runs: readonly RunRecord[], filters: RunFilters): RunRecord[] {
  return runs.filter((run) => {
    if (filters.status && run.status !== filters.status) return false;
    if (filters.origin && runOriginLabel(run.entryPoint) !== filters.origin) return false;
    if (!startedWithinDayRange(run.startedAt, filters.from, filters.to)) return false;
    return true;
  });
}

const durationFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

export function formatRunDuration(run: RunRecord): string {
  if (!run.finishedAt) {
    if (run.status === "running") return "En curso";
    if (run.status === "paused") return "En pausa";
    if (run.status === "queued") return "En cola";
    return "—";
  }
  const milliseconds = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${durationFormatter.format(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${Math.round(seconds % 60)} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const startedAtFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const fullTimestampFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "medium" });

export function projectRunHref(run: RunRecord): string {
  return `/projects/${encodeURIComponent(run.projectSlug)}/runs?run=${encodeURIComponent(run.id)}`;
}

/** Campos exportables en JSON/CSV: excluye entrada, salida, logs y errores para no filtrar datos sensibles. */
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

export function runsToJson(runs: readonly RunRecord[]): string {
  return JSON.stringify(runs.map(exportableRun), null, 2);
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function runsToCsv(runs: readonly RunRecord[]): string {
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

export function downloadRunsExport(
  format: "json" | "csv",
  runs: readonly RunRecord[],
  filenameBase: string,
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const content = format === "json" ? runsToJson(runs) : runsToCsv(runs);
  const mediaType = format === "json" ? "application/json" : "text/csv";
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenameBase}-${stamp}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RunsTable({
  rows,
  onOpenDetail,
  onReplay,
  caption = "Ejecuciones",
  showProject = true,
}: {
  readonly rows: readonly RunRow[];
  readonly onOpenDetail: (run: RunRecord) => void;
  readonly onReplay?: (run: RunRecord) => void;
  readonly caption?: string;
  readonly showProject?: boolean;
}) {
  return (
    <div className={`${card} overflow-x-auto p-0`} role="region" aria-label={caption} tabIndex={0}>
      <table className={`w-full ${showProject ? "min-w-[880px]" : "min-w-[760px]"} border-collapse text-sm`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[1] bg-panel">
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Ejecución
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Estado
            </th>
            {showProject && (
              <th scope="col" className="px-4 py-2.5 font-medium">
                Proyecto
              </th>
            )}
            <th scope="col" className="px-4 py-2.5 font-medium">
              Origen
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Inicio
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Duración
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ run, child }) => (
            <tr
              key={run.id}
              data-testid="run-row"
              data-child={child ? "true" : undefined}
              className="border-b border-line/70 align-top last:border-0 hover:bg-panel-2/60"
            >
              <td className="px-4 py-3">
                <span className={`flex flex-wrap items-center gap-1.5 ${child ? "pl-4" : ""}`}>
                  {child && (
                    <span aria-hidden="true" className="text-faint">
                      ↳
                    </span>
                  )}
                  <strong className="font-mono text-xs text-slate-200" title={run.id}>
                    {run.id.slice(0, 8)}
                  </strong>
                  {child && (
                    <span
                      className="rounded-full border border-line px-1.5 text-[11px] text-muted"
                      title={run.parentRunId ? `Ejecución hija de ${run.parentRunId}` : "Ejecución hija"}
                    >
                      Hija
                    </span>
                  )}
                </span>
                {child && run.parentRunId && (
                  <small className="block pl-4 text-[11px] text-faint">
                    de {run.parentRunId.slice(0, 8)}
                  </small>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={run.status} />
              </td>
              {showProject && (
                <td className="px-4 py-3">
                  <Link
                    to={projectRunHref(run)}
                    className="inline-flex items-center gap-1 text-xs text-slate-200 underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent"
                    title={`Abrir la ejecución ${run.id} en el proyecto ${run.projectSlug}`}
                  >
                    {run.projectSlug}
                    <span aria-hidden="true" className="text-[11px] text-faint">
                      ↗
                    </span>
                  </Link>
                </td>
              )}
              <td className="px-4 py-3">
                <span className="text-xs text-slate-200" title={run.entryPoint}>
                  {runOriginLabel(run.entryPoint)}
                </span>
                {run.sourceDetail && (
                  <small className="block max-w-[16rem] truncate text-[11px] text-faint" title={run.sourceDetail}>
                    {run.sourceDetail}
                  </small>
                )}
              </td>
              <td className="px-4 py-3">
                <time
                  dateTime={run.startedAt}
                  title={fullTimestampFormatter.format(new Date(run.startedAt))}
                  className="whitespace-nowrap text-xs text-slate-200 tabular-nums"
                >
                  {startedAtFormatter.format(new Date(run.startedAt))}
                </time>
              </td>
              <td className="px-4 py-3">
                <span className="whitespace-nowrap text-xs text-slate-200 tabular-nums">
                  {formatRunDuration(run)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button type="button" className={buttonGhost} onClick={() => onOpenDetail(run)}>
                    Ver detalle
                  </button>
                  {onReplay && (
                    <button type="button" className={buttonGhost} onClick={() => onReplay(run)}>
                      Re-ejecutar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
