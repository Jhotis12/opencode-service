import { createHash, randomBytes } from "node:crypto";
import type { IntegrationCapability, IntegrationKind, IntegrationScope } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { SecretVault } from "../ports/security.ts";
import type { EventBus } from "../ports/events.ts";
import type { IntegrationManagerPort } from "../ports/integrations.ts";
import type { IntegrationRecord } from "../../domain/entities.ts";
import {
  IntegrationValidationError,
  validateIntegrationInput,
  withDatabaseDefaults,
  type ValidatedIntegrationInput,
} from "../../domain/integrations/validation.ts";
import { TestDatabaseIntegrationUseCase } from "./connections.ts";
import type { ExternalDatabaseAdapter } from "../ports/runtime.ts";
import type { TranscriptionPort } from "../ports/transcription.ts";

export interface IntegrationCommand {
  scope: IntegrationScope;
  projectSlug?: string;
  kind: IntegrationKind;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  secretRefs?: Record<string, string>;
  capabilities?: IntegrationCapability[];
  secrets?: Record<string, string>;
}

export interface IntegrationUpdateCommand {
  name?: string;
  config?: Record<string, unknown>;
  capabilities?: IntegrationCapability[];
  secrets?: Record<string, string>;
}

export function hashIntegrationKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyIntegrationKey(key: string, expectedHash: string | undefined): boolean {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashIntegrationKey(key));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && actual.equals(expected);
}

export class ManageIntegrationsUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      vault: SecretVault;
      events: EventBus;
      manager: IntegrationManagerPort;
      databaseAdapter: ExternalDatabaseAdapter;
      transcription: TranscriptionPort;
    },
  ) {}

  list(input: { scope: IntegrationScope; projectSlug?: string }): IntegrationRecord[] {
    return this.deps.store.integrations.list(input);
  }

  get(id: string, scope: { scope: IntegrationScope; projectSlug?: string }): IntegrationRecord {
    const integration = this.deps.store.integrations.findById(id);
    if (!integration) throw new IntegrationValidationError("NOT_FOUND", "integration not found");
    this.assertScope(integration, scope);
    return integration;
  }

  async create(command: IntegrationCommand): Promise<{ integration: IntegrationRecord; apiKey?: string; webhookSecret?: string }> {
    const id = crypto.randomUUID();
    const generatedSecrets: Record<string, string> = {};
    const providedSecrets = command.secrets ?? {};
    const secretRefs: Record<string, string> = { ...(command.secretRefs ?? {}) };

    for (const [field, value] of Object.entries(providedSecrets)) {
      const alias = `integration:${id}:${field}`;
      secretRefs[field] = alias;
      generatedSecrets[field] = value;
    }

    if (command.kind === "external_chat") {
      const apiKey = `sk_chat_${crypto.randomUUID().replaceAll("-", "")}`;
      const webhookSecret = randomBytes(24).toString("hex");
      const apiKeyAlias = `integration:${id}:api_key`;
      const webhookAlias = `integration:${id}:webhook_secret`;
      secretRefs.apiKey = apiKeyAlias;
      secretRefs.webhookSecret = webhookAlias;
      generatedSecrets.api_key = apiKey;
      generatedSecrets.webhook_secret = webhookSecret;
      const validated = validateIntegrationInput(
        { ...command, secretRefs },
        { expectedScope: command.scope, expectedProjectSlug: command.projectSlug },
      );
      this.persistSecrets(id, validated, generatedSecrets);
      const now = new Date().toISOString();
      const integration: IntegrationRecord = {
        id,
        scope: validated.scope,
        projectSlug: validated.projectSlug,
        kind: validated.kind,
        name: validated.name,
        slug: validated.slug,
        config: validated.config,
        secretRefs,
        capabilities: validated.capabilities,
        status: "disconnected",
        keyHash: hashIntegrationKey(apiKey),
        createdAt: now,
        updatedAt: now,
      };
      this.assertSlugAvailable(integration);
      this.deps.store.integrations.create(integration);
      this.deps.events.publish({
        type: "integration.status",
        integrationId: integration.id,
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        status: integration.status,
      });
      return { integration, apiKey, webhookSecret };
    }

    const normalized = withDatabaseDefaults(command);
    const validated = validateIntegrationInput(
      { ...normalized, secretRefs },
      { expectedScope: command.scope, expectedProjectSlug: command.projectSlug },
    );
    this.persistSecrets(id, validated, generatedSecrets);
    const now = new Date().toISOString();
    const integration: IntegrationRecord = {
      id,
      scope: validated.scope,
      projectSlug: validated.projectSlug,
      kind: validated.kind,
      name: validated.name,
      slug: validated.slug,
      config: validated.config,
      secretRefs,
      capabilities: validated.capabilities,
      status: "disconnected",
      createdAt: now,
      updatedAt: now,
    };
    this.assertSlugAvailable(integration);
    this.deps.store.integrations.create(integration);
    this.deps.events.publish({
      type: "integration.status",
      integrationId: integration.id,
      scope: integration.scope,
      projectSlug: integration.projectSlug,
      status: integration.status,
    });
    return { integration };
  }

  async update(
    id: string,
    scope: { scope: IntegrationScope; projectSlug?: string },
    command: IntegrationUpdateCommand,
  ): Promise<IntegrationRecord> {
    const current = this.get(id, scope);
    const secretRefs = { ...current.secretRefs };
    const generatedSecrets: Record<string, string> = {};
    for (const [field, value] of Object.entries(command.secrets ?? {})) {
      const alias = secretRefs[field] ?? `integration:${id}:${field}`;
      secretRefs[field] = alias;
      generatedSecrets[field] = value;
    }
    const config = command.config ?? current.config;
    const validated = validateIntegrationInput(
      {
        scope: current.scope,
        projectSlug: current.projectSlug,
        kind: current.kind,
        name: command.name ?? current.name,
        slug: current.slug,
        config,
        secretRefs,
        capabilities: command.capabilities ?? current.capabilities,
      },
      { expectedScope: current.scope, expectedProjectSlug: current.projectSlug },
    );
    this.persistSecrets(id, validated, generatedSecrets);
    this.deps.store.integrations.update(id, {
      name: validated.name,
      config: validated.config,
      secretRefs,
      capabilities: validated.capabilities,
    });
    const updated = this.deps.store.integrations.findById(id);
    if (!updated) throw new IntegrationValidationError("NOT_FOUND", "integration not found");
    return updated;
  }

  async remove(id: string, scope: { scope: IntegrationScope; projectSlug?: string }): Promise<boolean> {
    const integration = this.get(id, scope);
    await this.deps.manager.stop(id);
    for (const alias of Object.values(integration.secretRefs)) {
      this.deps.store.vault.remove({
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        alias,
      });
    }
    return this.deps.store.integrations.remove(id);
  }

  async connect(id: string, scope: { scope: IntegrationScope; projectSlug?: string }): Promise<IntegrationRecord> {
    const integration = this.get(id, scope);
    await this.deps.manager.start(integration);
    return this.deps.store.integrations.findById(id) ?? integration;
  }

  async disconnect(id: string, scope: { scope: IntegrationScope; projectSlug?: string }): Promise<void> {
    this.get(id, scope);
    await this.deps.manager.stop(id);
  }

  async test(
    id: string,
    scope: { scope: IntegrationScope; projectSlug?: string },
  ): Promise<{ ok: boolean; detail?: string; latencyMs?: number; models?: string[] }> {
    const integration = this.get(id, scope);
    if (["postgres", "mysql", "mssql", "sqlite"].includes(integration.kind)) {
      const tester = new TestDatabaseIntegrationUseCase(this.deps.store, this.deps.vault, this.deps.databaseAdapter);
      return tester.execute(id, scope);
    }
    if (integration.kind === "transcription") {
      const result = await this.deps.transcription.test({
        integrationId: id,
        scope: integration.scope,
        projectSlug: integration.projectSlug,
      });
      this.deps.store.integrations.updateStatus(
        id,
        result.ok ? "connected" : "error",
        result.ok ? undefined : result.detail,
      );
      if (result.ok && result.models) {
        this.deps.store.integrations.update(id, {
          config: { ...integration.config, models: result.models },
        });
      }
      return result;
    }
    return this.deps.manager.test(integration);
  }

  private persistSecrets(id: string, validated: ValidatedIntegrationInput, secrets: Record<string, string>): void {
    for (const [field, value] of Object.entries(secrets)) {
      const alias = `integration:${id}:${field}`;
      this.deps.store.vault.upsert({
        id: crypto.randomUUID(),
        scope: validated.scope,
        projectSlug: validated.projectSlug,
        alias,
        kind: `integration:${validated.kind}`,
        ciphertext: this.deps.vault.encrypt(value),
        createdAt: new Date().toISOString(),
      });
    }
  }

  private assertSlugAvailable(integration: IntegrationRecord): void {
    const existing = this.deps.store.integrations.findBySlug({
      scope: integration.scope,
      projectSlug: integration.projectSlug,
      slug: integration.slug,
    });
    if (existing) throw new IntegrationValidationError("CONFLICT", `integration slug already exists: ${integration.slug}`);
  }

  private assertScope(
    integration: IntegrationRecord,
    scope: { scope: IntegrationScope; projectSlug?: string },
  ): void {
    if (integration.scope !== scope.scope) {
      throw new IntegrationValidationError("FORBIDDEN", "integration scope mismatch");
    }
    if (integration.scope === "project" && integration.projectSlug !== scope.projectSlug) {
      throw new IntegrationValidationError("FORBIDDEN", "integration belongs to another project");
    }
  }
}
