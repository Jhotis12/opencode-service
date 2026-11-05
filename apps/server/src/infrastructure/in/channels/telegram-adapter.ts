import { Bot, type Context } from "grammy";
import type {
  EgressSendResult,
  IncomingAttachment,
  IncomingIntegrationMessage,
  IntegrationEgressPort,
  IntegrationTransport,
} from "../../../application/ports/channels.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";

export interface TelegramTransport extends IntegrationTransport {
  readonly type: "telegram";
  verify(): Promise<{ botId: string; username: string }>;
  clearWebhook(): Promise<void>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

type TelegramHandler = (message: {
  senderId: string;
  text: string;
  messageId?: string;
  attachments?: IncomingAttachment[];
}) => void | Promise<void>;

export class GrammyTransport implements TelegramTransport {
  readonly type = "telegram" as const;
  private readonly bot: Bot;
  private readonly token: string;
  private readonly logger?: Logger;
  private started = false;

  constructor(token: string, logger?: Logger) {
    this.token = token;
    this.bot = new Bot(token);
    this.logger = logger;
  }

  async verify(): Promise<{ botId: string; username: string }> {
    const me = await withTimeout(this.bot.api.getMe(), 10_000, "telegram getMe timed out");
    return { botId: String(me.id), username: me.username ?? "" };
  }

  async clearWebhook(): Promise<void> {
    await withTimeout(
      this.bot.api.deleteWebhook({ drop_pending_updates: false }),
      10_000,
      "telegram deleteWebhook timed out",
    );
  }

  async start(handler: TelegramHandler): Promise<void> {
    this.bot.on("message:text", (ctx) => {
      void handler({
        senderId: String(ctx.from?.id ?? ""),
        text: ctx.message.text,
        messageId: String(ctx.message.message_id),
      });
    });
    this.bot.on("message:photo", (ctx) => {
      void this.handlePhoto(ctx, handler);
    });
    this.bot.on("message:voice", (ctx) => {
      void this.handleVoice(ctx, handler);
    });
    this.bot.on("message:audio", (ctx) => {
      void this.handleAudio(ctx, handler);
    });
    this.bot.on("message:document", (ctx) => {
      void this.handleDocument(ctx, handler);
    });
    await new Promise<void>((resolve, reject) => {
      void this.bot
        .start({
          onStart: () => {
            this.started = true;
            resolve();
          },
        })
        .catch(reject);
    });
  }

  private async handlePhoto(ctx: Context, handler: TelegramHandler): Promise<void> {
    const message = ctx.message as
      | { photo?: Array<{ file_id: string }>; caption?: string; message_id: number }
      | undefined;
    const photo = message?.photo?.at(-1);
    if (!message || !photo) return;
    await this.dispatchMedia(ctx, handler, {
      fileId: photo.file_id,
      filename: `photo-${message.message_id}.jpg`,
      mime: "image/jpeg",
      text: message.caption ?? "",
    });
  }

  private async handleVoice(ctx: Context, handler: TelegramHandler): Promise<void> {
    const message = ctx.message as
      | { voice?: { file_id: string; duration?: number }; caption?: string; message_id: number }
      | undefined;
    if (!message?.voice) return;
    await this.dispatchMedia(ctx, handler, {
      fileId: message.voice.file_id,
      filename: `voice-${message.message_id}.ogg`,
      mime: "audio/ogg",
      durationSeconds: message.voice.duration,
      text: message.caption ?? "",
    });
  }

  private async handleAudio(ctx: Context, handler: TelegramHandler): Promise<void> {
    const message = ctx.message as
      | {
          audio?: { file_id: string; file_name?: string; mime_type?: string; duration?: number };
          caption?: string;
          message_id: number;
        }
      | undefined;
    if (!message?.audio) return;
    await this.dispatchMedia(ctx, handler, {
      fileId: message.audio.file_id,
      filename: message.audio.file_name ?? `audio-${message.message_id}`,
      mime: message.audio.mime_type ?? "audio/mpeg",
      durationSeconds: message.audio.duration,
      text: message.caption ?? "",
    });
  }

  private async handleDocument(ctx: Context, handler: TelegramHandler): Promise<void> {
    const message = ctx.message as
      | {
          document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
          caption?: string;
          message_id: number;
        }
      | undefined;
    const document = message?.document;
    if (!message || !document) return;
    const filename = document.file_name ?? `document-${message.message_id}`;
    const looksLikeImage =
      (document.mime_type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(filename);
    if (!looksLikeImage) {
      await this.replyUnsupported(ctx, "Por ahora solo puedo procesar imágenes, audio y texto.");
      return;
    }
    await this.dispatchMedia(ctx, handler, {
      fileId: document.file_id,
      filename,
      mime: document.mime_type ?? "image/jpeg",
      text: message.caption ?? "",
    });
  }

  private async dispatchMedia(
    ctx: Context,
    handler: TelegramHandler,
    input: { fileId: string; filename: string; mime: string; text: string; durationSeconds?: number },
  ): Promise<void> {
    try {
      const bytes = await this.download(input.fileId);
      await handler({
        senderId: String(ctx.from?.id ?? ""),
        text: input.text,
        messageId: String(ctx.message?.message_id ?? ""),
        attachments: [
          {
            kind: input.mime.startsWith("image/") ? "image" : "audio",
            filename: input.filename,
            mime: input.mime,
            bytes,
            durationSeconds: input.durationSeconds,
          },
        ],
      });
    } catch (error) {
      this.logger?.error({
        event: "telegram_media_download_failed",
        entryPoint: "telegram",
        error: error instanceof Error ? error.message : String(error),
      });
      await this.replyUnsupported(ctx, "No pude descargar el archivo. Intenta de nuevo.");
    }
  }

  private async download(fileId: string): Promise<Uint8Array> {
    const file = await this.bot.api.getFile(fileId);
    if (!file.file_path) throw new Error("telegram file has no path");
    const response = await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`telegram file download failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async replyUnsupported(ctx: Context, text: string): Promise<void> {
    if (!ctx.from?.id) return;
    await this.bot.api.sendMessage(ctx.from.id, text).catch(() => undefined);
  }

  async send(senderId: string, text: string): Promise<EgressSendResult> {
    const message = await this.bot.api.sendMessage(senderId, text);
    return { providerMessageId: String(message.message_id) };
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    this.started = false;
  }

  status(): string {
    return this.started ? "connected" : "disconnected";
  }
}

export class TelegramChannelAdapter implements IntegrationEgressPort {
  constructor(
    private readonly options: {
      integrationId: string;
      scope: "project" | "global";
      projectSlug?: string;
      transport: TelegramTransport;
      router: { execute(message: IncomingIntegrationMessage): Promise<{ decision: string }> };
      events: EventBus;
      logger: Logger;
    },
  ) {}

  async start(): Promise<void> {
    await this.options.transport.start((message) => {
      void this.options.router
        .execute({
          integrationId: this.options.integrationId,
          kind: "telegram",
          senderId: message.senderId,
          text: message.text,
          externalMessageId: message.messageId,
          ...(message.attachments ? { attachments: message.attachments } : {}),
        })
        .catch((error) =>
          this.options.logger.error({
            event: "telegram_message_failed",
            entryPoint: "telegram",
            integrationId: this.options.integrationId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    });
    this.options.events.publish({
      type: "integration.status",
      integrationId: this.options.integrationId,
      scope: this.options.scope,
      projectSlug: this.options.projectSlug,
      status: this.options.transport.status(),
    });
  }

  async send(_text: string, _recipient?: string): Promise<EgressSendResult> {
    if (!_recipient) throw new Error("telegram replies require a recipient");
    return (await this.options.transport.send(_recipient, _text)) ?? {};
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
