import { useEffect, useRef, useState } from "react";
import { useViewport } from "@xyflow/react";
import { focusRing } from "../../ui.ts";

export function ZoomReadout() {
  const viewport = useViewport();
  return (
    <span
      className="inline-flex items-center rounded-lg border border-line bg-well/90 px-3 py-2 text-xs text-muted shadow-lg tabular-nums"
      title="Zoom del lienzo"
    >
      Zoom {Math.round(viewport.zoom * 100)}%
    </span>
  );
}

export function AgentFlowUpdateNotice({
  summary,
  onDismiss,
  onOpenChat,
}: {
  summary: string;
  onDismiss?(): void;
  onOpenChat?(): void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="agent-update-banner"
      className="flex min-w-[230px] items-start gap-2.5 rounded-xl border border-violet/40 bg-well/95 px-3 py-2 text-xs shadow-xl"
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong className="block text-[11px] text-slate-100">Actualización del agente</strong>
        <span className="block text-[11px] text-muted">{summary}</span>
      </div>
      {onOpenChat && (
        <button
          type="button"
          className={`shrink-0 text-[11px] text-accent hover:underline ${focusRing}`}
          onClick={onOpenChat}
        >
          Abrir chat
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label="Descartar actualización del agente"
          className={`shrink-0 text-[11px] text-muted transition hover:text-slate-200 ${focusRing}`}
          onClick={onDismiss}
        >
          Descartar
        </button>
      )}
    </div>
  );
}

const SHORTCUTS: ReadonlyArray<{ keys: readonly string[]; description: string }> = [
  { keys: ["Ctrl/Cmd", "S"], description: "Guardar el flujo" },
  { keys: ["Supr / Retroceso"], description: "Eliminar el nodo seleccionado" },
  { keys: ["Esc"], description: "Cancelar la conexión en curso" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Atajos de teclado"
        title="Atajos de teclado"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`rounded-lg border border-line bg-well/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg transition hover:border-accent ${focusRing}`}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Atajos de teclado"
          className="absolute left-0 top-full z-50 mt-2 flex w-[270px] flex-col gap-2 rounded-xl border border-line bg-panel p-3 shadow-2xl"
        >
          <strong className="text-xs text-slate-100">Atajos del editor</strong>
          <ul className="flex flex-col gap-1.5">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.description} className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{shortcut.description}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded border border-line bg-well px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted">La rueda ajusta el zoom y «Ajustar vista» recentra el flujo.</p>
        </div>
      )}
    </div>
  );
}
