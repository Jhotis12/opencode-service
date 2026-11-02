import type { RunRecord } from "../api.ts";
import { Modal } from "./Modal.tsx";
import { badge, buttonGhost, statusBadge } from "../ui.ts";

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
}: {
  run: RunRecord;
  nodeLabels?: Record<string, string>;
  onClose(): void;
  onReplay(fromNodeId?: string): void;
}) {
  return (
    <Modal title={`Ejecución ${run.id.slice(0, 8)}`} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={statusBadge(run.status)} data-testid="run-status">
          {run.status}
        </span>
        <small className="text-xs text-muted">{new Date(run.startedAt).toLocaleString()}</small>
        {run.finishedAt && <small className="text-xs text-muted">→ {new Date(run.finishedAt).toLocaleTimeString()}</small>}
      </div>
      {run.error && <p className="text-sm text-danger">{run.error}</p>}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Resultado final</h3>
        <pre>{formatValue(run.output)}</pre>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Pasos ({run.steps.length})</h3>
        {run.steps.map((step, index) => (
          <article className="flex flex-col gap-2 rounded-lg border border-line bg-[#0a1120] p-3" key={step.id}>
            <header className="flex items-center justify-between gap-3">
              <strong className="text-sm text-slate-100">
                {index + 1}. {nodeLabels?.[step.nodeId] ?? step.nodeId}
              </strong>
              <span className={statusBadge(step.status)}>{step.status}</span>
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
