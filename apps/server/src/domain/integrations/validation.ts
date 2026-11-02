import {
  CreateIntegrationInputSchema,
  defaultCapabilities,
  parseIntegrationConfig,
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

export function requiredSecretRefs(kind: IntegrationKind, config: Record<string, unknown>): string[] {
  switch (kind) {
    case "telegram":
      return ["token"];
    case "whatsapp":
      return config.mode === "cloud" ? ["token"] : [];
    case "external_chat":
      return [];
    case "email": {
      const refs = ["smtpPassword"];
      if (config.imap) refs.push("imapPassword");
      return refs;
    }
    case "postgres":
    case "mysql":
    case "mssql":
      return ["password"];
    case "sqlite":
    case "http":
      return [];
  }
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

  const config = parseIntegrationConfig(value.kind, value.config);
  if (!config.success) {
    throw new IntegrationValidationError(
      "VALIDATION_ERROR",
      `invalid ${value.kind} configuration: ${config.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const normalizedConfig = config.data as Record<string, unknown>;
  const missingSecrets = requiredSecretRefs(value.kind, normalizedConfig).filter((field) => !value.secretRefs[field]);
  if (missingSecrets.length > 0) {
    throw new IntegrationValidationError(
      "VALIDATION_ERROR",
      `missing secret reference(s) for ${value.kind}: ${missingSecrets.join(", ")}`,
    );
  }

  const capabilities = value.capabilities ?? defaultCapabilities(value.kind);
  const allowed = new Set(defaultCapabilities(value.kind));
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
