import { useQuery } from "@tanstack/react-query";
import { api, type HealthPayload } from "../api.ts";
import { qk } from "../query.ts";
import { badge, card, pageTitle, statusBadge } from "../ui.ts";

export function HealthPage({ loadHealth = api.health }: { loadHealth?: () => Promise<HealthPayload> } = {}) {
  const healthQuery = useQuery({ queryKey: qk.health, queryFn: loadHealth, refetchInterval: 5000 });
  const health = healthQuery.data;

  if (healthQuery.error && !health) {
    return (
      <p className="text-sm text-danger">
        {healthQuery.error instanceof Error ? healthQuery.error.message : "No se pudo consultar la salud"}
      </p>
    );
  }
  if (!health) return <p className="text-sm text-muted">Consultando salud del sistema…</p>;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Salud del sistema</h1>
          <p className="mt-1 text-sm text-muted">
            Estado en vivo de OpenCode V2, base de datos, canales, workers y errores recientes.
          </p>
        </div>
        <span className={statusBadge(health.status)} data-testid="health-status">
          {health.status}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Peticiones", value: health.metrics.requests },
          { label: "Tasa de error", value: `${(health.metrics.errorRate * 100).toFixed(2)}%` },
          { label: "Latencia p50", value: `${health.metrics.p50Ms} ms` },
          { label: "Latencia p95", value: `${health.metrics.p95Ms} ms` },
          { label: "Latencia p99", value: `${health.metrics.p99Ms} ms` },
          { label: "Uptime", value: `${Math.floor(health.uptimeSeconds / 60)} min` },
        ].map((metric) => (
          <article className={`${card} gap-1 p-4`} key={metric.label}>
            <small className="text-xs text-muted">{metric.label}</small>
            <strong className="text-xl font-semibold tabular-nums text-slate-100">{metric.value}</strong>
          </article>
        ))}
      </div>

      <section className={card}>
        <h2 className="text-base font-semibold text-slate-100">Servicios</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-2 py-2 font-medium">Servicio</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium">Detalle</th>
                <th className="px-2 py-2 font-medium">Latencia</th>
              </tr>
            </thead>
            <tbody>
              {health.services.map((service) => (
                <tr key={service.name} className="border-b border-line/60">
                  <td className="px-2 py-2.5">{service.name}</td>
                  <td className="px-2 py-2.5">
                    <span className={statusBadge(service.status)}>{service.status}</span>
                  </td>
                  <td className="px-2 py-2.5 text-muted">{service.detail}</td>
                  <td className="px-2 py-2.5 tabular-nums">{service.latencyMs !== undefined ? `${service.latencyMs} ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-base font-semibold text-slate-100">Errores recientes</h2>
        {health.recentErrors.length === 0 ? (
          <p className="text-sm text-muted">Sin errores registrados. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Origen</th>
                  <th className="px-2 py-2 font-medium">Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {health.recentErrors.map((item) => (
                  <tr key={item.id} className="border-b border-line/60">
                    <td className="px-2 py-2.5 text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2.5">{item.entryPoint}</td>
                    <td className="px-2 py-2.5">{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">
          Para trazas externas inicia sesión en tu panel de Sentry/GlitchTip configurado en Ajustes.
        </p>
      </section>
    </section>
  );
}
