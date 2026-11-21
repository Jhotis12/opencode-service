import { useMemo, useState } from "react";
import { RUNS_LIST_LIMIT } from "../api.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { Field } from "../components/Field.tsx";
import { RunsNavIcon } from "../components/Layout.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import {
  RUN_ORIGIN_OPTIONS,
  RUN_STATUS_OPTIONS,
  RunsTable,
  downloadRunsExport,
  filterRuns,
  groupRunsByParent,
} from "../components/RunsTable.tsx";
import { Select } from "../components/Select.tsx";
import type { SelectOption } from "../components/select/options.ts";
import { Skeleton } from "../components/Skeleton.tsx";
import { button, buttonGhost, card, friendlyError, input, statusLabel } from "../ui.ts";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Todos" },
  ...RUN_STATUS_OPTIONS.map((status) => ({ value: status, label: statusLabel(status) })),
];

const ORIGIN_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Todos" },
  ...RUN_ORIGIN_OPTIONS.map((origin) => ({ value: origin, label: origin })),
];

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
  const filtersActive = Boolean(statusFilter || originFilter || from || to);

  function clearFilters() {
    setStatusFilter("");
    setOriginFilter("");
    setFrom("");
    setTo("");
  }

  function exportRuns(format: "json" | "csv") {
    downloadRunsExport(format, filtered, `ejecuciones-${workspace.slug}`);
  }

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Ejecuciones"
        description="Historial del proyecto con filtros por estado, origen y fecha, jerarquía de ejecuciones hijas y exportación en JSON/CSV."
      />
      {workspace.runsLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando ejecuciones">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} shape="block" size="sm" />
          ))}
        </div>
      ) : workspace.runsError ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-danger">
            {friendlyError(workspace.runsError, "No se pudieron cargar las ejecuciones.")}
          </p>
          <button type="button" className={button} onClick={workspace.refetchRuns}>
            Reintentar
          </button>
        </div>
      ) : runs.length === 0 ? (
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
                <Select
                  label="Estado"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  emptyValue=""
                  onChange={(value) => setStatusFilter(value ?? "")}
                />
              </Field>
              <Field id="runs-origin-filter" label="Origen">
                <Select
                  label="Origen"
                  options={ORIGIN_OPTIONS}
                  value={originFilter}
                  emptyValue=""
                  onChange={(value) => setOriginFilter(value ?? "")}
                />
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
            <RunsTable
              rows={rows}
              caption="Ejecuciones del proyecto"
              showProject={false}
              onOpenDetail={(run) => workspace.setDetailRun(run)}
              onReplay={(run) => workspace.replayRun(run.id)}
            />
          )}
        </>
      )}
    </ProjectSectionBody>
  );
}
