import {
  CreateIntegrationInputSchema,
  findSecretLikeFields,
  integrationConfigDefinition,
  validateIntegrationConfig,
  type IntegrationCapability,
  type IntegrationKind,
  type IntegrationScope,
} from "@platform/shared";

export class IntegrationValidationError extends Error {
  constructor(
    public readonly code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "IntegrationValidationError";
  }
}

const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;
const DATABASE_KINDS = new Set<IntegrationKind>(["postgres", "mysql", "mssql", "sqlite"]);

export function withDatabaseDefaults<T extends { kind: IntegrationKind; config: Record<string, unknown> }>(input: T): T {
  if (!DATABASE_KINDS.has(input.kind) || input.config.access !== undefined) return input;
  return {
    ...input,
    config: { ...input.config, access: "read", maxRows: 1_000, allowDdl: false },
  };
}

export function requiredSecretRefs(kind: IntegrationKind, config: Record<string, unknown>): string[] {
  return integrationConfigDefinition(kind).requiredSecrets?.(config) ?? [];
}

export interface ValidatedIntegrationInput {
  scope: IntegrationScope;
  projectSlug?: string;
  kind: IntegrationKind;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  secretRefs: Record<string, string>;
  capabilities: IntegrationCapability[];
}

export function validateIntegrationInput(
  input: unknown,
  options: { expectedScope?: IntegrationScope; expectedProjectSlug?: string } = {},
): ValidatedIntegrationInput {
  const parsed = CreateIntegrationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new IntegrationValidationError("VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  const value = parsed.data;
  if (options.expectedScope && value.scope !== options.expectedScope) {
    throw new IntegrationValidationError("FORBIDDEN", `integration scope must be ${options.expectedScope}`);
  }
  if (options.expectedProjectSlug && value.projectSlug !== options.expectedProjectSlug) {
    throw new IntegrationValidationError("FORBIDDEN", "integration must belong to the requested project");
  }
  if (value.scope === "project" && !value.projectSlug) {
    throw new IntegrationValidationError("VALIDATION_ERROR", "project integrations require projectSlug");
  }
  if (value.scope === "global" && value.projectSlug) {
    throw new IntegrationValidationError("VALIDATION_ERROR", "global integrations cannot have projectSlug");
  }
  if (!SLUG.test(value.slug)) {
    throw new IntegrationValidationError("VALIDATION_ERROR", "invalid integration slug");
  }

  const definition = integrationConfigDefinition(value.kind);
  const config = validateIntegrationConfig(value.kind, value.config);
  if (!config.success) {
    throw new IntegrationValidationError(
      "VALIDATION_ERROR",
      `invalid ${value.kind} configuration: ${config.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const normalizedConfig = config.data as Record<string, unknown>;
  const secretLike = findSecretLikeFields(normalizedConfig);
  if (secretLike.length > 0) {
    throw new IntegrationValidationError(
      "VALIDATION_ERROR",
      `secret-like fields must use the secret store, not config: ${secretLike.join(", ")}`,
    );
  }
  if (DATABASE_KINDS.has(value.kind) && normalizedConfig.access !== undefined) {
    if (normalizedConfig.access !== "read" && normalizedConfig.access !== "write") {
      throw new IntegrationValidationError("VALIDATION_ERROR", "database access must be read or write");
    }
    if (
      normalizedConfig.maxRows !== undefined &&
      (!Number.isInteger(normalizedConfig.maxRows) || Number(normalizedConfig.maxRows) < 1 || Number(normalizedConfig.maxRows) > 10_000)
    ) {
      throw new IntegrationValidationError("VALIDATION_ERROR", "database maxRows must be an integer between 1 and 10000");
    }
    if (normalizedConfig.allowDdl !== undefined && typeof normalizedConfig.allowDdl !== "boolean") {
      throw new IntegrationValidationError("VALIDATION_ERROR", "database allowDdl must be a boolean");
    }
  }
  const missingSecrets = requiredSecretRefs(value.kind, normalizedConfig).filter((field) => !value.secretRefs[field]);
  if (missingSecrets.length > 0) {
    throw new IntegrationValidationError(
      "VALIDATION_ERROR",
      `missing secret reference(s) for ${value.kind}: ${missingSecrets.join(", ")}`,
    );
  }

  const capabilities = value.capabilities ?? definition.capabilities;
  const allowed = new Set(definition.capabilities);
  const invalid = capabilities.filter((capability) => !allowed.has(capability));
  if (invalid.length > 0) {
    throw new IntegrationValidationError(
      "VALIDATION_ERROR",
      `capabilities not supported by ${value.kind}: ${invalid.join(", ")}`,
    );
  }

  return {
    scope: value.scope,
    projectSlug: value.projectSlug,
    kind: value.kind,
    name: value.name,
    slug: value.slug,
    config: normalizedConfig,
    secretRefs: value.secretRefs,
    capabilities,
  };
}

export function assertIntegrationInScope(
  integration: { scope: IntegrationScope; projectSlug?: string },
  input: { scope: IntegrationScope; projectSlug?: string },
): void {
  if (integration.scope !== input.scope) {
    throw new IntegrationValidationError("FORBIDDEN", "integration scope mismatch");
  }
  if (integration.scope === "project" && integration.projectSlug !== input.projectSlug) {
    throw new IntegrationValidationError("FORBIDDEN", "integration belongs to another project");
  }
}
