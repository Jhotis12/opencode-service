import { join } from "node:path";
import type { Store } from "../../../application/ports/store.ts";
import type { SecretVault } from "../../../application/ports/security.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import type { ChannelEgressRouter } from "./egress-router.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";
import type { ChannelRecord } from "../../../domain/entities.ts";
import type { RouteIncomingMessageUseCase } from "../../../application/use-cases/route-channel-message.ts";
import { deliverWebhook } from "../../../application/use-cases/external-chat.ts";
import { TelegramChannelAdapter, GrammyTransport } from "./telegram-adapter.ts";
import {
  BaileysTransport,
  WhatsAppChannelAdapter,
  WhatsAppCloudTransport,
} from "./whatsapp-adapter.ts";

interface ManagedChannel {
  stop(): Promise<void>;
}

export class ChannelManager {
  private readonly managed = new Map<string, ManagedChannel>();

  constructor(
    private readonly deps: {
      store: Store;
      vault: SecretVault;
      egress: ChannelEgressRouter;
      events: EventBus;
      logger: Logger;
      router: RouteIncomingMessageUseCase;
      dataDir: string;
      env: Record<string, string | undefined>;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async startAll(): Promise<void> {
    for (const channel of this.deps.store.channels.list()) {
      await this.start(channel).catch((error) =>
        this.deps.logger.error({
          event: "channel_start_failed",
          entryPoint: "system",
          channelSlug: channel.slug,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async start(channel: ChannelRecord): Promise<void> {
    if (this.managed.has(channel.slug)) return;
    if (channel.type === "external_chat") {
      this.registerExternalChat(channel);
      this.deps.store.channels.updateStatus(channel.slug, "connected");
      return;
    }
    const config = channel.configCiphertext
      ? (JSON.parse(this.deps.vault.decrypt(channel.configCiphertext)) as Record<string, string>)
      : {};

    if (channel.type === "telegram") {
      const token = config.token ?? this.deps.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        this.deps.store.channels.updateStatus(channel.slug, "needs_config");
        return;
      }
      const adapter = new TelegramChannelAdapter({
        slug: channel.slug,
        transport: new GrammyTransport(token),
        router: this.deps.router,
        events: this.deps.events,
        logger: this.deps.logger,
      });
      this.deps.egress.register(channel.slug, (text, recipient) => adapter.send(text, recipient));
      await adapter.start();
      this.managed.set(channel.slug, adapter);
      this.deps.store.channels.updateStatus(channel.slug, "connected");
      return;
    }

    const mode = config.mode ?? this.deps.env.WHATSAPP_MODE ?? "baileys";
    const transport =
      mode === "cloud"
        ? new WhatsAppCloudTransport(config.token ?? "", config.phoneNumberId ?? "", this.deps.fetchImpl)
        : new BaileysTransport(join(this.deps.dataDir, "channels", "whatsapp", channel.slug));
    const adapter = new WhatsAppChannelAdapter({
      slug: channel.slug,
      transport,
      router: this.deps.router,
      events: this.deps.events,
      logger: this.deps.logger,
    });
    this.deps.egress.register(channel.slug, (text, recipient) => adapter.send(text, recipient));
    await adapter.start();
    this.managed.set(channel.slug, adapter);
    this.deps.store.channels.updateStatus(channel.slug, "connected");
  }

  async stop(slug: string): Promise<void> {
    const adapter = this.managed.get(slug);
    if (!adapter) return;
    await adapter.stop();
    this.managed.delete(slug);
    this.deps.egress.unregister(slug);
    this.deps.store.channels.updateStatus(slug, "disconnected");
  }

  async stopAll(): Promise<void> {
    for (const slug of [...this.managed.keys()]) await this.stop(slug);
  }

  private registerExternalChat(channel: ChannelRecord): void {
    const config = channel.configCiphertext
      ? (JSON.parse(this.deps.vault.decrypt(channel.configCiphertext)) as { webhookSecret?: string })
      : {};
    this.deps.egress.register(channel.slug, async (text) => {
      const url = this.deps.store.channels.findBySlug(channel.slug)?.webhookUrl;
      if (!url || !config.webhookSecret) throw new Error("external chat channel has no webhook configured");
      await deliverWebhook(url, config.webhookSecret, { text }, this.deps.fetchImpl);
    });
  }
}
