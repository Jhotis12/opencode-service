import type { GraphIssue } from "./canvas/graph-edits.ts";
import { buttonGhost } from "../ui.ts";

export function GraphIssuesSummary({
  issues,
  onDismiss,
}: {
  readonly issues: readonly GraphIssue[];
  onDismiss(): void;
}) {
  return (
    <section aria-label="Problemas del flujo" className="shrink-0 border-b border-warn/30 bg-warn/5 px-3 py-2 lg:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-warn">
            Guardar deshabilitado: el flujo tiene {issues.length} {issues.length === 1 ? "problema" : "problemas"}.
          </p>
          <ul className="mt-1 flex list-inside list-disc flex-col gap-0.5 text-xs text-warn">
            {issues.map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        </div>
        <button type="button" className={`${buttonGhost} shrink-0`} onClick={onDismiss}>
          Descartar
        </button>
      </div>
    </section>
  );
}
