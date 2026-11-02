import { useState } from "react";
import { Link } from "react-router-dom";
import type { WorkflowGraph, WorkflowVersion } from "@platform/shared";
import { Modal } from "./Modal.tsx";
import { NavIcon } from "./NavIcon.tsx";
import { badge, button, buttonGhost, buttonPrimary, statusBadge } from "../ui.ts";

export type ProjectTab = "canvas" | "runs" | "agents" | "knowledge" | "resources" | "settings";

const TABS: Array<[ProjectTab, string]> = [
  ["canvas", "Canvas"],
  ["runs", "Ejecuciones"],
  ["agents", "Agentes"],
  ["knowledge", "Conocimiento"],
  ["resources", "Recursos"],
  ["settings", "Ajustes"],
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

  return (
    <>
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-[#080d18]/90 px-3 py-2 lg:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="shrink-0 text-xs text-accent hover:underline" to="/projects">
            ← Proyectos
          </Link>
          <span className="text-xs text-muted">/</span>
          <strong className="max-w-[240px] truncate text-sm text-slate-100" title={graph.name}>
            {graph.name}
          </strong>
          <span className="hidden text-[11px] text-muted 2xl:inline">{slug}</span>
        </div>

        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1"
          aria-label="Secciones del proyecto"
        >
          {TABS.map(([key, label]) => {
            const count = key === "runs" ? counts.runs : key === "agents" ? counts.agents : key === "resources" ? counts.integrations : undefined;
            const showCount = count !== undefined && count > 0;
            return (
              <button
                key={key}
                type="button"
                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs transition ${
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

        <div className="flex flex-wrap items-center gap-1.5">
          {issueCount > 0 && (
            <span className={statusBadge("paused")} title="Hay conexiones o nodos que requieren atención">
              {issueCount} {issueCount === 1 ? "problema" : "problemas"}
            </span>
          )}
          {dirty && <span className={statusBadge("paused")}>Cambios sin guardar</span>}
          <button
            type="button"
            className={`${buttonGhost} !px-2`}
            aria-label="Versiones del flujo"
            title="Versiones del flujo"
            onClick={() => setVersionsOpen(true)}
          >
            Versiones{versions.length > 0 ? ` (v${versions[0]!.version})` : ""}
          </button>
          <button
            type="button"
            className={`${buttonGhost} !px-2`}
            aria-label="Ajustes del flujo"
            title="Ajustes del flujo"
            onClick={() => setSettingsOpen(true)}
          >
            <NavIcon name="settings" />
          </button>
          <button type="button" className={button} onClick={onSave} disabled={saving}>
            Guardar flujo
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
        <Modal title="Ajustes del flujo" onClose={() => setSettingsOpen(false)} size="md">
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
            <button type="button" className={button} onClick={() => setSettingsOpen(false)}>
              Listo
            </button>
          </div>
        </Modal>
      )}

      {versionsOpen && (
        <Modal title="Versiones del flujo" onClose={() => setVersionsOpen(false)} size="md">
          {versions.length === 0 ? (
            <p className="text-xs text-muted">Todavía no hay snapshots registrados para este flujo.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-2 overflow-auto">
              {versions.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[#0a1120] p-2.5"
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
