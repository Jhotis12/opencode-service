import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, runOriginLabel, type HealthPayload } from "../api.ts";
import { qk } from "../query.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { ResponsiveTable } from "../components/RunsTable.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { badge, button, buttonGhost, buttonPrimary, card, friendlyError, sectionTitle } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

const REFRESH_INTERVAL_MS = 5000;
const timestampFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "medium" });
const metricGrid = "grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3";

type Metric = { readonly label: string; readonly value: string | number };
type ErrorLevel = HealthPayload["recentErrors"][number]["level"];

const SEVERITY: Record<ErrorLevel, { readonly label: string; readonly className: string }> = {
  warn: { label: "Advertencia", className: "border-warn/40 text-warn" },
  error: { label: "Error", className: "border-danger/40 text-danger" },
  fatal: { label: "Crítico", className: "border-danger/40 text-danger" },
};

function SeverityBadge({ level }: { readonly level: ErrorLevel }) {
  const severity = SEVERITY[level];
  return (
    <span className={`${badge} ${severity.className}`} title={level} aria-label={`Severidad: ${severity.label}`}>
      {severity.label}
    </span>
  );
}

function MetricGrid({ metrics }: { readonly metrics: readonly Metric[] }) {
  return (
    <div className={metricGrid}>
      {metrics.map((metric) => (
        <article className={`${card} gap-1 p-4`} key={metric.label}>
          <small className="text-xs text-muted">{metric.label}</small>
          <strong className="text-xl font-semibold tabular-nums text-slate-100">{metric.value}</strong>
        </article>
      ))}
    </div>
  );
}

export function HealthPage({ loadHealth = api.health }: { loadHealth?: () => Promise<HealthPayload> } = {}) {
  useDocumentTitle("Salud del sistema");
  const [paused, setPaused] = useState(false);
  const healthQuery = useQuery({
    queryKey: qk.health,
    queryFn: loadHealth,
    refetchInterval: paused ? false : REFRESH_INTERVAL_MS,
  });
  const health = healthQuery.data;
  const errorMessage = healthQuery.error
    ? friendlyError(healthQuery.error, "No se pudo consultar la salud del sistema.")
    : undefined;

  return (
    <section className="flex flex-col gap-6" aria-busy={healthQuery.isPending}>
      <PageHeader
        title="Salud del sistema"
        description="Estado en vivo de OpenCode V2, base de datos, canales, workers y errores recientes."
        actions={
          <>
            {health && <StatusBadge status={health.status} testId="health-status" />}
            <button className={button} type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
              {paused ? "Reanudar actualización" : "Pausar actualización"}
            </button>
            <button
              className={buttonPrimary}
              type="button"
              disabled={healthQuery.isFetching}
              onClick={() => void healthQuery.refetch()}
            >
              {healthQuery.isFetching ? "Actualizando…" : "Actualizar ahora"}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {health ? (
          <span>
            Última actualización:{" "}
            <time data-testid="health-last-updated" dateTime={health.generatedAt}>
              {timestampFormatter.format(new Date(health.generatedAt))}
            </time>
          </span>
        ) : (
          <span>Sin una lectura reciente.</span>
        )}
        <span aria-live="polite">{paused ? "Actualización automática pausada." : "Actualización automática cada 5 s."}</span>
      </div>

      {healthQuery.isPending ? (
        <div className="flex flex-col gap-4" role="status">
          <span className="sr-only">Consultando salud del sistema…</span>
          <div className={metricGrid}>
            {[0, 1, 2].map((item) => <Skeleton shape="block" size="lg" key={item} />)}
          </div>
          <Skeleton shape="block" size="lg" className="h-48" />
        </div>
      ) : errorMessage && !health ? (
        <div role="alert">
          <EmptyState
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8v5m0 3h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>}
            title="No se pudo consultar la plataforma"
            description={errorMessage}
            action={
              <div className="flex flex-col items-center gap-3">
                <p className="max-w-md text-sm text-muted">La API puede estar caída o inalcanzable; todavía no hay datos para distinguirlo. Reintenta la consulta.</p>
                <button className={button} type="button" onClick={() => void healthQuery.refetch()}>Reintentar consulta</button>
              </div>
            }
          />
        </div>
      ) : health ? (
        <>
          {health.status === "down" && (
            <div className={`${card} border-danger/40 bg-danger/5`} role="alert">
              <h2 className="text-base font-semibold text-danger">La plataforma está caída</h2>
              <p className="text-sm text-slate-200">
                La última lectura reporta un estado caído. Revisa qué servicio dejó de responder y usa los enlaces de errores para investigar; los datos recibidos permanecen visibles.
              </p>
            </div>
          )}
          {errorMessage && (
            <div className={`${card} border-warn/40 bg-warn/5`} role="alert">
              <p className="text-sm text-warn">{errorMessage} Se conserva la última lectura recibida.</p>
              <button className={`${button} self-start`} type="button" onClick={() => void healthQuery.refetch()}>Reintentar actualización</button>
            </div>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="health-services-title">
            <h2 className={sectionTitle} id="health-services-title">Estado</h2>
            {health.services.length === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16" /></svg>}
                title="Sin servicios informados"
                description="La respuesta no incluyó servicios. Actualiza la lectura para volver a comprobarlos."
                action={<button className={button} type="button" onClick={() => void healthQuery.refetch()}>Comprobar servicios</button>}
              />
            ) : (
                            <ResponsiveTable
                caption="Estado de los servicios"
                headRowClassName="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted"
                rowClassName="border-b border-line/60 last:border-0"
                rows={health.services}
                rowKey={(service) => service.name}
                rowProps={() => ({ testId: "health-service-row" })}
                columns={[
                  { key: "name", header: "Servicio", cell: (service) => service.name },
                  { key: "status", header: "Estado", cell: (service) => <StatusBadge status={service.status} /> },
                  {
                    key: "detail",
                    header: "Detalle",
                    cell: (service) => service.detail,
                    cellClassName: "min-w-52 text-muted",
                    narrowCellClassName: "text-muted",
                  },
                  {
                    key: "latency",
                    header: "Latencia",
                    cell: (service) => (service.latencyMs !== undefined ? `${service.latencyMs} ms` : "—"),
                    cellClassName: "tabular-nums",
                  },
                ]}
              />
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="health-metrics-title">
            <h2 className={sectionTitle} id="health-metrics-title">Rendimiento</h2>
            <MetricGrid metrics={[
              { label: "Peticiones", value: health.metrics.requests },
              { label: "Tasa de error", value: `${(health.metrics.errorRate * 100).toFixed(2)}%` },
              { label: "Latencia p50", value: `${health.metrics.p50Ms} ms` },
              { label: "Latencia p95", value: `${health.metrics.p95Ms} ms` },
              { label: "Latencia p99", value: `${health.metrics.p99Ms} ms` },
              { label: "Uptime", value: `${Math.floor(health.uptimeSeconds / 60)} min` },
            ]} />
            {health.chat && (
              <div className="mt-3 flex flex-col gap-3">
                <h3 className="text-sm font-medium text-slate-200">Actividad del chat</h3>
                <MetricGrid metrics={[
                  { label: "Turnos activos", value: health.chat.active },
                  { label: "Turno más viejo", value: health.chat.oldestActiveAgeMs !== undefined ? `${Math.floor(health.chat.oldestActiveAgeMs / 60_000)} min` : "—" },
                  { label: "Recuperados 24h", value: health.chat.recovered24h },
                  { label: "Fallidos 24h", value: health.chat.failed24h },
                ]} />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="health-errors-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle} id="health-errors-title">Errores recientes</h2>
              <div className="flex flex-wrap gap-2">
                <a className={buttonGhost} href="/runs">Ver ejecuciones</a>
                <a className={buttonGhost} href="/settings" title="Configurar Sentry o GlitchTip en Ajustes">Sentry/GlitchTip</a>
              </div>
            </div>
            {health.recentErrors.length === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4.5 4.5L19 7" /></svg>}
                title="Sin errores recientes"
                description="No hay errores registrados en la última lectura. Puedes revisar las ejecuciones para confirmar su resultado."
                action={<a className={button} href="/runs">Revisar ejecuciones</a>}
              />
            ) : (
                            <ResponsiveTable
                caption="Errores recientes"
                headRowClassName="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted"
                rowClassName="border-b border-line/60 last:border-0"
                rows={health.recentErrors}
                rowKey={(item) => item.id}
                rowProps={() => ({ testId: "health-error-row" })}
                columns={[
                  { key: "level", header: "Severidad", cell: (item) => <SeverityBadge level={item.level} /> },
                  {
                    key: "createdAt",
                    header: "Fecha",
                    cell: (item) => (
                      <time dateTime={item.createdAt}>{timestampFormatter.format(new Date(item.createdAt))}</time>
                    ),
                    cellClassName: "whitespace-nowrap text-xs text-muted",
                    narrowCellClassName: "text-xs text-muted",
                  },
                  { key: "origin", header: "Origen", cell: (item) => runOriginLabel(item.entryPoint) },
                  {
                    key: "message",
                    header: "Mensaje",
                    cell: (item) => item.message,
                    cellClassName: "min-w-64 break-words",
                    narrowCellClassName: "break-words",
                  },
                ]}
              />
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
