import { Bot } from "grammy";
import type { ChannelEgressPort, ChannelTransport } from "../../../application/ports/channels.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";
import type { RouteIncomingMessageUseCase } from "../../../application/use-cases/route-channel-message.ts";

export interface TelegramTransport extends ChannelTransport {
  readonly type: "telegram";
}

export class GrammyTransport implements TelegramTransport {
  readonly type = "telegram" as const;
  private readonly bot: Bot;
  private started = false;

  constructor(token: string) {
    this.bot = new Bot(token);
  }

  async start(handler: (message: { senderId: string; text: string }) => void): Promise<void> {
    this.bot.on("message:text", (ctx) => {
      handler({ senderId: String(ctx.from.id), text: ctx.message.text });
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

  async send(senderId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(senderId, text);
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    this.started = false;
  }

  status(): string {
    return this.started ? "connected" : "disconnected";
  }
}

export class TelegramChannelAdapter implements ChannelEgressPort {
  constructor(
    private readonly options: {
      slug: string;
      transport: TelegramTransport;
      router: Pick<RouteIncomingMessageUseCase, "execute">;
      events: EventBus;
      logger: Logger;
    },
  ) {}

  async start(): Promise<void> {
    await this.options.transport.start((message) => {
      void this.options.router
        .execute({
          channelSlug: this.options.slug,
          channelType: "telegram",
          senderId: message.senderId,
          text: message.text,
        })
        .catch((error) =>
          this.options.logger.error({
            event: "telegram_message_failed",
            entryPoint: "telegram",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    });
    this.options.events.publish({
      type: "channel.status",
      channelSlug: this.options.slug,
      status: this.options.transport.status(),
    });
  }

  async send(_text: string, _recipient?: string): Promise<void> {
    if (!_recipient) throw new Error("telegram replies require a recipient");
    await this.options.transport.send(_recipient, _text);
  }

  async stop(): Promise<void> {
    await this.options.transport.stop();
    this.options.events.publish({
      type: "channel.status",
      channelSlug: this.options.slug,
      status: "disconnected",
    });
  }
}
