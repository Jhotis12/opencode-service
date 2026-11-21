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

const EXIT_MS = 140;

// Render order defines the stack: a dialog rendered later (a confirmation over an
// inspector) gets a higher id and is the one that owns Escape and the focus trap.
let nextModalId = 0;
const openModalIds = new Set<number>();

// Page locking is reference-counted so nested dialogs restore the body scroll and the
// root inert state only once, instead of leaving them locked when the inner one closes.
let pageLockCount = 0;
let previousBodyOverflow = "";
let previousRootInert = false;
let lockedRoot: HTMLElement | null = null;

function acquirePageLock(): void {
  const root = document.getElementById("root");
  if (pageLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousRootInert = root?.hasAttribute("inert") ?? false;
    lockedRoot = root;
  }
  pageLockCount += 1;
  root?.setAttribute("inert", "");
  document.body.style.overflow = "hidden";
}

function releasePageLock(): void {
  pageLockCount = Math.max(0, pageLockCount - 1);
  if (pageLockCount > 0) return;
  if (lockedRoot && !previousRootInert) lockedRoot.removeAttribute("inert");
  document.body.style.overflow = previousBodyOverflow;
  lockedRoot = null;
}

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
  // Captured during render, before commit: a child autoFocus inside the dialog runs
  // before this component's effects, so an effect would remember the wrong element.
  const [trigger] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const stateRef = useRef(state);
  const titleId = useId();
  const [modalId] = useState(() => ++nextModalId);

  stateRef.current = state;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    acquirePageLock();
    const frame = requestAnimationFrame(() => setState("open"));
    closeRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(closeTimer.current);
      releasePageLock();
      if (trigger?.isConnected && !trigger.hasAttribute("disabled")) trigger.focus();
    };
  }, [trigger]);

  const requestClose = useCallback(() => {
    if (stateRef.current === "closing") return;
    setState("closing");
    closeTimer.current = setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    openModalIds.add(modalId);
    return () => {
      openModalIds.delete(modalId);
    };
  }, [modalId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      // Only the dialog on top of the stack reacts: with a nested confirmation open,
      // Escape must not close the dialog underneath and Tab must not leave the top one.
      if (!panel || modalId !== Math.max(...openModalIds)) return;
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
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
  }, [requestClose, modalId]);

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
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <h2 id={titleId} className="min-w-28 truncate text-base font-semibold text-slate-100">
            {title}
          </h2>
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            <button ref={closeRef} type="button" className={buttonGhost} onClick={requestClose} aria-label="Cerrar">
              ×
            </button>
          </div>
        </header>
        <div data-modal-body="" className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="flex flex-col gap-3">{children}</div>
        </div>
        {footer && <div className="shrink-0 border-t border-line bg-panel px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
