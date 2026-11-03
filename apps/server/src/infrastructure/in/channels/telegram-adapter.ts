import { Bot } from "grammy";
import type {
  EgressSendResult,
  IncomingIntegrationMessage,
  IntegrationEgressPort,
  IntegrationTransport,
} from "../../../application/ports/channels.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";

export interface TelegramTransport extends IntegrationTransport {
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
