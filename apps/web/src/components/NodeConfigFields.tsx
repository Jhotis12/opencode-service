import { useEffect, useState } from "react";
import {
  NODE_CONFIG_REGISTRY,
  integrationEvents,
  validateNodeConfig,
  type ConfigField,
  type InputField,
  type IntegrationRecord,
  type NodeSpec,
  type ProjectDestination,
  type ValidateRule,
} from "@platform/shared";
import { getConfigValue, isFieldVisible, setConfigValue, toList } from "./config-field-utils.ts";
import { Field } from "./Field.tsx";
import { buttonGhost, fieldError } from "../ui.ts";

function InputFieldsEditor({ fields, onChange }: { fields: InputField[]; onChange(fields: InputField[]): void }) {
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <div className="grid gap-1.5 rounded-lg border border-line bg-well p-2 sm:grid-cols-[1fr_100px_70px_auto]" key={index}>
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
        <div className="grid gap-1.5 rounded-lg border border-line bg-well p-2" key={index}>
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

function JsonField({
  id,
  describedBy,
  value,
  onChange,
}: {
  id: string;
  describedBy?: string;
  value: unknown;
  onChange(value: unknown): void;
}) {
  const [raw, setRaw] = useState(() => (typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value, null, 2)));
  const [error, setError] = useState<string>();
  return (
    <>
      <textarea
        rows={4}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={[describedBy, error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        value={raw}
        onChange={(event) => {
          const text = event.target.value;
          setRaw(text);
          try {
            onChange(text.trim() ? JSON.parse(text) : undefined);
            setError(undefined);
          } catch {
            setError("JSON inválido.");
          }
        }}
      />
      {error && <p id={`${id}-error`} className={fieldError}>{error}</p>}
    </>
  );
}

function DatabaseStatementsField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange(value: unknown): void;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(Array.isArray(value) ? value : [], null, 2));
  const [error, setError] = useState<string>();
  return (
    <>
      <textarea
        rows={6}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        value={raw}
        onChange={(event) => {
          const text = event.target.value;
          setRaw(text);
          try {
            const parsed = JSON.parse(text) as unknown;
            if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Agrega al menos una sentencia.");
            if (!parsed.every((item) => item && typeof item === "object" && typeof (item as { sql?: unknown }).sql === "string")) {
              throw new Error("Cada sentencia necesita un campo sql de texto.");
            }
            setError(undefined);
            onChange(parsed);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "JSON inválido.");
          }
        }}
        placeholder={'[{"sql":"select * from leads where id = ?","params":["{{input.id}}"]}]'}
      />
      {error && <p id={`${id}-error`} className={fieldError}>{error}</p>}
    </>
  );
}

export function NodeConfigFields({
  node,
  integrations,
  destinations,
  scheduleNextRun,
  onConfig,
  onReplaceConfig,
  onEnableDecisionCode,
}: {
  node: NodeSpec;
  integrations: IntegrationRecord[];
  destinations: ProjectDestination[];
  scheduleNextRun?: string;
  onConfig(patch: Record<string, unknown>): void;
  onReplaceConfig(config: Record<string, unknown>): void;
  onEnableDecisionCode(): void;
}) {
  const definition = NODE_CONFIG_REGISTRY[node.type];
  const config = node.config;
  const errors = new Map<string, string>();
  for (const field of definition.fields) {
    if (!isFieldVisible(config, field)) continue;
    const value = getConfigValue(config, field.key);
    if (field.required && (value === undefined || value === "" || (Array.isArray(value) && value.length === 0))) {
      errors.set(field.key, "Este campo es obligatorio.");
    }
  }
  const validation = validateNodeConfig(node.type, config);
  if (!validation.success) {
    for (const problem of validation.error.issues) {
      const path = problem.path.join(".");
      const field = definition.fields.find(
        (candidate) => path === candidate.key || path.startsWith(`${candidate.key}.`),
      );
      if (field && !errors.has(field.key)) errors.set(field.key, problem.message);
    }
  }
  const selectedIntegration = integrations.find((integration) => integration.id === config.integrationId);
  const eventOptions = selectedIntegration ? integrationEvents(selectedIntegration.kind) : ["message.received"];

  function set(field: ConfigField, value: unknown) {
    onConfig({ [field.key]: value });
  }

  function changeTriggerKind(next: string) {
    if (next === String(config.kind ?? "manual")) return;
    const incompatible = Boolean(config.integrationId || config.cron || config.runAt || config.secretAlias);
    if (incompatible && !window.confirm("Cambiar el tipo de trigger descartará la configuración incompatible. ¿Continuar?")) {
      return;
    }
    const base = structuredClone(NODE_CONFIG_REGISTRY.trigger.defaults);
    const nextConfig: Record<string, unknown> = { ...base, kind: next };
    if (next === "integration") nextConfig.accepts = ["text"];
    if (config.inputSchema) nextConfig.inputSchema = config.inputSchema;
    onReplaceConfig(nextConfig);
  }

  function renderField(field: ConfigField) {
    if (!isFieldVisible(config, field)) return null;
    const value = getConfigValue(config, field.key);
    const error = errors.get(field.key);
    const fieldId = `node-config-${field.key}`;
    const errorId = `${fieldId}-error`;
    const helpId = field.help ? `${fieldId}-help` : undefined;
    const help = field.help ? <small id={helpId} className="text-[11px] text-muted">{field.help}</small> : null;

    if (field.type === "custom") {
      if (field.widget === "speech-model-picker") {
        const sources = integrations.filter(
          (integration) =>
            integration.kind === "speech" &&
            (typeof config.integrationId !== "string" || !config.integrationId || integration.id === config.integrationId),
        );
        const models = [
          ...new Set(
            sources.flatMap((integration) =>
              Array.isArray(integration.config.models) ? integration.config.models.map(String) : [],
            ),
          ),
        ];
        const current = String(value ?? "");
        if (models.length > 0) {
          const options = current && !models.includes(current) ? [current, ...models] : models;
          return (
            <label key={field.key}>
              {field.label}
              <select aria-label={field.label} value={current} onChange={(event) => set(field, event.target.value || undefined)}>
                <option value="">Heredar de la conexión</option>
                {options.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              {help}
            </label>
          );
        }
        return (
          <Field key={field.key} id={fieldId} label={field.label} hint={field.help} error={error}>
            <input
              value={current}
              placeholder={field.placeholder}
              onChange={(event) => set(field, event.target.value || undefined)}
            />
          </Field>
        );
      }
      if (field.widget === "voice-picker") {
        const sources = integrations.filter(
          (integration) =>
            integration.kind === "speech" &&
            (typeof config.integrationId !== "string" || !config.integrationId || integration.id === config.integrationId),
        );
        const voices = [
          ...new Set(
            sources.flatMap((integration) =>
              Array.isArray(integration.config.voices) ? integration.config.voices.map(String) : [],
            ),
          ),
        ];
        const current = String(value ?? "");
        if (voices.length > 0) {
          const options = current && !voices.includes(current) ? [current, ...voices] : voices;
          return (
            <label key={field.key}>
              {field.label}
              <select aria-label={field.label} value={current} onChange={(event) => set(field, event.target.value || undefined)}>
                <option value="">Heredar de la conexión</option>
                {options.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </select>
              {help}
            </label>
          );
        }
        return (
          <label key={field.key}>
            {field.label}
            <input
              id={fieldId}
              aria-label={field.label}
              aria-invalid={Boolean(error)}
              aria-describedby={[helpId, error ? errorId : ""].filter(Boolean).join(" ") || undefined}
              value={current}
              placeholder={field.placeholder}
              list="node-voice-suggestions"
              onChange={(event) => set(field, event.target.value || undefined)}
            />
            <datalist id="node-voice-suggestions">
              {(field.suggestions ?? []).map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            {help}
            {error && <p id={errorId} className={fieldError}>{error}</p>}
          </label>
        );
      }
      if (field.widget === "integration-picker") {
        const options = integrations.filter(
          (integration) =>
            (!field.integrationKinds || field.integrationKinds.includes(integration.kind)) &&
            (!field.integrationCapability || integration.capabilities.includes(field.integrationCapability)),
        );
        return (
          <Field key={field.key} id={fieldId} label={field.label} hint={field.help} error={error}>
            <select value={String(value ?? "")} onChange={(event) => set(field, event.target.value || undefined)}>
              <option value="">Selecciona una integración</option>
              {options.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name} · {integration.kind}
                </option>
              ))}
            </select>
          </Field>
        );
      }
      if (field.widget === "channel-event") {
        return (
          <label key={field.key}>
            {field.label}
            <select value={String(value ?? "message.received")} onChange={(event) => set(field, event.target.value)}>
              {eventOptions.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </label>
        );
      }
      if (field.widget === "media-kinds") {
        const selected = toList(value);
        return (
          <div className="flex flex-col gap-1 md:col-span-2" key={field.key}>
            <strong className="text-xs text-muted">{field.label}</strong>
            <div className="flex flex-wrap gap-3">
              {["text", "image", "audio"].map((kind) => (
                <label key={kind} className="flex-row items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-auto"
                    checked={selected.includes(kind)}
                    onChange={(event) => {
                      const next = event.target.checked ? [...selected, kind] : selected.filter((item) => item !== kind);
                      set(field, next);
                    }}
                  />
                  {kind === "text" ? "Texto" : kind === "image" ? "Imagen" : "Audio"}
                </label>
              ))}
            </div>
            {help}
          </div>
        );
      }
      if (field.widget === "input-schema") {
        const fields = ((value as { fields?: InputField[] } | undefined)?.fields ?? []) as InputField[];
        return (
          <div className="flex flex-col gap-2 md:col-span-2" key={field.key}>
            <strong className="text-xs text-muted">{field.label}</strong>
            <InputFieldsEditor fields={fields} onChange={(next) => set(field, { fields: next })} />
          </div>
        );
      }
      if (field.widget === "validate-rules") {
        return (
          <div className="flex flex-col gap-2 md:col-span-2" key={field.key}>
            <strong className="text-xs text-muted">{field.label}</strong>
            <ValidateRulesEditor rules={(value as ValidateRule[] | undefined) ?? []} onChange={(next) => set(field, next)} />
          </div>
        );
      }
      if (field.widget === "database-statements") {
        return (
          <label className="md:col-span-2" key={field.key}>
            {field.label}
            <DatabaseStatementsField id={fieldId} value={value} onChange={(next) => set(field, next)} />
          </label>
        );
      }
      if (field.widget === "condition") {
        const condition = (value as { field?: string; operator?: string; value?: unknown } | undefined) ?? {};
        return (
          <div className="grid gap-2 md:col-span-2 md:grid-cols-3" key={field.key}>
            <label>
              Campo de entrada
              <input
                value={condition.field ?? ""}
                onChange={(event) => set(field, { ...condition, field: event.target.value })}
                placeholder="status"
              />
            </label>
            <label>
              Operador
              <select
                value={condition.operator ?? "equals"}
                onChange={(event) => set(field, { ...condition, operator: event.target.value })}
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
                value={String(condition.value ?? "")}
                onChange={(event) => set(field, { ...condition, value: event.target.value })}
              />
            </label>
          </div>
        );
      }
      if (field.widget === "destination-picker") {
        return (
          <label key={field.key}>
            {field.label}
            <input
              aria-label={field.label}
              value={String(value ?? "")}
              onChange={(event) => set(field, event.target.value || undefined)}
              placeholder={field.placeholder}
              list="node-destinations"
            />
            <datalist id="node-destinations">
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.label} · {destination.value}
                </option>
              ))}
            </datalist>
            {help}
          </label>
        );
      }
      if (field.widget === "workflow-version") {
        return (
          <label key={field.key}>
            {field.label}
            <input
              value={String(value ?? "")}
              onChange={(event) => set(field, event.target.value || undefined)}
              placeholder="ID de workflow_versions"
            />
          </label>
        );
      }
    }

    if (node.type === "decision" && field.key === "mode") {
      return (
        <label key={field.key}>
          {field.label}
          <select
            aria-label={field.label}
            value={String(config.mode ?? (node.codeFile ? "code" : "condition"))}
            onChange={(event) => {
              if (event.target.value === "code") onEnableDecisionCode();
              else onConfig({ mode: "condition" });
            }}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.key === "kind") {
      return (
        <label key={field.key}>
          {field.label}
          <select aria-label={field.label} value={String(value ?? "manual")} onChange={(event) => changeTriggerKind(event.target.value)}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "boolean") {
      return (
        <label key={field.key} className="flex-row items-center gap-2">
          <input
            type="checkbox"
            className="w-auto"
            checked={value === true}
            onChange={(event) => set(field, event.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label key={field.key}>
          {field.label}
          <select aria-label={field.label} value={String(value ?? "")} onChange={(event) => set(field, event.target.value)}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {help}
        </label>
      );
    }

    if (field.type === "number") {
      return (
        <label key={field.key}>
          {field.label}
          <input
            aria-label={field.label}
            type="number"
            value={value === undefined ? "" : Number(value)}
            onChange={(event) => set(field, event.target.value === "" ? undefined : Number(event.target.value))}
          />
          {help}
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <label key={field.key} className="md:col-span-2">
          {field.label}
          <textarea
            aria-label={field.label}
            rows={3}
            value={String(value ?? "")}
            onChange={(event) => set(field, event.target.value)}
          />
          {help}
        </label>
      );
    }

    if (field.type === "json") {
      return (
        <label key={field.key} className="md:col-span-2">
          {field.label}
          <JsonField id={fieldId} describedBy={helpId} value={value} onChange={(next) => set(field, next)} />
          {help}
        </label>
      );
    }

    return (
      <Field key={field.key} id={fieldId} label={field.label} hint={field.help} error={error}>
        <input
          type={field.type === "url" ? "url" : field.type === "email" ? "email" : "text"}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => set(field, event.target.value || undefined)}
        />
      </Field>
    );
  }

  return (
    <>
      {definition.fields.map(renderField)}
      {node.type === "trigger" && String(config.kind ?? "manual") === "schedule" && scheduleNextRun && (
        <p className="text-xs text-muted md:col-span-2">
          Próxima ejecución: <strong>{new Date(scheduleNextRun).toLocaleString()}</strong>
        </p>
      )}
      {node.type === "decision" && (
        <p className="text-xs text-muted md:col-span-2">Conecta las salidas sí / no a los siguientes nodos.</p>
      )}
      {node.type === "agent" && (
        <p className="text-[11px] text-muted md:col-span-2">
          Este nodo usa un sub-agente del proyecto. El chat del proyecto usa el agente principal, que es otro perfil.
        </p>
      )}
    </>
  );
}
