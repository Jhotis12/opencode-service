import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PlatformToolNameSchema,
  type PermissionRule,
  type PlatformToolName,
  type SubagentProfile,
} from "@platform/shared";
import { api, type ModelInfo } from "../api.ts";
import { qk } from "../query.ts";
import { Field } from "./Field.tsx";
import { Modal } from "./Modal.tsx";
import { MultiSelect } from "./MultiSelect.tsx";
import { Select } from "./Select.tsx";
import { inheritModelOption, modelOptions, type SelectOption } from "./select/options.ts";
import { notifyError } from "./Toast.tsx";
import { buttonDanger, buttonGhost, buttonPrimary } from "../ui.ts";

type AgentMode = "primary" | "subagent" | "all";
type ToolEffect = PermissionRule["effect"];

const INHERIT_MODEL_LABEL = "Heredar del flujo";

/** Visible copy comes from the design standard; the values are the API's strings. */
const MODE_OPTIONS: readonly SelectOption[] = [
  { value: "subagent", label: "Sub-agente" },
  { value: "primary", label: "Principal" },
  { value: "all", label: "Principal y sub-agente" },
];

function isAgentMode(value: string | undefined): value is AgentMode {
  return value === "primary" || value === "subagent" || value === "all";
}

const PLATFORM_TOOL_META: Record<PlatformToolName, { label: string; description: string }> = {
  workflow_list: {
    label: "Listar proyectos",
    description: "Lista los proyectos y automatizaciones visibles para el agente.",
  },
  workflow_get: {
    label: "Leer un flujo",
    description: "Lee el grafo workflow.json de un proyecto.",
  },
  workflow_upsert: {
    label: "Guardar flujos",
    description: "Crea o reemplaza el grafo de un flujo tras validar el esquema y el DAG.",
  },
  workflow_trigger: {
    label: "Ejecutar flujos",
    description: "Lanza una ejecución de un flujo con una carga JSON.",
  },
  workflow_runs: {
    label: "Ver ejecuciones",
    description: "Consulta las últimas ejecuciones con sus pasos y errores.",
  },
  project_overview: {
    label: "Resumen de la plataforma",
    description: "Resume proyectos, ejecuciones recientes, errores e integraciones.",
  },
  subagent_upsert: {
    label: "Guardar agentes",
    description: "Crea o actualiza los agentes Markdown del proyecto.",
  },
  subagent_list: {
    label: "Listar agentes",
    description: "Lista los agentes y categorías de un proyecto.",
  },
  integration_list: {
    label: "Listar integraciones",
    description: "Consulta las integraciones conectadas, sin secretos.",
  },
  kb_search: {
    label: "Buscar conocimiento",
    description: "Busca en los notebooks del proyecto y devuelve citas.",
  },
  db_query: {
    label: "Consultar la base de datos",
    description: "Ejecuta SQL contra una integración de base de datos del proyecto.",
  },
  notify: {
    label: "Enviar notificaciones",
    description: "Envía mensajes por una integración de canal del proyecto.",
  },
  health_summary: {
    label: "Salud de la plataforma",
    description: "Resume la salud, las ejecuciones recientes y los errores.",
  },
};

export const PLATFORM_TOOL_OPTIONS: { name: PlatformToolName; label: string; description: string }[] =
  PlatformToolNameSchema.options.map((name) => ({ name, ...PLATFORM_TOOL_META[name] }));

export const TOOL_EFFECT_OPTIONS: { value: ToolEffect; label: string }[] = [
  { value: "allow", label: "Permitir" },
  { value: "deny", label: "Denegar" },
  { value: "ask", label: "Preguntar" },
];

const TOOL_EFFECT_CHOICES: { value: "" | ToolEffect; label: string }[] = [
  { value: "", label: "Sin regla" },
  ...TOOL_EFFECT_OPTIONS,
];

export function toolEffectLabel(effect: ToolEffect): string {
  return TOOL_EFFECT_OPTIONS.find((option) => option.value === effect)?.label ?? effect;
}

/** Bare and platform_-prefixed resources (both accepted by evaluateToolPermission)
 * resolve to their tool; unresolvable rules are surfaced, never dropped silently. */
export function permissionRulesToToolEffects(permissions: PermissionRule[] | undefined): {
  effects: Partial<Record<PlatformToolName, ToolEffect>>;
  unknownRules: PermissionRule[];
} {
  const known = new Set<string>(PlatformToolNameSchema.options);
  const resolveTool = (resource: string): PlatformToolName | undefined => {
    if (known.has(resource)) return resource as PlatformToolName;
    const bare = resource.replace(/^platform_/, "");
    if (known.has(bare)) return bare as PlatformToolName;
    return undefined;
  };
  const precedence: Record<ToolEffect, number> = { ask: 1, allow: 2, deny: 3 };
  const effects: Partial<Record<PlatformToolName, ToolEffect>> = {};
  const unknownRules: PermissionRule[] = [];
  for (const rule of permissions ?? []) {
    const tool = resolveTool(rule.resource);
    if (!tool) {
      unknownRules.push(rule);
      continue;
    }
    const current = effects[tool];
    if (!current || precedence[rule.effect] > precedence[current]) effects[tool] = rule.effect;
  }
  return { effects, unknownRules };
}

export function toolEffectsToPermissionRules(
  effects: Partial<Record<PlatformToolName, ToolEffect>>,
): PermissionRule[] {
  return PlatformToolNameSchema.options
    .filter((tool) => effects[tool])
    .map((tool) => ({ action: "tool", resource: tool, effect: effects[tool] as ToolEffect }));
}

type AgentFormState = {
  category: string;
  role: string;
  description: string;
  body: string;
  model: string;
  mode: AgentMode;
  notebooks: string[];
  toolEffects: Partial<Record<PlatformToolName, ToolEffect>>;
  unknownRules: PermissionRule[];
};

function toForm(agent?: SubagentProfile): AgentFormState {
  const { effects, unknownRules } = permissionRulesToToolEffects(agent?.frontmatter.permissions);
  return {
    category: agent?.category ?? "",
    role: agent?.role ?? "",
    description: agent?.frontmatter.description ?? "",
    body: agent?.body ?? "",
    model: agent?.frontmatter.model ?? "",
    mode: agent?.frontmatter.mode ?? "subagent",
    notebooks: [...(agent?.frontmatter.notebooks ?? [])],
    toolEffects: effects,
    unknownRules,
  };
}

const effectPill =
  "flex cursor-pointer items-center rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:font-medium has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

export function AgentEditorModal({
  projectSlug,
  agent,
  models,
  onClose,
  onSaved,
}: {
  projectSlug: string;
  agent?: SubagentProfile;
  models: readonly ModelInfo[];
  onClose(): void;
  onSaved?(agent: SubagentProfile): void;
}) {
  const queryClient = useQueryClient();
  const permissionGroupId = useId();
  const editing = Boolean(agent);
  const [form, setForm] = useState<AgentFormState>(() => toForm(agent));
  // Shared cache contract: ProjectKnowledgePanel and ProjectOverviewPage store the
  // unwrapped NotebookSummary[] under this same key, and React Query keys by key
  // alone, so this consumer must unwrap the envelope too or poison their cache.
  const notebooksQuery = useQuery({
    queryKey: qk.notebooks(projectSlug),
    queryFn: () => api.listNotebooks(projectSlug).then((result) => result.data),
  });
  const notebookOptions: readonly SelectOption[] = (notebooksQuery.data ?? []).map((notebook) => ({
    value: notebook.slug,
    label: notebook.name,
    ...(notebook.description ? { description: notebook.description } : {}),
    keywords: [notebook.slug],
  }));
  // A catalogue entry without a name falls back to its ref. A model-less agent inherits
  // the flow model, so the empty row names the flow.
  const modelPickerOptions: readonly SelectOption[] = [
    ...modelOptions(models).map((choice) => ({ ...choice, label: choice.label || choice.value })),
    inheritModelOption(INHERIT_MODEL_LABEL),
  ];

  const identityValid =
    /^[a-z0-9][a-z0-9-]*$/.test(form.category.trim()) &&
    /^[a-z0-9][a-z0-9-]*$/.test(form.role.trim());
  const canSave =
    identityValid &&
    Boolean(form.description.trim()) &&
    Boolean(form.body.trim()) &&
    form.unknownRules.length === 0;

  const save = useMutation({
    mutationFn: () => {
      return api.upsertAgent(projectSlug, form.category.trim(), form.role.trim(), {
        description: form.description.trim(),
        body: form.body,
        // Inheriting the flow model means the key never reaches the request body.
        ...(form.model ? { model: form.model } : {}),
        mode: form.mode,
        notebooks: form.notebooks,
        permissions: toolEffectsToPermissionRules(form.toolEffects),
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
    onError: (cause) => notifyError(cause instanceof Error ? cause.message : "No se pudo guardar el agente"),
  });

  function patch(patch: Partial<AgentFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function setToolEffect(tool: PlatformToolName, effect: ToolEffect | undefined) {
    setForm((current) => {
      const toolEffects = { ...current.toolEffects };
      if (effect) toolEffects[tool] = effect;
      else delete toolEffects[tool];
      return { ...current, toolEffects };
    });
  }

  function removeUnknownRule(index: number) {
    setForm((current) => ({ ...current, unknownRules: current.unknownRules.filter((_, i) => i !== index) }));
  }

  function submit() {
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
              <Select
                label="Modo"
                options={MODE_OPTIONS}
                value={form.mode}
                emptyValue="undefined"
                onChange={(mode) => {
                  if (isAgentMode(mode)) patch({ mode });
                }}
              />
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
              <Select
                label="Modelo"
                options={modelPickerOptions}
                value={form.model}
                emptyValue=""
                onChange={(model) => patch({ model: model ?? "" })}
              />
            </Field>
            <MultiSelect
              label="Notebooks"
              placeholder="Selecciona notebooks"
              options={notebookOptions}
              value={form.notebooks}
              onChange={(notebooks) => patch({ notebooks })}
              loading={notebooksQuery.isLoading}
              loadingLabel="Cargando notebooks…"
              loadError={notebooksQuery.isError ? "No se pudieron cargar los notebooks." : null}
              onRetry={() => void notebooksQuery.refetch()}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Permisos por herramienta</h3>
            <p className="text-xs text-muted">
              Elige Permitir, Denegar o Preguntar para cada herramienta. Denegar rechaza la llamada con HTTP 403; sin
              regla, la herramienta sigue el comportamiento predeterminado.
            </p>
          </div>

          {form.unknownRules.length > 0 && (
            <div
              className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3"
              data-testid="unknown-permission-rules"
            >
              <p className="text-xs text-danger" role="alert">
                Hay reglas con herramientas fuera del catálogo (
                {form.unknownRules.map((rule) => rule.resource).join(", ")}). Quítalas para poder guardar; el resto de
                permisos se mantiene.
              </p>
              {form.unknownRules.map((rule, index) => (
                <div
                  key={`${rule.resource}-${rule.action}-${index}`}
                  className="flex items-center justify-between gap-2 text-xs text-slate-300"
                >
                  <span>
                    <code className="rounded bg-well px-1 py-0.5">{rule.resource}</code> · {rule.action} ·{" "}
                    {toolEffectLabel(rule.effect)}
                  </span>
                  <button type="button" className={buttonDanger} onClick={() => removeUnknownRule(index)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col">
            {PLATFORM_TOOL_OPTIONS.map((tool) => (
              <fieldset
                key={tool.name}
                data-testid={`permission-row-${tool.name}`}
                className="grid gap-x-4 gap-y-1.5 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <legend className="text-xs font-medium text-slate-300">
                  {tool.label} <code className="text-[11px] font-normal text-muted">{tool.name}</code>
                  <span className="mt-0.5 block text-[11px] font-normal text-muted">{tool.description}</span>
                </legend>
                <div className="flex flex-wrap items-center gap-1">
                  {TOOL_EFFECT_CHOICES.map((option) => (
                    <label key={option.value || "sin-regla"} className={effectPill}>
                      <input
                        type="radio"
                        name={`${permissionGroupId}-${tool.name}`}
                        value={option.value}
                        checked={form.toolEffects[tool.name] === (option.value || undefined)}
                        onChange={() =>
                          setToolEffect(tool.name, option.value ? option.value : undefined)
                        }
                        className="sr-only"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </section>

      </form>
    </Modal>
  );
}
