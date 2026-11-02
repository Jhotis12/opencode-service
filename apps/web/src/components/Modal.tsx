import { useEffect, useRef, type ReactNode } from "react";
import { buttonGhost, modalBackdrop, modalPanel } from "../ui.ts";

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={modalBackdrop} onClick={onClose}>
      <div
        className={modalPanel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button ref={closeRef} className={buttonGhost} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
