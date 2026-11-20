import type {
  IntegrationRecord,
  NodeSpec,
  ProjectDestination,
  SubagentProfile,
} from "@platform/shared";
import type { ModelInfo, NotebookSummary } from "../api.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { Field } from "./Field.tsx";
import { MultiSelect } from "./MultiSelect.tsx";
import { NodeConfigFields } from "./NodeConfigFields.tsx";
import { Select } from "./Select.tsx";
import { modelOptions, type SelectOption } from "./select/options.ts";
import { button } from "../ui.ts";

const EMPTY_AGENT_LABEL = "Selecciona un agente";
const INHERIT_MODEL_LABEL = "Heredar del flujo";
const EMPTY_TARGET_LABEL = "Selecciona un nodo";

/** `""` is the empty choice: it means "no policy", so `onError` stays undefined. */
const ERROR_STRATEGY_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Detener el run" },
  { value: "continue", label: "Continuar con el error" },
  { value: "route", label: "Derivar a otro nodo" },
];

export function NodeInspector({
  node,
  nodes,
  agents,
  models,
  notebooks = [],
  integrations,
  destinations,
  code,
  codeDirty,
  scheduleNextRun,
  onPatch,
  onConfig,
  onReplaceConfig,
  onCodeChange,
  onSaveCode,
  onEnableDecisionCode,
}: {
  node: NodeSpec;
  nodes: NodeSpec[];
  agents: SubagentProfile[];
  models: ModelInfo[];
  /** Project notebook catalogue; the inspector only knows the ids it was given. */
  notebooks?: readonly NotebookSummary[];
  integrations: IntegrationRecord[];
  destinations: ProjectDestination[];
  code: string;
  codeDirty: boolean;
  scheduleNextRun?: string;
  onPatch(patch: Partial<NodeSpec>): void;
  onConfig(patch: Record<string, unknown>): void;
  onReplaceConfig(config: Record<string, unknown>): void;
  onCodeChange(value: string): void;
  onSaveCode(): void;
  onEnableDecisionCode(): void;
}) {
  const isCode = node.type === "code" || (node.type === "decision" && node.config.mode === "code");
  const selectedModel = models.find((model) => `${model.providerID}/${model.modelID}` === node.modelOverride);
  const agentOptions: readonly SelectOption[] = [
    { value: "", label: EMPTY_AGENT_LABEL },
    ...agents.map((agent) => {
      const ref = `${agent.category}/${agent.role}`;
      return { value: ref, label: ref };
    }),
  ];
  // The inherit row is the empty value, so `orderOptions` hoists it above every group.
  const modelPickerOptions: readonly SelectOption[] = [
    ...modelOptions(models).map((choice) => ({ ...choice, label: choice.label || choice.value })),
    { value: "", label: INHERIT_MODEL_LABEL },
  ];
  const notebookOptions: readonly SelectOption[] = notebooks.map((notebook) => ({
    value: notebook.slug,
    label: notebook.name,
    ...(notebook.description ? { description: notebook.description } : {}),
    keywords: [notebook.slug],
  }));
  const errorTargets = nodes.filter((candidate) => candidate.id !== node.id && candidate.type !== "trigger");
  const errorTargetOptions: readonly SelectOption[] = [
    { value: "", label: EMPTY_TARGET_LABEL },
    ...errorTargets.map((candidate) => ({ value: candidate.id, label: candidate.label ?? candidate.id })),
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label>
        Etiqueta
        <input value={node.label ?? ""} onChange={(event) => onPatch({ label: event.target.value })} />
      </label>

      {node.type === "agent" && (
        <>
          <Field id="node-agent" label="Agente">
            <Select
              label="Agente"
              options={agentOptions}
              value={node.agentId ?? ""}
              emptyValue="undefined"
              onChange={(agentId) => onPatch({ agentId })}
            />
          </Field>
          <Field id="node-model" label="Modelo del nodo">
            <Select
              label="Modelo del nodo"
              options={modelPickerOptions}
              value={node.modelOverride ?? ""}
              emptyValue="undefined"
              searchable
              onChange={(modelOverride) => onPatch({ modelOverride })}
            />
          </Field>
          {node.modelOverride && selectedModel?.input && !selectedModel.input.includes("image") && (
            <p className="text-xs text-warn md:col-span-2">
              Este modelo no reporta entrada de imagen; los adjuntos pueden no analizarse.
            </p>
          )}
          <MultiSelect
            label="Notebooks"
            placeholder="Selecciona notebooks"
            options={notebookOptions}
            value={node.notebookIds}
            onChange={(notebookIds) => onPatch({ notebookIds })}
          />
        </>
      )}

      <NodeConfigFields
        node={node}
        integrations={integrations}
        destinations={destinations}
        scheduleNextRun={scheduleNextRun}
        onConfig={onConfig}
        onReplaceConfig={onReplaceConfig}
        onEnableDecisionCode={onEnableDecisionCode}
      />

      {["code", "http", "database", "notify", "decision", "agent", "validate"].includes(node.type) && (
        <>
          <label>
            Timeout (ms)
            <input type="number" value={node.timeoutMs} onChange={(event) => onPatch({ timeoutMs: Number(event.target.value) })} />
          </label>
          <label>
            Reintentos
            <input
              type="number"
              min={0}
              max={5}
              value={node.retryPolicy.maxRetries}
              onChange={(event) => onPatch({ retryPolicy: { ...node.retryPolicy, maxRetries: Number(event.target.value) } })}
            />
          </label>
          <label>
            Backoff (ms)
            <input
              type="number"
              min={0}
              max={60000}
              value={node.retryPolicy.backoffMs ?? 500}
              onChange={(event) => onPatch({ retryPolicy: { ...node.retryPolicy, backoffMs: Number(event.target.value) } })}
            />
          </label>
        </>
      )}

      {node.type !== "trigger" && (
        <>
          <Field id="node-error-strategy" label="Si falla">
            <Select
              label="Si falla"
              options={ERROR_STRATEGY_OPTIONS}
              value={node.onError?.strategy ?? ""}
              emptyValue="undefined"
              onChange={(next) =>
                onPatch({
                  onError:
                    next === "continue"
                      ? { strategy: "continue" }
                      : next === "route"
                        ? { strategy: "route", target: node.onError?.target }
                        : undefined,
                })
              }
            />
          </Field>
          {node.onError?.strategy === "route" && (
            <Field
              id="node-error-target"
              label="Nodo de error"
              error={node.onError.target ? undefined : "Selecciona el nodo que recibirá el error."}
            >
              <Select
                label="Nodo de error"
                options={errorTargetOptions}
                value={node.onError.target ?? ""}
                emptyValue="undefined"
                onChange={(target) => onPatch({ onError: { strategy: "route", target } })}
              />
            </Field>
          )}
        </>
      )}

      {isCode && (
        <div className="md:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{node.codeFile}</p>
            <button className={button} disabled={!codeDirty} onClick={onSaveCode}>
              Guardar código
            </button>
          </div>
          <CodeEditor value={code} onChange={onCodeChange} />
        </div>
      )}
    </div>
  );
}
