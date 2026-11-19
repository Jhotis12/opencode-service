import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { RunRecord } from "../api.ts";
import { api, runOriginLabel, runSourceLabel } from "../api.ts";
import { qk } from "../query.ts";
import { Modal } from "./Modal.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { badge, button, buttonDanger, buttonGhost } from "../ui.ts";

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function previewValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export function RunDetailModal({
  run,
  nodeLabels,
  onClose,
  onReplay,
  notice,
}: {
  run: RunRecord;
  nodeLabels?: Record<string, string>;
  onClose(): void;
  onReplay(fromNodeId?: string): void;
  notice?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const approvalsQuery = useQuery({
    queryKey: ["approvals", run.id],
    queryFn: () => api.listApprovals(run.projectSlug, run.id).then((result) => result.data),
    enabled: run.status === "paused",
  });
  const pending = approvalsQuery.data?.find((approval) => approval.status === "pending");
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", run.id],
    queryFn: () => api.listDeliveries(run.projectSlug, run.id).then((result) => result.data),
  });
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      api.decideApproval(run.projectSlug, run.id, pending!.nodeId, decision),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.runs(run.projectSlug) });
      await queryClient.invalidateQueries({ queryKey: ["approvals", run.id] });
    },
  });

  return (
    <Modal title={`Ejecución ${run.id.slice(0, 8)}`} onClose={onClose} size="lg">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={run.status} testId="run-status" />
        <small className="text-xs text-muted">{new Date(run.startedAt).toLocaleString()}</small>
        {run.finishedAt && <small className="text-xs text-muted">→ {new Date(run.finishedAt).toLocaleTimeString()}</small>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Proyecto: <code>{run.projectSlug}</code>
        </span>
        <span>
          Iniciado por: <strong className="text-slate-200">{run.launchedBy ?? "sistema"}</strong>
        </span>
        <span>Origen: {run.sourceDetail ? runSourceLabel(run.sourceDetail) : runOriginLabel(run.entryPoint)}</span>
        {run.graphHash && <span>Versión: {run.graphHash.slice(0, 8)}</span>}
        <span className="w-full break-all">ID: {run.id}</span>
      </div>
      {run.error && <p className="text-sm text-danger">{run.error}</p>}
      {notice}

      {run.status === "paused" && (
        <section className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-warn/5 p-3">
          <h3 className="text-sm font-semibold text-slate-100">Aprobación pendiente</h3>
          {pending ? (
            <>
              <p className="text-xs text-muted">
                Nodo: <strong className="text-slate-200">{nodeLabels?.[pending.nodeId] ?? pending.nodeId}</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                <button className={button} disabled={decide.isPending} onClick={() => decide.mutate("approve")}>
                  Aprobar
                </button>
                <button className={buttonDanger} disabled={decide.isPending} onClick={() => decide.mutate("reject")}>
                  Rechazar
                </button>
              </div>
              {decide.error && (
                <p className="text-xs text-danger">
                  {decide.error instanceof Error ? decide.error.message : "No se pudo registrar la decisión"}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">
              {approvalsQuery.isLoading
                ? "Cargando aprobación…"
                : "No hay una aprobación pendiente. Si el flujo continúa pausado, revisa la configuración del canal de aprobación."}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Resultado final</h3>
        <pre>{formatValue(run.output)}</pre>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Entregas</h3>
        {(deliveriesQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-muted">Esta ejecución no registró entregas de notificación.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deliveriesQuery.data!.map((delivery) => (
              <li key={delivery.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-well p-2 text-xs">
                <StatusBadge status={delivery.status} />
                <span className="text-slate-200">{delivery.nodeId ?? "nodo"}</span>
                <span className="text-muted">{delivery.integrationId}</span>
                {delivery.providerMessageId && <code className="text-muted">{delivery.providerMessageId}</code>}
                <span className="text-muted">{delivery.attempts} intento(s)</span>
                {delivery.lastError && <span className="text-danger">{delivery.lastError}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Pasos ({run.steps.length})</h3>
        {run.steps.map((step, index) => (
          <article className="flex flex-col gap-2 rounded-lg border border-line bg-well p-3" key={step.id}>
            <header className="flex items-center justify-between gap-3">
              <strong className="text-sm text-slate-100">
                {index + 1}. {nodeLabels?.[step.nodeId] ?? step.nodeId}
              </strong>
              <StatusBadge status={step.status} />
            </header>
            <div className="flex flex-wrap gap-3">
              <small className="text-xs text-muted">{step.durationMs} ms</small>
              {step.model && <small className="text-xs text-muted">modelo: {step.model}</small>}
              {step.agentId && <small className="text-xs text-muted">sub-agente: {step.agentId}</small>}
            </div>
            {step.error && <p className="text-sm text-danger">{step.error}</p>}
            <details>
              <summary className="cursor-pointer text-xs text-muted">Entrada</summary>
              <pre className="mt-1.5">{formatValue(step.input)}</pre>
            </details>
            <details open>
              <summary className="cursor-pointer text-xs text-muted">Salida</summary>
              <pre className="mt-1.5">{formatValue(step.output)}</pre>
            </details>
            {step.logs && step.logs.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted">Logs ({step.logs.length})</summary>
                <ul className="mt-1.5 list-inside list-disc text-xs text-muted">
                  {step.logs.map((log, logIndex) => (
                    <li key={logIndex}>
                      <code>{log.message}</code> {formatValue(log.fields)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <button className={buttonGhost} onClick={() => onReplay(step.nodeId)}>
              Re-ejecutar desde aquí
            </button>
          </article>
        ))}
      </section>
    </Modal>
  );
}
