import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubagentProfile } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { AgentEditorModal } from "./AgentEditorModal.tsx";
import { Modal } from "./Modal.tsx";
import { NodeIcon } from "./nodes/node-icons.tsx";
import {
  agentModeLabel,
  badge,
  buttonDanger,
  buttonDangerSolid,
  buttonGhost,
  buttonPrimary,
  card,
  input,
} from "../ui.ts";

function deniedTools(agent: SubagentProfile): string[] {
  return (agent.frontmatter.permissions ?? [])
    .filter((permission) => permission.effect === "deny")
    .map((permission) => permission.resource);
}

function agentKey(agent: SubagentProfile): string {
  return `${agent.category}/${agent.role}`;
}

function AgentCard({
  agent,
  primary,
  onEdit,
  onDelete,
}: {
  agent: SubagentProfile;
  primary: boolean;
  onEdit(): void;
  onDelete(): void;
}) {
  const model = agent.frontmatter.model ?? "Heredado del flujo";
  const notebooks = agent.frontmatter.notebooks ?? [];
  const denied = deniedTools(agent);
  const notebookLabel = `${notebooks.length} ${notebooks.length === 1 ? "notebook" : "notebooks"}`;
  const deniedLabel = `${denied.length} ${denied.length === 1 ? "bloqueo" : "bloqueos"}`;
  return (
    <article
      className={`${card} gap-3 ${primary ? "!border-violet/40 !bg-violet/5" : ""}`}
      data-testid={`agent-card-${agent.category}-${agent.role}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              primary ? "bg-violet/15 text-violet" : "bg-panel-2 text-muted"
            }`}
          >
            <NodeIcon type="agent" />
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-sm text-slate-100" title={agentKey(agent)}>
              {agentKey(agent)}
            </strong>
            <span className="text-[11px] text-muted">{agentModeLabel(agent.frontmatter.mode ?? "subagent")}</span>
          </div>
        </div>
        {primary && <span className={`${badge} !border-violet/40 !text-violet`}>Principal</span>}
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted">
        {agent.frontmatter.description || "Sin descripción"}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <span className={`${badge} max-w-full`} title={model}>
          <span className="truncate">Modelo: {model}</span>
        </span>
        <span className={badge}>{notebookLabel}</span>
        <span className={badge}>{deniedLabel}</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <button type="button" className={buttonGhost} onClick={onEdit}>
          Editar
        </button>
        {!primary && (
          <button type="button" className={buttonDanger} onClick={onDelete}>
            Borrar
          </button>
        )}
      </div>
    </article>
  );
}

export function AgentCatalog({
  projectSlug,
  agents,
  modelOptions,
  isLoading = false,
  error,
}: {
  projectSlug: string;
  agents: SubagentProfile[];
  modelOptions: string[];
  isLoading?: boolean;
  error?: unknown;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ agent?: SubagentProfile } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubagentProfile>();
  const [status, setStatus] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () =>
      [...agents].sort((a, b) => {
        const aPrimary = a.frontmatter.mode === "primary" ? 0 : 1;
        const bPrimary = b.frontmatter.mode === "primary" ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        return agentKey(a).localeCompare(agentKey(b));
      }),
    [agents],
  );
  const subAgents = sorted.filter((agent) => agent.frontmatter.mode !== "primary");
  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      normalizedQuery
        ? sorted.filter((agent) => agentKey(agent).toLowerCase().includes(normalizedQuery))
        : sorted,
    [sorted, normalizedQuery],
  );

  const remove = useMutation({
    mutationFn: (agent: SubagentProfile) => api.deleteAgent(projectSlug, agent.category, agent.role),
    onSuccess: async (_result, agent) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.agents(projectSlug) }),
        queryClient.invalidateQueries({ queryKey: qk.projectSettings(projectSlug) }),
      ]);
      setStatus(`Agente ${agentKey(agent)} eliminado`);
      setRemoveError(undefined);
      setDeleteTarget(undefined);
    },
    onError: (cause) => setRemoveError(cause instanceof Error ? cause.message : "No se pudo eliminar el agente"),
  });

  const queryError = error instanceof Error ? error.message : error ? "Error al cargar agentes" : undefined;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-page font-semibold tracking-tight text-slate-100">Agentes</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              El agente principal conversa con el proyecto. Los sub-agentes se especializan por categoría y rol.
            </p>
          </div>
          <button className={buttonPrimary} onClick={() => setEditor({})}>
            Nuevo agente
          </button>
        </div>
        <div role="search" className="flex flex-wrap items-center gap-3">
          <label htmlFor="agent-catalog-search" className="sr-only">
            Buscar agentes
          </label>
          <input
            id="agent-catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o rol…"
            className={`${input} sm:max-w-xs`}
          />
          {normalizedQuery && (
            <p className="text-xs text-muted" data-testid="agent-search-count">
              {visible.length} de {sorted.length} {sorted.length === 1 ? "agente" : "agentes"}
            </p>
          )}
        </div>
      </header>

      {status && (
        <p className="text-sm text-ok" aria-live="polite">
          {status}
        </p>
      )}
      {(queryError || removeError) && (
        <p className="text-sm text-danger" role="alert">
          {removeError ?? queryError}
        </p>
      )}

      {isLoading && agents.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Cargando agentes">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${card} animate-pulse motion-reduce:animate-none`} aria-hidden>
              <div className="h-10 w-10 rounded-xl bg-panel-2" />
              <div className="h-4 w-2/3 rounded bg-panel-2" />
              <div className="h-3 w-full rounded bg-panel-2" />
              <div className="h-3 w-1/2 rounded bg-panel-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((agent) => (
            <AgentCard
              key={agentKey(agent)}
              agent={agent}
              primary={agent.frontmatter.mode === "primary"}
              onEdit={() => setEditor({ agent })}
              onDelete={() => {
                setRemoveError(undefined);
                setDeleteTarget(agent);
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && normalizedQuery && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-panel/60 px-6 py-8 text-center">
          <p className="text-sm text-slate-100">No hay agentes que coincidan con «{query.trim()}».</p>
          <button type="button" className={buttonGhost} onClick={() => setQuery("")}>
            Limpiar búsqueda
          </button>
        </div>
      )}

      {!isLoading && !normalizedQuery && subAgents.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-panel/60 px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet/10 text-violet">
            <NodeIcon type="agent" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {agents.length === 0 ? "Todavía no hay agentes" : "Sin sub-agentes todavía"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted">
              Crea un sub-agente para dividir el trabajo por categoría y rol. El agente principal seguirá coordinando el proyecto.
            </p>
          </div>
          <button className={buttonPrimary} onClick={() => setEditor({})}>
            Crear sub-agente
          </button>
        </div>
      )}

      {editor && (
        <AgentEditorModal
          projectSlug={projectSlug}
          agent={editor.agent}
          modelOptions={modelOptions}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setStatus(`Agente ${agentKey(saved)} guardado`);
            setRemoveError(undefined);
          }}
        />
      )}

      {deleteTarget && (
        <Modal title="Eliminar agente" onClose={() => setDeleteTarget(undefined)} size="sm">
          <p className="text-sm text-muted">
            ¿Eliminar <code>{agentKey(deleteTarget)}</code>? Esta acción borra el perfil del agente y no se puede deshacer.
          </p>
          {removeError && (
            <p className="text-sm text-danger" role="alert">
              {removeError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonGhost} onClick={() => setDeleteTarget(undefined)}>
              Cancelar
            </button>
            <button
              type="button"
              className={buttonDangerSolid}
              disabled={remove.isPending}
              onClick={() => remove.mutate(deleteTarget)}
            >
              {remove.isPending ? "Borrando…" : "Borrar agente"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
