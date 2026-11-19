import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubagentProfile } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { Field } from "./Field.tsx";
import { Modal } from "./Modal.tsx";
import { buttonGhost, buttonPrimary } from "../ui.ts";

type AgentMode = "primary" | "subagent" | "all";

type AgentFormState = {
  category: string;
  role: string;
  description: string;
  body: string;
  model: string;
  mode: AgentMode;
  notebooks: string;
  deniedTools: string;
};

function toForm(agent?: SubagentProfile): AgentFormState {
  return {
    category: agent?.category ?? "",
    role: agent?.role ?? "",
    description: agent?.frontmatter.description ?? "",
    body: agent?.body ?? "",
    model: agent?.frontmatter.model ?? "",
    mode: agent?.frontmatter.mode ?? "subagent",
    notebooks: (agent?.frontmatter.notebooks ?? []).join(", "),
    deniedTools: (agent?.frontmatter.permissions ?? [])
      .filter((permission) => permission.effect === "deny")
      .map((permission) => permission.resource)
      .join(", "),
  };
}

export function AgentEditorModal({
  projectSlug,
  agent,
  modelOptions,
  onClose,
  onSaved,
}: {
  projectSlug: string;
  agent?: SubagentProfile;
  modelOptions: string[];
  onClose(): void;
  onSaved?(agent: SubagentProfile): void;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(agent);
  const [form, setForm] = useState<AgentFormState>(() => toForm(agent));
  const [error, setError] = useState<string>();

  const identityValid =
    /^[a-z0-9][a-z0-9-]*$/.test(form.category.trim()) &&
    /^[a-z0-9][a-z0-9-]*$/.test(form.role.trim());
  const canSave = identityValid && Boolean(form.description.trim()) && Boolean(form.body.trim());

  const save = useMutation({
    mutationFn: () => {
      const denied = form.deniedTools
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return api.upsertAgent(projectSlug, form.category.trim(), form.role.trim(), {
        description: form.description.trim(),
        body: form.body,
        model: form.model || undefined,
        mode: form.mode,
        notebooks: form.notebooks
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        ...(denied.length > 0
          ? {
              permissions: denied.map((resource) => ({
                action: "tool",
                resource,
                effect: "deny" as const,
              })),
            }
          : {}),
      });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.agents(projectSlug) }),
        queryClient.invalidateQueries({ queryKey: qk.projectSettings(projectSlug) }),
      ]);
      onSaved?.(saved);
      onClose();
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el agente"),
  });

  function patch(patch: Partial<AgentFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit() {
    setError(undefined);
    if (!canSave) return;
    save.mutate();
  }

  return (
    <Modal
      title={editing ? "Editar agente" : "Nuevo agente"}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={buttonPrimary} disabled={!canSave || save.isPending} onClick={submit}>
            {save.isPending ? "Guardando…" : "Guardar agente"}
          </button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        aria-label={editing ? "Editar agente" : "Nuevo agente"}
        aria-describedby={error ? "agent-form-error" : undefined}
      >
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Identidad</h3>
            <p className="text-xs text-muted">Categoría y rol forman el identificador del agente.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="agent-category" label="Categoría" hint="Minúsculas, números y guiones.">
              <input
                value={form.category}
                onChange={(event) => patch({ category: event.target.value })}
                placeholder="ventas"
                disabled={editing}
                autoFocus={!editing}
              />
            </Field>
            <Field id="agent-role" label="Rol" hint="Se muestra como categoría/rol.">
              <input
                value={form.role}
                onChange={(event) => patch({ role: event.target.value })}
                placeholder="calificador"
                disabled={editing}
              />
            </Field>
          </div>
          {editing && (
            <p className="text-[11px] text-muted">
              El identificador no cambia al editar. Para renombrarlo, crea un agente nuevo.
            </p>
          )}
          <Field id="agent-description" label="Descripción">
            <input
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="Califica leads entrantes"
            />
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Comportamiento</h3>
            <p className="text-xs text-muted">Define cómo se comporta el agente y qué instrucciones recibe.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="agent-mode" label="Modo">
              <select value={form.mode} onChange={(event) => patch({ mode: event.target.value as AgentMode })}>
                <option value="subagent">Sub-agente</option>
                <option value="primary">Principal</option>
                <option value="all">Principal y sub-agente</option>
              </select>
            </Field>
          </div>
          <Field id="agent-body" label="Instrucciones (.md)">
            <textarea
              rows={8}
              value={form.body}
              onChange={(event) => patch({ body: event.target.value })}
              placeholder="Eres el especialista de…"
            />
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Modelo y conocimiento</h3>
            <p className="text-xs text-muted">El modelo vacío hereda el del flujo. Los notebooks son opcionales.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="agent-model" label="Modelo">
              <select value={form.model} onChange={(event) => patch({ model: event.target.value })}>
                <option value="">Heredar del flujo</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="agent-notebooks" label="Notebooks (separados por coma)">
              <input
                value={form.notebooks}
                onChange={(event) => patch({ notebooks: event.target.value })}
                placeholder="manual-ventas, politicas"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Permisos</h3>
            <p className="text-xs text-muted">Las herramientas bloqueadas se rechazan con HTTP 403.</p>
          </div>
          <Field id="agent-denied-tools" label="Herramientas bloqueadas (separadas por coma)">
            <input
              value={form.deniedTools}
              onChange={(event) => patch({ deniedTools: event.target.value })}
              placeholder="workflow_upsert, subagent_upsert, db_query"
            />
          </Field>
        </section>

        {error && (
          <p id="agent-form-error" className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

      </form>
    </Modal>
  );
}
