import type { IncomingIntegrationMessage, IntegrationEgressPort } from "../../../application/ports/channels.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";

export interface WhatsAppTransport {
  readonly type: "whatsapp";
  start(handler: (message: { senderId: string; text: string }) => void, onQr: (qr: string) => void): Promise<void>;
  send(senderId: string, text: string): Promise<void>;
  stop(): Promise<void>;
  status(): string;
}

/** Baileys transport, loaded lazily so the app runs without the optional package. */
export class BaileysTransport implements WhatsAppTransport {
  readonly type = "whatsapp" as const;
  private socket: any;
  private started = false;

  constructor(private readonly authDir: string) {}

  async start(
    handler: (message: { senderId: string; text: string }) => void,
    onQr: (qr: string) => void,
  ): Promise<void> {
    const moduleName = "@whiskeysockets/baileys";
    const baileys = (await import(moduleName)) as any;
    const { state, saveCreds } = await baileys.useMultiFileAuthState(this.authDir);
    this.socket = baileys.makeWASocket({ auth: state, printQRInTerminal: false });
    this.socket.ev.on("creds.update", saveCreds);
    this.socket.ev.on("connection.update", (update: any) => {
      if (update.qr) onQr(update.qr);
      if (update.connection === "open") this.started = true;
      if (update.connection === "close") this.started = false;
    });
    this.socket.ev.on("messages.upsert", (event: any) => {
      for (const message of event.messages ?? []) {
        if (message.key?.fromMe) continue;
        const text = message.message?.conversation ?? message.message?.extendedTextMessage?.text;
        if (text && message.key?.remoteJid) handler({ senderId: message.key.remoteJid, text });
      }
    });
  }

  async send(senderId: string, text: string): Promise<void> {
    if (!this.socket) throw new Error("whatsapp transport is not connected");
    await this.socket.sendMessage(senderId, { text });
  }

  async stop(): Promise<void> {
    this.socket?.end?.(undefined);
    this.socket = undefined;
    this.started = false;
  }

  status(): string {
    return this.started ? "connected" : "disconnected";
  }
}

/** Official Meta Cloud API transport (webhook-driven). */
export class WhatsAppCloudTransport implements WhatsAppTransport {
  readonly type = "whatsapp" as const;
  private handler?: (message: { senderId: string; text: string }) => void;

  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async start(handler: (message: { senderId: string; text: string }) => void): Promise<void> {
    this.handler = handler;
  }

  async send(senderId: string, text: string): Promise<void> {
    const response = await this.fetchImpl(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: senderId, type: "text", text: { body: text } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`whatsapp cloud send failed: ${response.status}`);
  }

  async stop(): Promise<void> {
    this.handler = undefined;
  }

  status(): string {
    return "connected";
  }

  handleWebhook(payload: unknown): void {
    for (const message of parseCloudWebhook(payload)) this.handler?.(message);
  }
}

export function parseCloudWebhook(payload: unknown): Array<{ senderId: string; text: string }> {
  const messages: Array<{ senderId: string; text: string }> = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      for (const message of (value.messages as unknown[]) ?? []) {
        const item = message as { from?: string; text?: { body?: string }; button?: { text?: string } };
        const text = item.text?.body ?? item.button?.text;
        if (item.from && text) messages.push({ senderId: item.from, text });
      }
    }
  }
  return messages;
}

export class WhatsAppChannelAdapter implements IntegrationEgressPort {
  constructor(
    private readonly options: {
      integrationId: string;
      scope: "project" | "global";
      projectSlug?: string;
      transport: WhatsAppTransport;
      router: { execute(message: IncomingIntegrationMessage): Promise<{ decision: string }> };
      events: EventBus;
      logger: Logger;
      onQr?: (qr: string) => void;
    },
  ) {}

  async start(): Promise<void> {
    await this.options.transport.start(
      (message) => {
        void this.options.router
          .execute({
            integrationId: this.options.integrationId,
            kind: "whatsapp",
            senderId: message.senderId,
            text: message.text,
          })
          .catch((error) =>
            this.options.logger.error({
              event: "whatsapp_message_failed",
              entryPoint: "whatsapp",
              integrationId: this.options.integrationId,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
      },
      (qr) => {
        this.options.onQr?.(qr);
        this.options.events.publish({
          type: "integration.status",
          integrationId: this.options.integrationId,
          scope: this.options.scope,
          projectSlug: this.options.projectSlug,
          status: "qr_pending",
          qr,
        });
      },
    );
    this.options.events.publish({
      type: "integration.status",
      integrationId: this.options.integrationId,
      scope: this.options.scope,
      projectSlug: this.options.projectSlug,
      status: this.options.transport.status(),
    });
  }

  async send(text: string, recipient?: string): Promise<void> {
    if (!recipient) throw new Error("whatsapp replies require a recipient");
    await this.options.transport.send(recipient, text);
  }

  async stop(): Promise<void> {
    await this.options.transport.stop();
    this.options.events.publish({
      type: "integration.status",
      integrationId: this.options.integrationId,
      scope: this.options.scope,
      projectSlug: this.options.projectSlug,
      status: "disconnected",
    });
  }
}
