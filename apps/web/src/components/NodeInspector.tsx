import type {
  IntegrationRecord,
  NodeSpec,
  ProjectDestination,
  SubagentProfile,
} from "@platform/shared";
import type { ModelInfo } from "../api.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { NodeConfigFields } from "./NodeConfigFields.tsx";
import { button } from "../ui.ts";

export function NodeInspector({
  node,
  nodes,
  agents,
  models,
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

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label>
        Etiqueta
        <input value={node.label ?? ""} onChange={(event) => onPatch({ label: event.target.value })} />
      </label>

      {node.type === "agent" && (
        <>
          <label>
            Agente
            <select value={node.agentId ?? ""} onChange={(event) => onPatch({ agentId: event.target.value })}>
              <option value="">Selecciona un agente</option>
              {agents.map((agent) => (
                <option key={`${agent.category}/${agent.role}`} value={`${agent.category}/${agent.role}`}>
                  {agent.category}/{agent.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modelo del nodo
            <select value={node.modelOverride ?? ""} onChange={(event) => onPatch({ modelOverride: event.target.value || undefined })}>
              <option value="">Heredar del flujo</option>
              {models.map((model) => {
                const ref = `${model.providerID}/${model.modelID}`;
                return (
                  <option key={ref} value={ref}>
                    {ref}
                    {model.input?.includes("image") ? " · visión" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          {node.modelOverride && selectedModel?.input && !selectedModel.input.includes("image") && (
            <p className="text-xs text-warn md:col-span-2">
              Este modelo no reporta entrada de imagen; los adjuntos pueden no analizarse.
            </p>
          )}
          <label>
            Notebooks (coma)
            <input
              value={node.notebookIds.join(", ")}
              onChange={(event) =>
                onPatch({
                  notebookIds: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
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
          <label>
            Si falla
            <select
              value={node.onError?.strategy ?? "stop"}
              onChange={(event) => {
                const strategy = event.target.value as "stop" | "continue" | "route";
                onPatch({
                  onError:
                    strategy === "stop"
                      ? undefined
                      : strategy === "continue"
                        ? { strategy }
                        : { strategy, target: node.onError?.target },
                });
              }}
            >
              <option value="stop">Detener el run</option>
              <option value="continue">Continuar con el error</option>
              <option value="route">Derivar a otro nodo</option>
            </select>
          </label>
          {node.onError?.strategy === "route" && (
            <label>
              Nodo de error
              <select
                value={node.onError.target ?? ""}
                onChange={(event) =>
                  onPatch({ onError: { strategy: "route", target: event.target.value || undefined } })
                }
              >
                <option value="">Selecciona un nodo</option>
                {nodes
                  .filter((candidate) => candidate.id !== node.id && candidate.type !== "trigger")
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label ?? candidate.id}
                    </option>
                  ))}
              </select>
              {!node.onError.target && (
                <small className="text-warn">Selecciona el nodo que recibirá el error.</small>
              )}
            </label>
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
