import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  footer,
  size = "md",
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
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
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    const previousOverflow = document.body.style.overflow;
    const rootWasInert = root?.hasAttribute("inert") ?? false;
    root?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => setState("open"));
    closeRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(closeTimer.current);
      if (root && !rootWasInert) root.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      const trigger = triggerRef.current;
      if (trigger?.isConnected && !trigger.hasAttribute("disabled")) trigger.focus();
    };
  }, []);

  const requestClose = useCallback(() => {
    if (stateRef.current === "closing") return;
    setState("closing");
    closeTimer.current = setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return createPortal(
    <div className={modalBackdrop} data-state={state === "open" ? "open" : "closed"} onClick={requestClose}>
      <div
        ref={panelRef}
        className={`${modalPanel} ${SIZE_CLASS[size]}`}
        data-state={state === "open" ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
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
        {footer && <div className="shrink-0 border-t border-line bg-panel px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
