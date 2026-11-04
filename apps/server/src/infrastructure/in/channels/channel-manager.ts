import { join } from "node:path";
import type { Store } from "../../../application/ports/store.ts";
import type { SecretVault } from "../../../application/ports/security.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import type { IntegrationManagerPort } from "../../../application/ports/integrations.ts";
import type { EgressSendResult } from "../../../application/ports/channels.ts";
import type { IntegrationEgressRouter } from "./egress-router.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";
import type { IntegrationRecord } from "../../../domain/entities.ts";
import type { RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase } from "../../../application/use-cases/route-channel-message.ts";
import { deliverWebhook } from "../../../application/use-cases/external-chat.ts";
import { TelegramChannelAdapter, GrammyTransport } from "./telegram-adapter.ts";
import { BaileysTransport, WhatsAppChannelAdapter, WhatsAppCloudTransport } from "./whatsapp-adapter.ts";

interface ManagedIntegration {
  stop(): Promise<void>;
}

export class IntegrationManager implements IntegrationManagerPort {
  private readonly managed = new Map<string, ManagedIntegration>();
  private readonly qrCodes = new Map<string, string>();

  constructor(
    private readonly deps: {
      store: Store;
      vault: SecretVault;
      egress: IntegrationEgressRouter;
      events: EventBus;
      logger: Logger;
      projectRouter: RouteProjectIntegrationMessageUseCase;
      globalRouter: RouteGlobalIntegrationMessageUseCase;
      dataDir: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async startAll(): Promise<void> {
    for (const integration of this.deps.store.integrations.listAll()) {
      if (!["telegram", "whatsapp", "external_chat"].includes(integration.kind)) continue;
      // Only integrations the user explicitly connected are restarted. New or
      // disconnected integrations wait for an explicit connect action.
      if (!["connected", "qr_pending"].includes(integration.status)) continue;
      await this.start(integration).catch((error) =>
        this.deps.logger.error({
          event: "integration_start_failed",
          entryPoint: "system",
          integrationId: integration.id,
          kind: integration.kind,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async start(integration: IntegrationRecord): Promise<void> {
    if (this.managed.has(integration.id)) return;
    if (integration.kind === "external_chat") {
      this.registerExternalChat(integration);
      this.managed.set(integration.id, { stop: async () => undefined });
      this.deps.store.integrations.updateStatus(integration.id, "connected");
      return;
    }
    if (integration.kind === "telegram") {
      const token = this.resolveSecret(integration, "token");
      if (!token) {
        this.deps.store.integrations.updateStatus(integration.id, "needs_config", "missing token");
        return;
      }
      const adapter = new TelegramChannelAdapter({
        integrationId: integration.id,
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        transport: new GrammyTransport(token, this.deps.logger),
        router: integration.scope === "global" ? this.deps.globalRouter : this.deps.projectRouter,
        events: this.deps.events,
        logger: this.deps.logger,
      });
      this.deps.egress.register(integration.id, (text, recipient) => adapter.send(text, recipient));
      await adapter.start();
      this.managed.set(integration.id, adapter);
      this.deps.store.integrations.updateStatus(integration.id, "connected");
      return;
    }
    if (integration.kind === "whatsapp") {
      const mode = String(integration.config.mode ?? "baileys");
      const token = this.resolveSecret(integration, "token");
      if (mode === "cloud" && (!token || !integration.config.phoneNumberId)) {
        this.deps.store.integrations.updateStatus(integration.id, "needs_config", "missing cloud credentials");
        return;
      }
      const transport =
        mode === "cloud"
          ? new WhatsAppCloudTransport(token ?? "", String(integration.config.phoneNumberId ?? ""), this.deps.fetchImpl)
          : new BaileysTransport(join(this.deps.dataDir, "channels", "whatsapp", integration.id));
      const adapter = new WhatsAppChannelAdapter({
        integrationId: integration.id,
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        transport,
        router: integration.scope === "global" ? this.deps.globalRouter : this.deps.projectRouter,
        events: this.deps.events,
        logger: this.deps.logger,
        onQr: (qr) => this.qrCodes.set(integration.id, qr),
      });
      this.deps.egress.register(integration.id, (text, recipient) => adapter.send(text, recipient));
      await adapter.start();
      this.managed.set(integration.id, adapter);
      this.deps.store.integrations.updateStatus(integration.id, "connected");
      return;
    }
    // Email is a future adapter; the integration contract is ready, the
    // transport is intentionally not implemented in this change.
    this.deps.store.integrations.updateStatus(integration.id, "needs_config", "email adapter not implemented");
  }

  async stop(integrationId: string): Promise<void> {
    const adapter = this.managed.get(integrationId);
    if (!adapter) return;
    await adapter.stop();
    this.managed.delete(integrationId);
    this.qrCodes.delete(integrationId);
    this.deps.egress.unregister(integrationId);
    this.deps.store.integrations.updateStatus(integrationId, "disconnected");
  }

  async stopAll(): Promise<void> {
    for (const id of [...this.managed.keys()]) await this.stop(id);
  }

  async test(integration: IntegrationRecord): Promise<{ ok: boolean; detail?: string; latencyMs?: number }> {
    if (integration.kind === "telegram") {
      const ok = Boolean(this.resolveSecret(integration, "token"));
      return { ok, detail: ok ? "token available" : "missing token" };
    }
    if (integration.kind === "whatsapp") {
      const ok = String(integration.config.mode ?? "baileys") !== "cloud" || Boolean(this.resolveSecret(integration, "token"));
      return { ok, detail: ok ? "configuration available" : "missing cloud token" };
    }
    if (integration.kind === "external_chat") {
      return { ok: Boolean(integration.keyHash), detail: integration.keyHash ? "api key configured" : "missing api key" };
    }
    return { ok: false, detail: `unsupported integration kind: ${integration.kind}` };
  }

  status(integrationId: string): string | undefined {
    return this.deps.store.integrations.findById(integrationId)?.status;
  }

  qr(integrationId: string): string | undefined {
    return this.qrCodes.get(integrationId);
  }

  async send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult> {
    return this.deps.egress.send(integrationId, text, recipient);
  }

  private resolveSecret(integration: IntegrationRecord, field: string): string | undefined {
    const alias = integration.secretRefs[field];
    if (!alias) return undefined;
    const secret = this.deps.store.vault.findByAlias({
      scope: integration.scope,
      projectSlug: integration.projectSlug,
      alias,
    });
    return secret ? this.deps.vault.decrypt(secret.ciphertext) : undefined;
  }

  private registerExternalChat(integration: IntegrationRecord): void {
    this.deps.egress.register(integration.id, async (text) => {
      const current = this.deps.store.integrations.findById(integration.id);
      if (!current) throw new Error("integration not found");
      const url = typeof current.config.webhookUrl === "string" ? current.config.webhookUrl : undefined;
      const alias = current.secretRefs.webhookSecret;
      if (!url || !alias) throw new Error("external chat integration has no webhook configured");
      const secret = this.deps.store.vault.findByAlias({
        scope: current.scope,
        projectSlug: current.projectSlug,
        alias,
      });
      if (!secret) throw new Error("external chat integration has no webhook secret");
      await deliverWebhook(url, this.deps.vault.decrypt(secret.ciphertext), { text }, this.deps.fetchImpl);
      return {};
    });
  }
}
