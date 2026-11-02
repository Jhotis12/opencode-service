import type { Store } from "../ports/store.ts";
import type { AgentRuntimePort, AgentModelInfo, ExternalDatabaseAdapter, ExternalDbConfig } from "../ports/runtime.ts";
import type { SecretVault } from "../ports/security.ts";
import type { IntegrationRecord } from "../../domain/entities.ts";
import { IntegrationValidationError } from "../../domain/integrations/validation.ts";

export const OPENCODE_GO_PROVIDER_ID = "opencode-go";

export class ConnectProviderUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
    private readonly runtime: AgentRuntimePort,
  ) {}

  async execute(apiKey: string, providerID = OPENCODE_GO_PROVIDER_ID): Promise<{ models: AgentModelInfo[] }> {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8) throw new Error("api key looks too short");
    await this.runtime.registerProviderKey(providerID, trimmed);
    this.store.vault.upsert({
      id: crypto.randomUUID(),
      scope: "global",
      alias: `provider:${providerID}`,
      kind: "provider_key",
      ciphertext: this.vault.encrypt(trimmed),
      metadata: JSON.stringify({ providerID }),
      createdAt: new Date().toISOString(),
    });
    const models = (await this.runtime.listModels()).filter((model) => model.providerID === providerID);
    return { models };
  }
}

function databaseConfig(integration: IntegrationRecord, password?: string): ExternalDbConfig {
  const config = integration.config as Record<string, unknown>;
  switch (integration.kind) {
    case "sqlite":
      return { driver: "sqlite", filename: String(config.filename ?? "") };
    case "postgres":
    case "mysql":
    case "mssql":
      return {
        driver: integration.kind,
        host: String(config.host ?? ""),
        port: Number(config.port ?? 0),
        user: String(config.user ?? ""),
        password,
        database: String(config.database ?? ""),
      };
    default:
      throw new IntegrationValidationError("VALIDATION_ERROR", `integration ${integration.id} is not a database`);
  }
}

export class TestDatabaseIntegrationUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
    private readonly adapter: ExternalDatabaseAdapter,
  ) {}

  async execute(integrationId: string, scope: { scope: "project" | "global"; projectSlug?: string }): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
    const integration = this.require(integrationId, scope);
    if (["postgres", "mysql", "mssql"].includes(integration.kind) && !integration.secretRefs.password) {
      throw new IntegrationValidationError("VALIDATION_ERROR", `missing secret: password for ${integration.kind}`);
    }
    const password = integration.secretRefs.password
      ? this.vault.decrypt(this.requireSecret(integration, integration.secretRefs.password).ciphertext)
      : undefined;
    return this.adapter.test(databaseConfig(integration, password));
  }

  resolve(integrationId: string, scope: { scope: "project" | "global"; projectSlug?: string }): { integration: IntegrationRecord; config: ExternalDbConfig } {
    const integration = this.require(integrationId, scope);
    const password = integration.secretRefs.password
      ? this.vault.decrypt(this.requireSecret(integration, integration.secretRefs.password).ciphertext)
      : undefined;
    return { integration, config: databaseConfig(integration, password) };
  }

  private require(integrationId: string, scope: { scope: "project" | "global"; projectSlug?: string }): IntegrationRecord {
    const integration = this.store.integrations.findById(integrationId);
    if (!integration) throw new IntegrationValidationError("NOT_FOUND", `unknown integration: ${integrationId}`);
    if (integration.scope !== scope.scope || (integration.scope === "project" && integration.projectSlug !== scope.projectSlug)) {
      throw new IntegrationValidationError("FORBIDDEN", "integration scope mismatch");
    }
    return integration;
  }

  private requireSecret(integration: IntegrationRecord, alias: string) {
    const secret = this.store.vault.findByAlias({
      scope: integration.scope,
      projectSlug: integration.projectSlug,
      alias,
    });
    if (!secret) throw new IntegrationValidationError("VALIDATION_ERROR", `missing secret: ${alias}`);
    return secret;
  }
}

export class QueryDatabaseIntegrationUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
    private readonly adapter: ExternalDatabaseAdapter,
  ) {}

  async execute(
    integrationId: string,
    scope: { scope: "project" | "global"; projectSlug?: string },
    sql: string,
    params: unknown[] = [],
  ): Promise<unknown[]> {
    if (!/^\s*(select|with|pragma|insert|update|delete|create|alter)\b/i.test(sql)) {
      throw new Error("only SQL statements are allowed");
    }
    const integration = this.store.integrations.findById(integrationId);
    if (!integration) throw new IntegrationValidationError("NOT_FOUND", `unknown integration: ${integrationId}`);
    if (integration.scope !== scope.scope || (integration.scope === "project" && integration.projectSlug !== scope.projectSlug)) {
      throw new IntegrationValidationError("FORBIDDEN", "integration scope mismatch");
    }
    if (["postgres", "mysql", "mssql"].includes(integration.kind) && !integration.secretRefs.password) {
      throw new IntegrationValidationError("VALIDATION_ERROR", `missing secret: password for ${integration.kind}`);
    }
    const password = integration.secretRefs.password
      ? this.vault.decrypt(
          this.store.vault.findByAlias({
            scope: integration.scope,
            projectSlug: integration.projectSlug,
            alias: integration.secretRefs.password,
          })!.ciphertext,
        )
      : undefined;
    return this.adapter.query(databaseConfig(integration, password), sql, params);
  }
}
