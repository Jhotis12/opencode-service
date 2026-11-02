import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonGhost, modalBackdrop, modalPanel } from "../ui.ts";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

const EXIT_MS = 160;

export function Modal({
  title,
  onClose,
  children,
  actions,
  size = "md",
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
  actions?: ReactNode;
  size?: ModalSize;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const stateRef = useRef(state);
  const titleId = useId();

  stateRef.current = state;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setState("open"));
    closeRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const requestClose = useCallback(() => {
    if (stateRef.current === "closing") return;
    setState("closing");
    closeTimer.current = setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return (
    <div className={modalBackdrop} data-state={state === "open" ? "open" : "closed"} onClick={requestClose}>
      <div
        className={`${modalPanel} ${SIZE_CLASS[size]}`}
        data-state={state === "open" ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-slate-100">
            {title}
          </h2>
          <div className="flex items-center gap-1.5">
            {actions}
            <button ref={closeRef} type="button" className={buttonGhost} onClick={requestClose} aria-label="Cerrar">
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
