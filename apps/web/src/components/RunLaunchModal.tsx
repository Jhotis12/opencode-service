import { useMemo, useState } from "react";
import { InputSchemaSchema, type WorkflowGraph } from "@platform/shared";
import { Modal } from "./Modal.tsx";
import { Field } from "./Field.tsx";
import { buttonPrimary } from "../ui.ts";

export function RunLaunchModal({
  graph,
  onClose,
  onLaunch,
}: {
  graph: WorkflowGraph;
  onClose(): void;
  onLaunch(payload: unknown): void;
}) {
  const schema = useMemo(() => {
    const trigger = graph.nodes.find((node) => node.type === "trigger");
    const parsed = InputSchemaSchema.safeParse(trigger?.config.inputSchema);
    return parsed.success ? parsed.data : { fields: [] };
  }, [graph]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(schema.fields.map((field) => [field.name, ""])),
  );
  const [json, setJson] = useState("{}");
  const [error, setError] = useState<string>();

  function submit() {
    try {
      if (schema.fields.length === 0) {
        onLaunch(JSON.parse(json) as unknown);
        return;
      }
      const payload: Record<string, unknown> = {};
      for (const field of schema.fields) {
        const raw = values[field.name] ?? "";
        if (!raw && field.required) throw new Error(`Falta el campo ${field.label ?? field.name}.`);
        if (!raw) continue;
        if (field.type === "number") payload[field.name] = Number(raw);
        else if (field.type === "boolean") payload[field.name] = raw === "true";
        else if (field.type === "json") payload[field.name] = JSON.parse(raw);
        else payload[field.name] = raw;
      }
      onLaunch(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Entrada inválida");
    }
  }

  return (
    <Modal title="Ejecutar flujo" onClose={onClose} size="md">
      <p className="text-xs text-muted">
        Completa la entrada documentada por el trigger. El servidor valida el mismo contrato antes de ejecutar cualquier paso.
      </p>
      {schema.fields.length === 0 ? (
        <Field id="run-input-json" label="Entrada JSON" hint="Objeto JSON que recibirá el trigger.">
          <textarea rows={8} value={json} onChange={(event) => setJson(event.target.value)} />
        </Field>
      ) : (
        <div className="flex flex-col gap-3">
          {schema.fields.map((field) => (
            <Field
              key={field.name}
              id={`run-input-${field.name}`}
              label={`${field.label ?? field.name}${field.required ? " *" : ""}`}
              hint={field.description}
            >
              {field.type === "boolean" ? (
                <select value={values[field.name] ?? ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>
                  <option value="">Sin valor</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : field.type === "json" ? (
                <textarea
                  rows={3}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                  placeholder={field.example === undefined ? "" : JSON.stringify(field.example)}
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                  placeholder={field.example === undefined ? "" : String(field.example)}
                />
              )}
            </Field>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className={buttonPrimary} onClick={submit}>
        Ejecutar
      </button>
    </Modal>
  );
}
