import type { InputField, IntegrationRecord, NodeSpec, SubagentProfile, ValidateRule } from "@platform/shared";
import type { ModelInfo } from "../api.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { button, buttonGhost } from "../ui.ts";

function InputFieldsEditor({ fields, onChange }: { fields: InputField[]; onChange(fields: InputField[]): void }) {
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <div className="grid gap-1.5 rounded-lg border border-line bg-[#0a1120] p-2 sm:grid-cols-[1fr_100px_70px_auto]" key={index}>
          <input
            value={field.name}
            placeholder="tema"
            aria-label={`Campo ${index + 1}`}
            onChange={(event) => onChange(fields.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
          />
          <select
            value={field.type}
            aria-label={`Tipo ${index + 1}`}
            onChange={(event) =>
              onChange(fields.map((item, i) => (i === index ? { ...item, type: event.target.value as InputField["type"] } : item)))
            }
          >
            <option value="string">texto</option>
            <option value="number">número</option>
            <option value="boolean">booleano</option>
            <option value="json">JSON</option>
          </select>
          <label className="flex-row items-center gap-1 text-[11px]">
            <input
              type="checkbox"
              className="w-auto"
              checked={field.required}
              onChange={(event) =>
                onChange(fields.map((item, i) => (i === index ? { ...item, required: event.target.checked } : item)))
              }
            />
            req.
          </label>
          <button type="button" className={buttonGhost} onClick={() => onChange(fields.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${buttonGhost} self-start`}
        onClick={() => onChange([...fields, { name: "", type: "string", required: false }])}
      >
        Agregar campo
      </button>
    </div>
  );
}

function ValidateRulesEditor({ rules, onChange }: { rules: ValidateRule[]; onChange(rules: ValidateRule[]): void }) {
  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule, index) => (
        <div className="grid gap-1.5 rounded-lg border border-line bg-[#0a1120] p-2" key={index}>
          <div className="grid gap-1.5 sm:grid-cols-[1fr_100px_70px_auto]">
            <input
              value={rule.name}
              placeholder="tema"
              aria-label={`Regla ${index + 1}`}
              onChange={(event) => onChange(rules.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
            />
            <select
              value={rule.type}
              aria-label={`Tipo de regla ${index + 1}`}
              onChange={(event) =>
                onChange(rules.map((item, i) => (i === index ? { ...item, type: event.target.value as ValidateRule["type"] } : item)))
              }
            >
              <option value="string">texto</option>
              <option value="number">número</option>
              <option value="boolean">booleano</option>
              <option value="json">JSON</option>
            </select>
            <label className="flex-row items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                className="w-auto"
                checked={rule.required}
                onChange={(event) =>
                  onChange(rules.map((item, i) => (i === index ? { ...item, required: event.target.checked } : item)))
                }
              />
              req.
            </label>
            <button type="button" className={buttonGhost} onClick={() => onChange(rules.filter((_, i) => i !== index))}>
              ×
            </button>
          </div>
          <input
            value={rule.message ?? ""}
            placeholder="Mensaje: Falta el campo tema."
            aria-label={`Mensaje de regla ${index + 1}`}
            onChange={(event) => onChange(rules.map((item, i) => (i === index ? { ...item, message: event.target.value } : item)))}
          />
        </div>
      ))}
      <button
        type="button"
        className={`${buttonGhost} self-start`}
        onClick={() => onChange([...rules, { name: "", type: "string", required: true, message: "" }])}
      >
        Agregar regla
      </button>
    </div>
  );
}

export function NodeInspector({
  node,
  agents,
  models,
  integrations,
  code,
  codeDirty,
  onPatch,
  onConfig,
  onCodeChange,
  onSaveCode,
  onEnableDecisionCode,
}: {
  node: NodeSpec;
  agents: SubagentProfile[];
  models: ModelInfo[];
  integrations: IntegrationRecord[];
  code: string;
  codeDirty: boolean;
  onPatch(patch: Partial<NodeSpec>): void;
  onConfig(patch: Record<string, unknown>): void;
  onCodeChange(value: string): void;
  onSaveCode(): void;
  onEnableDecisionCode(): void;
}) {
  const modelOptions = models.map((model) => `${model.providerID}/${model.modelID}`);
  const isCode = node.type === "code" || (node.type === "decision" && node.config.mode === "code");

  return (
    <div className="grid gap-3 md:grid-cols-2">
          <label>
            Etiqueta
            <input value={node.label ?? ""} onChange={(event) => onPatch({ label: event.target.value })} />
          </label>

          {node.type === "trigger" && (
            <>
              <label>
                Entrada del flujo
                <select value={String(node.config.kind ?? "manual")} onChange={(event) => onConfig({ kind: event.target.value })}>
                  <option value="manual">Manual (canvas / formulario)</option>
                  <option value="integration">Integración (Telegram, WhatsApp, API)</option>
                  <option value="schedule">Programado (cron)</option>
                  <option value="webhook">Webhook HTTP</option>
                </select>
              </label>
              {String(node.config.kind ?? "manual") === "schedule" && (
                <label>
                  Expresión Cron (5 campos UTC)
                  <input
                    value={String(node.config.cron ?? "")}
                    onChange={(event) => onConfig({ cron: event.target.value })}
                    placeholder="0 9 * * 1-5"
                  />
                </label>
              )}
              {String(node.config.kind ?? "manual") === "webhook" && (
                <label>
                  Alias de secreto del webhook
                  <input
                    value={String(node.config.secretAlias ?? "")}
                    onChange={(event) => onConfig({ secretAlias: event.target.value })}
                    placeholder="wh-secret"
                  />
                </label>
              )}
              {String(node.config.kind ?? "manual") === "integration" && (
                <>
                  <label>
                    Integración del proyecto
                    <select
                      value={String(node.config.integrationId ?? "")}
                      onChange={(event) => onConfig({ integrationId: event.target.value })}
                    >
                      <option value="">Selecciona una integración</option>
                      {integrations.map((integration) => (
                        <option key={integration.id} value={integration.id}>
                          {integration.name} · {integration.kind}
                        </option>
                      ))}
                    </select>
                    {integrations.length === 0 && (
                      <small className="text-warn">No hay integraciones del proyecto. Créalas en la pestaña Recursos.</small>
                    )}
                  </label>
                  <label>
                    Evento
                    <input
                      value={String(node.config.event ?? "message.received")}
                      onChange={(event) => onConfig({ event: event.target.value })}
                      placeholder="message.received"
                    />
                  </label>
                  <p className="text-xs text-muted md:col-span-2">
                    El modo del canal se define en <strong>Recursos</strong>. En modo agente, el mensaje va al agente principal; en modo flujo, dispara este trigger.
                  </p>
                </>
              )}
              {!["manual", "integration", "schedule", "webhook"].includes(String(node.config.kind ?? "manual")) && (
                <p className="text-xs text-warn md:col-span-2">
                  Este tipo de entrada no tiene un ejecutor activo. Cambia a manual, integración, programado o webhook.
                </p>
              )}
              {["manual", "webhook"].includes(String(node.config.kind ?? "manual")) && (
                <div className="flex flex-col gap-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs text-muted">Datos de entrada manual</strong>
                    <small className="text-[11px] text-muted">El formulario de “Ejecutar” y la validación inicial se generan desde aquí.</small>
                  </div>
                  <InputFieldsEditor
                    fields={((node.config.inputSchema as { fields?: InputField[] } | undefined)?.fields ?? []) as InputField[]}
                    onChange={(fields) => onConfig({ inputSchema: { fields } })}
                  />
                </div>
              )}
            </>
          )}

          {node.type === "http" && (
            <>
              <label>
                Método
                <select value={String(node.config.method ?? "GET")} onChange={(event) => onConfig({ method: event.target.value })}>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                URL
                <input
                  value={String(node.config.url ?? "")}
                  onChange={(event) => onConfig({ url: event.target.value })}
                  placeholder="https://api.example.com"
                />
              </label>
              <label className="md:col-span-2">
                Headers (JSON)
                <textarea rows={2} value={String(node.config.headers ?? "{}")} onChange={(event) => onConfig({ headers: event.target.value })} />
              </label>
              <label className="md:col-span-2">
                Body (JSON o texto)
                <textarea rows={2} value={String(node.config.body ?? "")} onChange={(event) => onConfig({ body: event.target.value })} />
              </label>
            </>
          )}

          {node.type === "delay" && (
            <label>
              Espera (ms, máx. 60000)
              <input
                type="number"
                min={0}
                max={60000}
                value={Number(node.config.ms ?? 1000)}
                onChange={(event) => onConfig({ ms: Number(event.target.value) })}
              />
            </label>
          )}

          {node.type === "transform" && (
            <>
              <label className="md:col-span-2">
                Plantilla / mapeo JSON
                <textarea
                  rows={5}
                  value={String(node.config.template ?? "")}
                  onChange={(event) => onConfig({ template: event.target.value })}
                  placeholder={'{"nombre":"{{input.name}}","activo":true}'}
                />
              </label>
              <p className="text-xs text-muted md:col-span-2">Usa {"{{input.campo}}"} para interpolar la entrada.</p>
            </>
          )}

          {node.type === "validate" && (
            <div className="flex flex-col gap-2 md:col-span-2">
              <div>
                <strong className="text-xs text-muted">Reglas de validación</strong>
                <p className="text-[11px] text-muted">
                  Usa este nodo para validar datos ya transformados o entradas de canales. La entrada del lanzamiento manual se define en el trigger.
                </p>
              </div>
              <ValidateRulesEditor
                rules={(node.config.rules as ValidateRule[] | undefined) ?? []}
                onChange={(rules) => onConfig({ rules })}
              />
            </div>
          )}

          {node.type === "decision" && (
            <>
              <label>
                Modo
                <select
                  value={String(node.config.mode ?? (node.codeFile ? "code" : "condition"))}
                  onChange={(event) => {
                    if (event.target.value === "code") onEnableDecisionCode();
                    else onConfig({ mode: "condition" });
                  }}
                >
                  <option value="condition">Condición visual</option>
                  <option value="code">Código TypeScript</option>
                </select>
              </label>
              {node.config.mode !== "code" && (
                <>
                  <label>
                    Campo de entrada
                    <input
                      value={String((node.config.condition as { field?: string })?.field ?? "")}
                      onChange={(event) => onConfig({ condition: { ...(node.config.condition as object), field: event.target.value } })}
                      placeholder="status"
                    />
                  </label>
                  <label>
                    Operador
                    <select
                      value={String((node.config.condition as { operator?: string })?.operator ?? "equals")}
                      onChange={(event) => onConfig({ condition: { ...(node.config.condition as object), operator: event.target.value } })}
                    >
                      <option value="equals">igual a</option>
                      <option value="not_equals">distinto de</option>
                      <option value="contains">contiene</option>
                      <option value="greater_than">mayor que</option>
                      <option value="less_than">menor que</option>
                      <option value="exists">existe</option>
                      <option value="truthy">es verdadero</option>
                    </select>
                  </label>
                  <label>
                    Valor
                    <input
                      value={String((node.config.condition as { value?: unknown })?.value ?? "")}
                      onChange={(event) => onConfig({ condition: { ...(node.config.condition as object), value: event.target.value } })}
                    />
                  </label>
                  <p className="text-xs text-muted md:col-span-2">Conecta las salidas sí / no a los siguientes nodos.</p>
                </>
              )}
            </>
          )}

          {node.type === "agent" && (
            <>
              <p className="text-[11px] text-muted md:col-span-2">
                Este nodo usa un sub-agente del proyecto. El chat del proyecto usa el agente principal, que es otro perfil.
              </p>
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
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
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
              <label>
                Instrucción adicional
                <textarea
                  rows={2}
                  value={String(node.config.instruction ?? "")}
                  onChange={(event) => onConfig({ instruction: event.target.value })}
                />
              </label>
              <label className="flex-row items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  className="w-auto"
                  checked={node.config.strictGrounding === true}
                  onChange={(event) => onConfig({ strictGrounding: event.target.checked })}
                />
                Respuestas fundamentadas solo en Notebooks
              </label>
              <div className="flex flex-col gap-2 md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs text-muted">Esquema de salida estructurada (JSON)</strong>
                  <small className="text-[11px] text-muted">
                    Si agregas campos, el agente responderá en JSON validado para el siguiente nodo.
                  </small>
                </div>
                <InputFieldsEditor
                  fields={((node.config.outputSchema as { fields?: InputField[] } | undefined)?.fields ?? []) as InputField[]}
                  onChange={(fields) => onConfig({ outputSchema: { fields } })}
                />
              </div>
            </>
          )}

          {node.type === "approval" && (
            <>
              <label className="md:col-span-2">
                Mensaje de aprobación
                <textarea rows={2} value={String(node.config.message ?? "")} onChange={(event) => onConfig({ message: event.target.value })} />
              </label>
              <label className="flex-row items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  className="w-auto"
                  checked={node.config.autoApprove === true}
                  onChange={(event) => onConfig({ autoApprove: event.target.checked })}
                />
                Aprobar automáticamente (solo pruebas)
              </label>
            </>
          )}

          {["code", "http", "decision", "agent", "validate"].includes(node.type) && (
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
                  onChange={(event) => onPatch({ retryPolicy: { maxRetries: Number(event.target.value) } })}
                />
              </label>
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
