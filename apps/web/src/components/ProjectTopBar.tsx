import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { WorkflowGraph, WorkflowVersion } from "@platform/shared";
import { Modal } from "./Modal.tsx";
import { badge, button, buttonGhost, buttonPrimary, statusBadge } from "../ui.ts";

export type ProjectTab = "canvas" | "runs" | "agents" | "knowledge" | "configuration";

const TABS: Array<[ProjectTab, string]> = [
  ["canvas", "Canvas"],
  ["runs", "Ejecuciones"],
  ["agents", "Agentes"],
  ["knowledge", "Conocimiento"],
  ["configuration", "Configuración"],
];

export function ProjectTopBar({
  slug,
  graph,
  tab,
  counts,
  dirty,
  issueCount,
  saving,
  modelOptions,
  chatBusy,
  chatUnread,
  versions = [],
  onTab,
  onChange,
  onSave,
  onRun,
  onChat,
  onRollbackVersion,
}: {
  slug: string;
  graph: WorkflowGraph;
  tab: ProjectTab;
  counts: { runs: number; agents: number; integrations: number };
  dirty: boolean;
  issueCount: number;
  saving: boolean;
  modelOptions: string[];
  chatBusy?: boolean;
  chatUnread?: boolean;
  versions?: WorkflowVersion[];
  onTab(tab: ProjectTab): void;
  onChange(patch: Partial<WorkflowGraph>): void;
  onSave(): void;
  onRun(): void;
  onChat(): void;
  onRollbackVersion?(version: number): void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const updateTabOverflow = useCallback(() => {
    const element = navRef.current;
    if (!element) return;
    const left = element.scrollLeft > 4;
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 4;
    setTabOverflow((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);

  useEffect(() => {
    const element = navRef.current;
    if (!element) return;
    updateTabOverflow();
    element.addEventListener("scroll", updateTabOverflow, { passive: true });
    window.addEventListener("resize", updateTabOverflow);
    return () => {
      element.removeEventListener("scroll", updateTabOverflow);
      window.removeEventListener("resize", updateTabOverflow);
    };
  }, [updateTabOverflow]);

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    updateTabOverflow();
  }, [tab, updateTabOverflow]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function focusFirstMenuItem() {
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (current + delta + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  }

  function closeVersions() {
    setVersionsOpen(false);
    menuButtonRef.current?.focus();
  }

  function closeSettings() {
    setSettingsOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b border-line bg-ink/90 px-3 lg:px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link className="shrink-0 text-xs text-accent hover:underline" to="/projects">
            ← Proyectos
          </Link>
          <span className="text-xs text-muted">/</span>
          <strong className="max-w-[120px] truncate text-sm text-slate-100 min-[1400px]:max-w-[240px]" title={graph.name}>
            {graph.name}
          </strong>
          <span className="hidden text-[11px] text-muted 2xl:inline">{slug}</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <nav
            ref={navRef}
            className="flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Secciones del proyecto"
          >
            {TABS.map(([key, label]) => {
              const count = key === "runs" ? counts.runs : key === "agents" ? counts.agents : key === "configuration" ? counts.integrations : undefined;
              const showCount = count !== undefined && count > 0;
              return (
                <button
                  key={key}
                  type="button"
                  data-active={tab === key}
                  className={`shrink-0 rounded-md border px-2 py-1.5 text-xs transition ${
                    tab === key
                      ? "border-line bg-panel-2 text-slate-100"
                      : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
                  }`}
                  onClick={() => onTab(key)}
                >
                  {label}
                  {showCount ? ` (${count})` : ""}
                </button>
              );
            })}
          </nav>
          {tabOverflow.left && (
            <span className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-ink to-transparent" />
          )}
          {tabOverflow.right && (
            <span className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-ink to-transparent" />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {issueCount > 0 && (
            <span className={statusBadge("paused")} title="Hay conexiones o nodos que requieren atención">
              {issueCount} {issueCount === 1 ? "problema" : "problemas"}
            </span>
          )}
          {dirty && (
            <span
              role="status"
              aria-label="Cambios sin guardar"
              title="Cambios sin guardar"
              className="grid h-5 w-5 place-items-center rounded-full border border-warn/40 bg-warn/10 text-[11px] font-semibold text-warn"
            >
              !
            </span>
          )}
          <div ref={menuRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              className={`${buttonGhost} !px-2`}
              aria-label="Más acciones del flujo"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Más acciones del flujo"
              onClick={() => setMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setMenuOpen(true);
                  focusFirstMenuItem();
                }
              }}
            >
              ...
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="Más acciones del flujo"
                className="absolute right-0 top-full z-50 mt-2 flex min-w-[210px] flex-col gap-1 rounded-xl border border-line bg-panel p-1.5 shadow-2xl"
                onKeyDown={onMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-panel-2 focus:bg-panel-2 focus:outline-none"
                  onClick={() => {
                    setMenuOpen(false);
                    setVersionsOpen(true);
                  }}
                >
                  Versiones del flujo{versions.length > 0 ? ` (v${versions[0]!.version})` : ""}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-panel-2 focus:bg-panel-2 focus:outline-none"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  Ajustes del flujo
                </button>
              </div>
            )}
          </div>
          <button type="button" className={button} onClick={onSave} disabled={saving}>
            Guardar<span className="hidden min-[1400px]:inline"> flujo</span>
          </button>
          <button type="button" className={buttonPrimary} onClick={onRun}>
            Ejecutar
          </button>
          <button
            type="button"
            className={button}
            onClick={onChat}
            title={chatBusy ? "El agente está trabajando" : chatUnread ? "Hay una respuesta nueva" : undefined}
          >
            Agente
            {(chatBusy || chatUnread) && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  chatBusy ? "animate-pulse bg-accent motion-reduce:animate-none" : "bg-ok"
                }`}
              />
            )}
          </button>
        </div>
      </header>

      {settingsOpen && (
        <Modal title="Ajustes del flujo" onClose={closeSettings} size="md">
          <label>
            Descripción
            <textarea
              rows={3}
              value={graph.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Describe qué automatiza este flujo."
            />
          </label>
          <label>
            Modelo por defecto
            <select
              value={graph.defaultModel ?? ""}
              onChange={(event) => onChange({ defaultModel: event.target.value || undefined })}
            >
              <option value="">Modelo por defecto del proyecto</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted">
            Estos cambios forman parte del flujo y se persisten con <strong>Guardar flujo</strong>.
          </p>
          <div className="flex justify-end">
            <button type="button" className={button} onClick={closeSettings}>
              Listo
            </button>
          </div>
        </Modal>
      )}

      {versionsOpen && (
        <Modal title="Versiones del flujo" onClose={closeVersions} size="md">
          {versions.length === 0 ? (
            <p className="text-xs text-muted">Todavía no hay snapshots registrados para este flujo.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-2 overflow-auto">
              {versions.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-well p-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className={badge}>v{item.version}</span>
                      <strong className="text-xs text-slate-200">{item.graph.name}</strong>
                      <small className="text-[11px] text-muted">{item.graph.nodes.length} nodos</small>
                    </div>
                    <small className="text-[11px] text-muted">
                      {new Date(item.createdAt).toLocaleString()} · {item.createdBy ?? "sistema"}
                    </small>
                  </div>
                  {onRollbackVersion && (
                    <button
                      type="button"
                      className={buttonGhost}
                      onClick={() => {
                        onRollbackVersion(item.version);
                        setVersionsOpen(false);
                      }}
                    >
                      Restaurar v{item.version}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
