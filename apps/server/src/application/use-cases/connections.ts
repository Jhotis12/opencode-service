import type { Store } from "../ports/store.ts";
import type { AgentRuntimePort, AgentModelInfo, ExternalDatabaseAdapter, ExternalDbConfig } from "../ports/runtime.ts";
import type { SecretVault } from "../ports/security.ts";

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

export class SaveExternalDatabaseUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
  ) {}

  execute(alias: string, config: ExternalDbConfig): void {
    if (!/^[a-z][a-z0-9_-]{1,60}$/.test(alias)) throw new Error("alias must be lowercase kebab or snake case");
    this.store.externalDatabases.upsert({
      id: crypto.randomUUID(),
      alias,
      driver: config.driver,
      ciphertext: this.vault.encrypt(JSON.stringify(config)),
      createdAt: new Date().toISOString(),
    });
  }

  remove(alias: string): boolean {
    return this.store.externalDatabases.remove(alias);
  }

  list(): Array<{ alias: string; driver: string; createdAt: string }> {
    return this.store.externalDatabases.list().map(({ alias, driver, createdAt }) => ({ alias, driver, createdAt }));
  }
}

export class TestExternalDatabaseUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
    private readonly adapter: ExternalDatabaseAdapter,
  ) {}

  async execute(alias: string): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
    const config = this.resolve(alias);
    return this.adapter.test(config);
  }

  resolve(alias: string): ExternalDbConfig {
    const record = this.store.externalDatabases.findByAlias(alias);
    if (!record) throw new Error(`unknown database alias: ${alias}`);
    return JSON.parse(this.vault.decrypt(record.ciphertext)) as ExternalDbConfig;
  }
}

export class QueryExternalDatabaseUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
    private readonly adapter: ExternalDatabaseAdapter,
  ) {}

  async execute(alias: string, sql: string, params: unknown[] = []): Promise<unknown[]> {
    if (!/^\s*(select|with|pragma|insert|update|delete|create|alter)\b/i.test(sql)) {
      throw new Error("only SQL statements are allowed");
    }
    const record = this.store.externalDatabases.findByAlias(alias);
    if (!record) throw new Error(`unknown database alias: ${alias}`);
    const config = JSON.parse(this.vault.decrypt(record.ciphertext)) as ExternalDbConfig;
    return this.adapter.query(config, sql, params);
  }
}
