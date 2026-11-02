import type { InputField, InputSchema, ValidateConfig, ValidateRule } from "@platform/shared";

export class WorkflowInputValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`invalid workflow input: ${issues.join("; ")}`);
    this.name = "WorkflowInputValidationError";
  }
}

export class NodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeValidationError";
  }
}

function valueAt(payload: unknown, field: string): unknown {
  return field
    .replace(/^input\.?/, "")
    .split(".")
    .reduce<unknown>((current, key) => {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, payload);
}

function checkField(field: InputField | ValidateRule, payload: unknown): string | undefined {
  const value = valueAt(payload, field.name);
  const required = field.required === true;
  if (value === undefined || value === null || value === "") {
    const message = "message" in field ? field.message : undefined;
    return required ? (message ?? `Falta el campo ${field.name}.`) : undefined;
  }
  switch (field.type) {
    case "string":
      return typeof value === "string" ? undefined : `El campo ${field.name} debe ser texto.`;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? undefined : `El campo ${field.name} debe ser numérico.`;
    case "boolean":
      return typeof value === "boolean" ? undefined : `El campo ${field.name} debe ser verdadero o falso.`;
    case "json":
      return typeof value === "object" ? undefined : `El campo ${field.name} debe ser un objeto o lista JSON.`;
    default:
      return undefined;
  }
}

export function validateInputPayload(schema: InputSchema | undefined, payload: unknown): void {
  if (!schema || schema.fields.length === 0) return;
  const issues: string[] = [];
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    issues.push("La entrada debe ser un objeto JSON.");
  } else {
    for (const field of schema.fields) {
      const issue = checkField(field, payload);
      if (issue) issues.push(issue);
    }
  }
  if (issues.length > 0) throw new WorkflowInputValidationError(issues);
}

export function validateNodeRules(config: ValidateConfig, payload: unknown): void {
  for (const rule of config.rules) {
    const issue = checkField(rule, payload);
    if (issue) throw new NodeValidationError(issue);
  }
}
