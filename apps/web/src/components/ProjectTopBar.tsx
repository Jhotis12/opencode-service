import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import type { WorkflowGraph, WorkflowVersion } from "@platform/shared";
import type { ModelInfo } from "../api.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Field } from "./Field.tsx";
import { Modal } from "./Modal.tsx";
import { OverflowMenu } from "./OverflowMenu.tsx";
import { Select } from "./Select.tsx";
import { WorkflowLibraryPanel } from "./WorkflowLibraryPanel.tsx";
import { inheritModelOption, modelOptions } from "./select/options.ts";
import { badge, button, buttonGhost, buttonPrimary, focusRing, statusBadge } from "../ui.ts";

export type ProjectTab = "overview" | "flow" | "runs" | "agents" | "knowledge" | "integrations" | "settings";

const TABS: Array<[ProjectTab, string]> = [
  ["overview", "Resumen"],
  ["flow", "Flujo"],
  ["runs", "Ejecuciones"],
  ["agents", "Agentes"],
  ["knowledge", "Conocimiento"],
  ["integrations", "Integraciones"],
  ["settings", "Ajustes"],
];

export function isProjectTab(value: string): value is ProjectTab {
  return TABS.some(([key]) => key === value);
}

// This bar sets the flow default, so its empty choice falls back to the project default.
const INHERIT_MODEL_LABEL = "Heredar del proyecto";

const TOP_BAR_ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-4 w-4 sm:hidden",
  "aria-hidden": true,
};

/** Icon-only fallback for the flow actions under 640 px; the text label returns at `sm`. */
function TopBarActionIcon({ name }: { name: "save" | "play" | "chat" }) {
  switch (name) {
    case "save":
      return (
        <svg {...TOP_BAR_ICON_PROPS}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M8.5 4v5h5.5V4M8.5 20v-6h7v6" />
        </svg>
      );
    case "play":
      return (
        <svg {...TOP_BAR_ICON_PROPS}>
          <path d="M8 5.5 19 12 8 18.5z" />
        </svg>
      );
    case "chat":
      return (
        <svg {...TOP_BAR_ICON_PROPS}>
          <path d="M4.5 5h15v10.5H9.5L4.5 19z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
      );
  }
}

export function projectTabPath(slug: string, tab: ProjectTab): string {
  return `/projects/${slug}/${tab}`;
}

export function activeProjectTab(pathname: string): ProjectTab {
  const section = pathname.split("/").pop() ?? "";
  return isProjectTab(section) ? section : "overview";
}

export function ProjectTopBar({
  slug,
  graph,
  tab,
  counts,
  dirty,
  issueCount,
  saving,
  models,
  chatBusy,
  chatUnread,
  versions = [],
  navigationBlocked = false,
  onNavigateBlocked,
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
  models: readonly ModelInfo[];
  chatBusy?: boolean;
  chatUnread?: boolean;
  versions?: WorkflowVersion[];
  navigationBlocked?: boolean;
  onNavigateBlocked?(target: string): void;
  onChange(patch: Partial<WorkflowGraph>): void;
  onSave(): void;
  onRun(): void;
  onChat(): void;
  onRollbackVersion?(version: number): void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<WorkflowVersion>();
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });
  const modelChoices = modelOptions(models);
  const modelPickerOptions = [...modelChoices, inheritModelOption(INHERIT_MODEL_LABEL)];
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!dirty || saving || issueCount > 0) return;
      onSave();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dirty, saving, issueCount, onSave]);

  function closeVersions() {
    setVersionsOpen(false);
  }

  function closeSettings() {
    setSettingsOpen(false);
  }

  function guardNavigation(event: ReactMouseEvent<HTMLAnchorElement>, target: string) {
    if (!navigationBlocked) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigateBlocked?.(target);
  }

  function closeLibrary() {
    setLibraryOpen(false);
  }

  return (
    <>
      <header
        data-testid="project-top-bar"
        className="flex flex-col gap-1.5 border-b border-line bg-ink/90 px-3 py-1.5 sm:h-14 sm:flex-row sm:items-center sm:gap-2 sm:py-0 lg:px-4"
      >
        <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
          <Link
            className="shrink-0 text-xs text-accent hover:underline"
            to="/projects"
            onClick={(event) => guardNavigation(event, "/projects")}
          >
            ← Proyectos
          </Link>
          <span className="text-xs text-muted">/</span>
          <strong className="max-w-[120px] truncate text-sm text-slate-100 max-sm:min-w-0 max-sm:max-w-full max-sm:flex-1 min-[1400px]:max-w-[240px]" title={graph.name}>
            {graph.name}
          </strong>
          <span className="hidden text-[11px] text-muted 2xl:inline">{slug}</span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:flex-1 sm:gap-2">
          <div className="relative min-w-0 flex-1">
            <nav
              ref={navRef}
              className="flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Secciones del proyecto"
            >
              {TABS.map(([key, label]) => {
                const count =
                  key === "runs" ? counts.runs : key === "agents" ? counts.agents : key === "integrations" ? counts.integrations : undefined;
                const showCount = count !== undefined && count > 0;
                return (
                  <Link
                    key={key}
                    to={projectTabPath(slug, key)}
                    data-active={tab === key}
                    aria-current={tab === key ? "page" : undefined}
                    className={`shrink-0 rounded-md border px-2 py-1.5 text-xs transition ${focusRing} ${
                      tab === key
                        ? "border-line bg-panel-2 text-slate-100"
                        : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
                    }`}
                    onClick={(event) => guardNavigation(event, projectTabPath(slug, key))}
                  >
                    {label}
                    {showCount ? ` (${count})` : ""}
                  </Link>
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

          <div data-testid="top-bar-actions" className="flex shrink-0 items-center gap-1.5 max-sm:relative">
            {issueCount > 0 && (
              <span
                className={statusBadge("paused")}
                title="Hay conexiones o nodos que requieren atención"
                aria-label={`${issueCount} ${issueCount === 1 ? "problema" : "problemas"}`}
              >
                <span aria-hidden="true" className="sm:hidden">{issueCount}</span>
                <span aria-hidden="true" className="max-sm:hidden">
                  {issueCount} {issueCount === 1 ? "problema" : "problemas"}
                </span>
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
            {/* Below `sm` the shared panel anchors to this cluster instead of the
                trigger (`className="max-sm:static"` drops the trigger wrapper's
                positioning), so its right edge lands on the header padding and the
                210px panel cannot spill past the left viewport edge at 320px. */}
            <OverflowMenu
              label="Más acciones del flujo"
              className="max-sm:static"
              triggerClassName="max-sm:border max-sm:border-line max-sm:bg-panel-2"
              items={[
                {
                  id: "versions",
                  label: `Versiones del flujo${versions.length > 0 ? ` (v${versions[0]!.version})` : ""}`,
                  onSelect: () => setVersionsOpen(true),
                },
                { id: "library", label: "Biblioteca del flujo", onSelect: () => setLibraryOpen(true) },
                { id: "settings", label: "Ajustes del flujo", onSelect: () => setSettingsOpen(true) },
              ]}
            />
            <button
              type="button"
              className={`${button} max-sm:px-2`}
              onClick={onSave}
              disabled={saving || issueCount > 0}
              aria-label="Guardar flujo"
              title={
                issueCount > 0
                  ? `Corrige ${issueCount === 1 ? "el problema" : `los ${issueCount} problemas`} del flujo para guardar.`
                  : undefined
              }
            >
              <TopBarActionIcon name="save" />
              <span className="max-sm:sr-only">
                Guardar<span className="hidden min-[1400px]:inline"> flujo</span>
              </span>
            </button>
            <button
              type="button"
              className={`${buttonPrimary} max-sm:px-2`}
              onClick={onRun}
              aria-label="Ejecutar"
            >
              <TopBarActionIcon name="play" />
              <span className="max-sm:sr-only">Ejecutar</span>
            </button>
            <button
              type="button"
              className={`${button} max-sm:px-2`}
              onClick={onChat}
              aria-label="Agente"
              title={chatBusy ? "El agente está trabajando" : chatUnread ? "Hay una respuesta nueva" : undefined}
            >
              <TopBarActionIcon name="chat" />
              <span className="max-sm:sr-only">Agente</span>
              {(chatBusy || chatUnread) && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    chatBusy ? "animate-pulse bg-accent motion-reduce:animate-none" : "bg-ok"
                  }`}
                />
              )}
            </button>
          </div>
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
          <Field id="flow-default-model" label="Modelo por defecto">
            <Select
              label="Modelo por defecto"
              options={modelPickerOptions}
              value={graph.defaultModel ?? ""}
              emptyValue=""
              onChange={(value) => onChange({ defaultModel: value || undefined })}
            />
          </Field>
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

      {libraryOpen && (
        <WorkflowLibraryPanel
          graph={graph}
          onImport={(next) => onChange(next)}
          onClose={closeLibrary}
        />
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
                        setVersionsOpen(false);
                        setRollbackTarget(item);
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

      {rollbackTarget && (
        <ConfirmDialog
          title={`Restaurar v${rollbackTarget.version}`}
          confirmLabel={`Restaurar v${rollbackTarget.version}`}
          onCancel={() => {
            setRollbackTarget(undefined);
            setVersionsOpen(true);
          }}
          onConfirm={() => {
            onRollbackVersion?.(rollbackTarget.version);
            setRollbackTarget(undefined);
          }}
        >
          <p className="text-sm text-muted">
            Se reemplazará el borrador actual por la v{rollbackTarget.version} guardada el{" "}
            {new Date(rollbackTarget.createdAt).toLocaleString()}. Los cambios no guardados se descartan.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
