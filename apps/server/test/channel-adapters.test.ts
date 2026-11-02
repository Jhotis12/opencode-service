import { describe, expect, it } from "bun:test";
import type { SseEvent } from "@platform/shared";
import { ChannelEgressRouter } from "../src/infrastructure/in/channels/egress-router.ts";
import {
  TelegramChannelAdapter,
  type TelegramTransport,
} from "../src/infrastructure/in/channels/telegram-adapter.ts";
import {
  WhatsAppChannelAdapter,
  WhatsAppCloudTransport,
  parseCloudWebhook,
  type WhatsAppTransport,
} from "../src/infrastructure/in/channels/whatsapp-adapter.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

class FakeTelegram implements TelegramTransport {
  readonly type = "telegram" as const;
  handler?: (message: { senderId: string; text: string }) => void;
  sent: Array<{ to: string; text: string }> = [];
  running = false;
  async start(handler: (message: { senderId: string; text: string }) => void) {
    this.handler = handler;
    this.running = true;
  }
  async send(to: string, text: string) {
    this.sent.push({ to, text });
  }
  async stop() {
    this.running = false;
  }
  status() {
    return this.running ? "connected" : "disconnected";
  }
}

class FakeWhatsApp implements WhatsAppTransport {
  readonly type = "whatsapp" as const;
  handler?: (message: { senderId: string; text: string }) => void;
  onQr?: (qr: string) => void;
  sent: Array<{ to: string; text: string }> = [];
  running = false;
  async start(handler: (message: { senderId: string; text: string }) => void, onQr: (qr: string) => void) {
    this.handler = handler;
    this.onQr = onQr;
    this.running = true;
  }
  async send(to: string, text: string) {
    this.sent.push({ to, text });
  }
  async stop() {
    this.running = false;
  }
  status() {
    return this.running ? "connected" : "disconnected";
  }
}

function routerRecorder() {
  const calls: unknown[] = [];
  return {
    calls,
    router: {
      execute: async (input: unknown) => {
        calls.push(input);
        return { decision: "orchestrator" };
      },
    },
  };
}

describe("channel adapters", () => {
  it("routes telegram messages and replies to the sender", async () => {
    const transport = new FakeTelegram();
    const { router, calls } = routerRecorder();
    const events: SseEvent[] = [];
    const adapter = new TelegramChannelAdapter({
      slug: "telegram",
      transport,
      router: router as never,
      events: { publish: (event) => events.push(event) },
      logger: silentLogger,
    });
    await adapter.start();
    transport.handler?.({ senderId: "123", text: "hola" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls[0]).toEqual({ channelSlug: "telegram", channelType: "telegram", senderId: "123", text: "hola" });
    await adapter.send("respuesta", "123");
    expect(transport.sent[0]).toEqual({ to: "123", text: "respuesta" });
    expect(events.some((event) => event.type === "channel.status" && event.status === "connected")).toBe(true);
    await adapter.stop();
    expect(events.some((event) => event.type === "channel.status" && event.status === "disconnected")).toBe(true);
  });

  it("requires a recipient for telegram replies", async () => {
    const adapter = new TelegramChannelAdapter({
      slug: "telegram",
      transport: new FakeTelegram(),
      router: routerRecorder().router as never,
      events: { publish() {} },
      logger: silentLogger,
    });
    await expect(adapter.send("hola")).rejects.toThrow(/recipient/);
  });

  it("publishes whatsapp QR codes and routes messages", async () => {
    const transport = new FakeWhatsApp();
    const { router, calls } = routerRecorder();
    const events: SseEvent[] = [];
    const adapter = new WhatsAppChannelAdapter({
      slug: "whatsapp",
      transport,
      router: router as never,
      events: { publish: (event) => events.push(event) },
      logger: silentLogger,
    });
    await adapter.start();
    transport.onQr?.("qr-payload");
    transport.handler?.({ senderId: "57300@s.whatsapp.net", text: "hola" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(events.some((event) => event.type === "channel.status" && event.qr === "qr-payload")).toBe(true);
    expect(calls[0]).toEqual({
      channelSlug: "whatsapp",
      channelType: "whatsapp",
      senderId: "57300@s.whatsapp.net",
      text: "hola",
    });
    await adapter.send("respuesta", "57300@s.whatsapp.net");
    expect(transport.sent[0]?.text).toBe("respuesta");
  });

  it("parses Meta Cloud webhooks", () => {
    const messages = parseCloudWebhook({
      entry: [{ changes: [{ value: { messages: [{ from: "57300", text: { body: "hola" } }] } }] }],
    });
    expect(messages).toEqual([{ senderId: "57300", text: "hola" }]);
    expect(parseCloudWebhook({})).toEqual([]);
  });

  it("sends through the official WhatsApp Cloud API", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const transport = new WhatsAppCloudTransport("token", "phone-1", (async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    const received: unknown[] = [];
    await transport.start((message) => received.push(message));
    transport.handleWebhook({
      entry: [{ changes: [{ value: { messages: [{ from: "57300", text: { body: "hola" } }] } }] }],
    });
    expect(received).toEqual([{ senderId: "57300", text: "hola" }]);
    await transport.send("57300", "respuesta");
    expect(requests[0]?.url).toContain("phone-1/messages");
    expect((requests[0]?.body as { to: string }).to).toBe("57300");
  });
});

describe("egress router", () => {
  it("routes replies to the registered channel", async () => {
    const router = new ChannelEgressRouter();
    const sent: string[] = [];
    router.register("telegram", async (text) => {
      sent.push(text);
    });
    await router.send("telegram", "hola");
    expect(sent).toEqual(["hola"]);
    router.unregister("telegram");
    await expect(router.send("telegram", "hola")).rejects.toThrow(/no transport/);
  });
});
