import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EntryPointTypeSchema } from "@platform/shared";
import { runOriginLabel, runSourceLabel, type RunRecord } from "../api.ts";
import { buttonGhost, card } from "../ui.ts";
import { useMediaQuery } from "../useMediaQuery.ts";
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

export const RUN_ORIGIN_VALUES: readonly string[] = EntryPointTypeSchema.options;

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

/** Phone breakpoint shared by every stacked surface; matches the picker sheet. */
export const NARROW_TABLE_QUERY = "(max-width: 639px)";

export type ResponsiveColumn<Row> = {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  /** Narrow-only rendering, for cells whose desktop affordance does not fit a card. */
  readonly narrowCell?: (row: Row) => ReactNode;
  readonly headerClassName?: string;
  readonly cellClassName?: string;
  readonly narrowCellClassName?: string;
};

/** Attributes a row carries in both presentations; `data` is spread verbatim. */
export type ResponsiveRowProps = {
  readonly testId?: string;
  readonly className?: string;
  readonly narrowClassName?: string;
  readonly data?: Record<string, string | undefined>;
};

/**
 * One presentation mechanism for every data table in the app: a real table in a
 * labelled scroll region on desktop, and a labelled definition list of stacked
 * cards under 640 px, where every column keeps its header as the term. No column
 * hides behind a horizontal scrollport, and the desktop table does not change.
 *
 * It lives beside `RunsTable` because that is the table module the runs pages and
 * `HealthPage` both import from.
 */
export function ResponsiveTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  rowProps,
  headRowClassName,
  rowClassName = "border-b border-line/70 align-top last:border-0",
  minWidthClassName,
}: {
  readonly caption: string;
  readonly columns: readonly ResponsiveColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row, index: number) => string;
  readonly rowProps?: (row: Row, index: number) => ResponsiveRowProps;
  readonly headRowClassName?: string;
  readonly rowClassName?: string;
  readonly minWidthClassName?: string;
}) {
  const narrow = useMediaQuery(NARROW_TABLE_QUERY);
  const headRow =
    headRowClassName ?? "border-b border-line text-left text-[11px] uppercase tracking-wide text-muted";

  if (narrow) {
    return (
      <div className={`${card} p-0`} role="region" aria-label={caption}>
        <ul className="m-0 flex list-none flex-col divide-y divide-line/60 p-0" aria-label={caption}>
          {rows.map((row, index) => {
            const presentation = rowProps?.(row, index);
            return (
              <li
                key={rowKey(row, index)}
                {...presentation?.data}
                data-testid={presentation?.testId}
                className={`flex flex-col gap-2 p-4 ${presentation?.narrowClassName ?? ""}`.trim()}
              >
                <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
                  {columns.map((column) => (
                    <Fragment key={column.key}>
                      <dt className="text-micro uppercase tracking-wide text-muted">{column.header}</dt>
                      <dd
                        className={`min-w-0 break-words text-sm text-slate-200 ${column.narrowCellClassName ?? ""}`.trim()}
                      >
                        {column.narrowCell ? column.narrowCell(row) : column.cell(row)}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className={`${card} overflow-x-auto p-0`} role="region" aria-label={caption} tabIndex={0}>
      <table className={`w-full ${minWidthClassName ?? ""} border-collapse text-sm`.trim()}>
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[1] bg-panel">
          <tr className={headRow}>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-3 font-medium ${column.headerClassName ?? ""}`.trim()}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const presentation = rowProps?.(row, index);
            return (
              <tr
                key={rowKey(row, index)}
                {...presentation?.data}
                data-testid={presentation?.testId}
                className={`${rowClassName} ${presentation?.className ?? ""}`.trim()}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 ${column.cellClassName ?? ""}`.trim()}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type RunsTableProps = {
  readonly rows: readonly RunRow[];
  readonly onOpenDetail: (run: RunRecord) => void;
  readonly onReplay?: (run: RunRecord) => void;
  readonly caption?: string;
  readonly showProject?: boolean;
};

/**
 * Runs as one responsive table: the desktop columns (id, status, project, origin,
 * start, duration, actions) and, under 640 px, the same seven columns stacked as
 * a definition list per run. Both presentations keep `data-testid="run-row"` and
 * the child-run marker, so grouping survives the switch.
 */
export function RunsTable({
  rows,
  onOpenDetail,
  onReplay,
  caption = "Ejecuciones",
  showProject = true,
}: RunsTableProps) {
  const idCell = ({ run, child }: RunRow, indent: boolean) => (
    <>
      <span className={`flex flex-wrap items-center gap-1.5 ${indent && child ? "pl-4" : ""}`.trim()}>
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
        <small className={`block text-[11px] text-faint ${indent ? "pl-4" : ""}`.trim()}>
          de {run.parentRunId.slice(0, 8)}
        </small>
      )}
    </>
  );

  const projectLink = ({ run }: RunRow) => (
    <Link
      to={projectRunHref(run)}
      className="inline-flex max-w-[9rem] min-w-0 items-center gap-1 text-xs text-slate-200 underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent"
      title={`Abrir la ejecución ${run.id} en el proyecto ${run.projectSlug}`}
    >
      <span className="min-w-0 truncate">{run.projectSlug}</span>
      <span aria-hidden="true" className="text-[11px] text-faint">
        ↗
      </span>
    </Link>
  );

  const actionsCell = ({ run }: RunRow, alignEnd: boolean) => (
    <div className={`flex flex-wrap gap-1.5 ${alignEnd ? "justify-end" : ""}`.trim()}>
      <button type="button" className={buttonGhost} onClick={() => onOpenDetail(run)}>
        Ver detalle
      </button>
      {onReplay && (
        <button type="button" className={buttonGhost} onClick={() => onReplay(run)}>
          Re-ejecutar
        </button>
      )}
    </div>
  );

  const columns: ResponsiveColumn<RunRow>[] = [
    {
      key: "run",
      header: "Ejecución",
      cell: (row) => idCell(row, true),
      narrowCell: (row) => idCell(row, false),
    },
    { key: "status", header: "Estado", cell: ({ run }) => <StatusBadge status={run.status} /> },
    ...(showProject
      ? [{ key: "project", header: "Proyecto", cell: (row: RunRow) => projectLink(row) }]
      : []),
    {
      key: "origin",
      header: "Origen",
      cell: ({ run }) => (
        <>
          <span className="text-xs text-slate-200" title={run.entryPoint}>
            {runOriginLabel(run.entryPoint)}
          </span>
          {run.sourceDetail && (
            <small className="block max-w-[9rem] truncate text-[11px] text-faint" title={runSourceLabel(run.sourceDetail)}>
              {runSourceLabel(run.sourceDetail)}
            </small>
          )}
        </>
      ),
      narrowCell: ({ run }) => (
        <>
          <span className="text-xs" title={run.entryPoint}>
            {runOriginLabel(run.entryPoint)}
          </span>
          {run.sourceDetail && (
            <small className="block truncate text-[11px] text-faint" title={runSourceLabel(run.sourceDetail)}>
              {runSourceLabel(run.sourceDetail)}
            </small>
          )}
        </>
      ),
    },
    {
      key: "started",
      header: "Inicio",
      cell: ({ run }) => (
        <time
          dateTime={run.startedAt}
          title={fullTimestampFormatter.format(new Date(run.startedAt))}
          className="whitespace-nowrap text-xs text-slate-200 tabular-nums"
        >
          {startedAtFormatter.format(new Date(run.startedAt))}
        </time>
      ),
      narrowCellClassName: "whitespace-nowrap",
    },
    {
      key: "duration",
      header: "Duración",
      cell: ({ run }) => (
        <span className="whitespace-nowrap text-xs text-slate-200 tabular-nums">{formatRunDuration(run)}</span>
      ),
      narrowCellClassName: "whitespace-nowrap",
    },
    {
      key: "actions",
      header: "Acciones",
      headerClassName: "text-right",
      cellClassName: "whitespace-nowrap text-right",
      cell: (row) => actionsCell(row, true),
      narrowCell: (row) => actionsCell(row, false),
    },
  ];

  return (
    <ResponsiveTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={({ run }) => run.id}
      minWidthClassName={showProject ? "min-w-[880px]" : "min-w-[760px]"}
      rowClassName="border-b border-line/70 align-top last:border-0 hover:bg-panel-2/60"
      rowProps={({ run, child }) => ({
        testId: "run-row",
        data: { "data-child": child ? "true" : undefined },
        narrowClassName: child ? "pl-6" : undefined,
      })}
    />
  );
}
