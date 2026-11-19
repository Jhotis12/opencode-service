import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { buttonGhost, focusRing } from "../ui.ts";

export type OverflowMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly danger?: boolean;
  onSelect(): void;
};

const ITEM_CLASS =
  "rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-panel-2 focus:bg-panel-2 " + focusRing;
const ITEM_DANGER_CLASS =
  "rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10 focus:bg-danger/10 " + focusRing;
const PANEL_CLASS =
  "absolute right-0 top-full z-50 mt-2 flex min-w-[210px] flex-col gap-1 rounded-xl border border-line bg-panel p-1.5 shadow-2xl";

export function OverflowMenu({
  label,
  items,
}: {
  readonly label: string;
  readonly items: readonly OverflowMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function menuItems() {
    return Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function focusItem(index: "first" | "last") {
    requestAnimationFrame(() => {
      const nodes = menuItems();
      const target = index === "first" ? nodes[0] : nodes[nodes.length - 1];
      target?.focus();
    });
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes = menuItems();
    if (nodes.length === 0) return;
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      nodes[(current + delta + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? nodes[0] : nodes[nodes.length - 1])?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={buttonGhost + " !px-2"}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          if (!open) setOpen(true);
          focusItem(event.key === "ArrowDown" ? "first" : "last");
        }}
      >
        ...
      </button>
      {open && (
        <div role="menu" aria-label={label} className={PANEL_CLASS} onKeyDown={onMenuKeyDown}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={item.danger ? ITEM_DANGER_CLASS : ITEM_CLASS}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
