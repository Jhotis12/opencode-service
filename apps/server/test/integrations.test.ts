import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import {
  IntegrationValidationError,
  validateIntegrationInput,
} from "../src/domain/integrations/validation.ts";
import { ManageIntegrationsUseCase, verifyIntegrationKey } from "../src/application/use-cases/manage-integrations.ts";
import type { IntegrationManagerPort } from "../src/application/ports/integrations.ts";

const manager: IntegrationManagerPort = {
  async start() {},
  async stop() {},
  async stopAll() {},
  async test() {
    return { ok: true };
  },
  status() {
    return "connected";
  },
  qr() {
    return undefined;
  },
  async send() {
    return {};
  },
};

function useCase(store: SqliteStore, vault: Aes256GcmVaultAdapter) {
  return new ManageIntegrationsUseCase({
    store,
    vault,
    events: { publish() {} },
    manager,
    databaseAdapter: {} as never,
  });
}

describe("integration validation", () => {
  it("requires an owner for project integrations and forbids one for global", () => {
    expect(() =>
      validateIntegrationInput({
        scope: "project",
        kind: "telegram",
        name: "Bot",
        slug: "bot",
        config: {},
        secretRefs: { token: "t" },
      }),
    ).toThrow(/projectSlug/);
    expect(() =>
      validateIntegrationInput({
        scope: "global",
        projectSlug: "ventas",
        kind: "telegram",
        name: "Bot",
        slug: "bot",
        config: {},
        secretRefs: { token: "t" },
      }),
    ).toThrow(/global/);
  });

  it("validates kind-specific config and required secrets", () => {
    expect(() =>
      validateIntegrationInput({
        scope: "project",
        projectSlug: "ventas",
        kind: "telegram",
        name: "Bot",
        slug: "bot",
        config: {},
        secretRefs: {},
      }),
    ).toThrow(/token/);
    expect(() =>
      validateIntegrationInput({
        scope: "project",
        projectSlug: "ventas",
        kind: "postgres",
        name: "CRM",
        slug: "crm",
        config: { host: "localhost", port: 5432, database: "crm", user: "app" },
        secretRefs: {},
      }),
    ).toThrow(/password/);
  });

  it("accepts the future email contract with SMTP and IMAP secrets", () => {
    const email = validateIntegrationInput({
      scope: "project",
      projectSlug: "ventas",
      kind: "email",
      name: "Correo ventas",
      slug: "correo-ventas",
      config: {
        from: "ventas@example.com",
        smtp: { host: "smtp.example.com", port: 587, secure: false },
        imap: { host: "imap.example.com", port: 993, secure: true, mailbox: "INBOX" },
      },
      secretRefs: { smtpPassword: "smtp", imapPassword: "imap" },
    });
    expect(email.capabilities).toEqual(["send_email", "read_email"]);
    expect(() =>
      validateIntegrationInput({
        scope: "project",
        projectSlug: "ventas",
        kind: "email",
        name: "Correo ventas",
        slug: "correo-ventas",
        config: { from: "ventas@example.com", smtp: { host: "smtp.example.com", port: 587 } },
        secretRefs: {},
      }),
    ).toThrow(/smtpPassword/);
  });

  it("rejects capabilities that the kind does not support", () => {
    expect(() =>
      validateIntegrationInput({
        scope: "project",
        projectSlug: "ventas",
        kind: "sqlite",
        name: "Local",
        slug: "local",
        config: { filename: "/tmp/a.db" },
        capabilities: ["send_email"],
      }),
    ).toThrow(/capabilities/);
  });
});

describe("project integration lifecycle", () => {
  it("creates, lists, updates and removes a project integration", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 7));
    const integrations = useCase(store, vault);
    const created = await integrations.create({
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Ventas bot",
      slug: "ventas-bot",
      config: { routing: { mode: "hybrid", allowlist: ["123"], public: true } },
      secrets: { token: "secret-token" },
    });
    expect(created.integration.scope).toBe("project");
    expect(integrations.list({ scope: "project", projectSlug: "ventas" })).toHaveLength(1);
    expect(integrations.list({ scope: "project", projectSlug: "soporte" })).toHaveLength(0);
    expect(() => integrations.get(created.integration.id, { scope: "project", projectSlug: "soporte" })).toThrow(
      /another project/,
    );
    const updated = await integrations.update(
      created.integration.id,
      { scope: "project", projectSlug: "ventas" },
      { name: "Ventas bot v2" },
    );
    expect(updated.name).toBe("Ventas bot v2");
    expect(await integrations.remove(created.integration.id, { scope: "project", projectSlug: "ventas" })).toBe(true);
    expect(integrations.list({ scope: "project", projectSlug: "ventas" })).toHaveLength(0);
    store.close();
  });

  it("creates an external chat integration with a one-time key", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 8));
    const integrations = useCase(store, vault);
    const created = await integrations.create({
      scope: "project",
      projectSlug: "ventas",
      kind: "external_chat",
      name: "API clientes",
      slug: "api-clientes",
      config: { routing: { mode: "agent", allowlist: [], public: false } },
    });
    expect(created.apiKey?.startsWith("sk_chat_")).toBe(true);
    expect(verifyIntegrationKey(created.apiKey!, created.integration.keyHash)).toBe(true);
    expect(verifyIntegrationKey("wrong", created.integration.keyHash)).toBe(false);
    expect(store.vault.findByAlias({
      scope: "project",
      projectSlug: "ventas",
      alias: created.integration.secretRefs.webhookSecret,
    })).toBeDefined();
    store.close();
  });

  it("preserves platform fields such as alert subscriptions in integration config", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 10));
    const integrations = useCase(store, vault);
    const created = await integrations.create({
      scope: "global",
      kind: "telegram",
      name: "Alertas",
      slug: "alertas",
      config: {
        routing: { mode: "agent", allowlist: ["123"], public: false },
        alerts: ["run.failed", "integration.down"],
        alertRecipient: "123",
      },
      secrets: { token: "secret" },
    });
    expect(created.integration.config.alerts).toEqual(["run.failed", "integration.down"]);
    expect(created.integration.config.alertRecipient).toBe("123");
    store.close();
  });

  it("rejects duplicate slugs inside the same scope", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 9));
    const integrations = useCase(store, vault);
    await integrations.create({
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Bot",
      slug: "bot",
      config: {},
      secrets: { token: "a" },
    });
    await expect(
      integrations.create({
        scope: "project",
        projectSlug: "ventas",
        kind: "telegram",
        name: "Bot 2",
        slug: "bot",
        config: {},
        secrets: { token: "b" },
      }),
    ).rejects.toBeInstanceOf(IntegrationValidationError);
    store.close();
  });
});
