import { describe, expect, it } from "bun:test";
import type { SseEvent } from "@platform/shared";
import { IntegrationEgressRouter } from "../src/infrastructure/in/channels/egress-router.ts";
import { TelegramChannelAdapter, type TelegramTransport } from "../src/infrastructure/in/channels/telegram-adapter.ts";
import {
  WhatsAppChannelAdapter,
  WhatsAppCloudTransport,
  parseCloudWebhook,
  type WhatsAppTransport,
} from "../src/infrastructure/in/channels/whatsapp-adapter.ts";
import type { IncomingAttachment } from "../src/application/ports/channels.ts";
import type { AudioConverterPort } from "../src/application/ports/audio.ts";
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
  handler?: (message: {
    senderId: string;
    text: string;
    messageId?: string;
    attachments?: IncomingAttachment[];
  }) => void | Promise<void>;
  sent: Array<{ to: string; text: string }> = [];
  sentVoice: Array<{ to: string; bytes: Uint8Array; filename: string; caption?: string }> = [];
  sentAudio: Array<{ to: string; bytes: Uint8Array; filename: string; mime: string; caption?: string }> = [];
  running = false;
  verified = false;
  webhookCleared = false;
  async verify() {
    this.verified = true;
    return { botId: "1", username: "test_bot" };
  }
  async clearWebhook() {
    this.webhookCleared = true;
  }
  async start(handler: (message: {
    senderId: string;
    text: string;
    messageId?: string;
    attachments?: IncomingAttachment[];
  }) => void | Promise<void>) {
    this.handler = handler;
    this.running = true;
  }
  async send(to: string, text: string) {
    this.sent.push({ to, text });
    return { providerMessageId: `${this.type}-${this.sent.length}` };
  }
  async sendVoice(to: string, bytes: Uint8Array, filename: string, caption?: string) {
    this.sentVoice.push({ to, bytes, filename, caption });
    return { providerMessageId: `${this.type}-voice-${this.sentVoice.length}` };
  }
  async sendAudio(to: string, bytes: Uint8Array, filename: string, mime: string, caption?: string) {
    this.sentAudio.push({ to, bytes, filename, mime, caption });
    return { providerMessageId: `${this.type}-audio-${this.sentAudio.length}` };
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
    return { providerMessageId: `${this.type}-${this.sent.length}` };
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
      integrationId: "telegram",
      scope: "project",
      projectSlug: "ventas",
      transport,
      router: router as never,
      events: { publish: (event) => events.push(event) },
      logger: silentLogger,
    });
    await adapter.start();
    transport.handler?.({ senderId: "123", text: "hola" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls[0]).toEqual({ integrationId: "telegram", kind: "telegram", senderId: "123", text: "hola" });
    await adapter.send("respuesta", "123");
    expect(transport.sent[0]).toEqual({ to: "123", text: "respuesta" });
    await expect(adapter.send("otra", "123")).resolves.toEqual({ providerMessageId: "telegram-2" });
    expect(events.some((event) => event.type === "integration.status" && event.status === "connected")).toBe(true);
    await adapter.stop();
    expect(events.some((event) => event.type === "integration.status" && event.status === "disconnected")).toBe(true);
  });

  it("forwards telegram media attachments to the router", async () => {    const transport = new FakeTelegram();
    const { router, calls } = routerRecorder();
    const adapter = new TelegramChannelAdapter({
      integrationId: "telegram",
      scope: "project",
      projectSlug: "ventas",
      transport,
      router: router as never,
      events: { publish() {} },
      logger: silentLogger,
    });
    await adapter.start();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    transport.handler?.({
      senderId: "123",
      text: "mira",
      messageId: "m1",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls[0]).toEqual({
      integrationId: "telegram",
      kind: "telegram",
      senderId: "123",
      text: "mira",
      externalMessageId: "m1",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
  });

  it("requires a recipient for telegram replies", async () => {
    const adapter = new TelegramChannelAdapter({
      integrationId: "telegram",
      scope: "project",
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
      integrationId: "whatsapp",
      scope: "project",
      projectSlug: "ventas",
      transport,
      router: router as never,
      events: { publish: (event) => events.push(event) },
      logger: silentLogger,
    });
    await adapter.start();
    transport.onQr?.("qr-payload");
    transport.handler?.({ senderId: "57300@s.whatsapp.net", text: "hola" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(events.some((event) => event.type === "integration.status" && event.qr === "qr-payload")).toBe(true);
    expect(calls[0]).toEqual({
      integrationId: "whatsapp",
      kind: "whatsapp",
      senderId: "57300@s.whatsapp.net",
      text: "hola",
    });
    await adapter.send("respuesta", "57300@s.whatsapp.net");
    expect(transport.sent[0]?.text).toBe("respuesta");
    await expect(adapter.send("otra", "57300@s.whatsapp.net")).resolves.toEqual({
      providerMessageId: "whatsapp-2",
    });
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

describe("telegram media egress", () => {
  const media = {
    bytes: new Uint8Array([0xff, 0xfb, 0x90, 0x64]),
    filename: "reply.mp3",
    mime: "audio/mpeg",
    caption: "Hola",
  };

  function adapter(
    transport: FakeTelegram,
    converter?: AudioConverterPort,
  ) {
    return new TelegramChannelAdapter({
      integrationId: "telegram",
      scope: "project",
      projectSlug: "ventas",
      transport,
      router: { execute: async () => ({ decision: "agent" }) },
      events: { publish() {} },
      logger: silentLogger,
      converter,
    });
  }

  it("converts short audio to a native voice note", async () => {
    const transport = new FakeTelegram();
    const converter: AudioConverterPort = {
      async toOpus() {
        return { bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53]), durationSeconds: 12 };
      },
    };
    await adapter(transport, converter).sendMedia("telegram", media, "123");
    expect(transport.sentVoice).toHaveLength(1);
    expect(transport.sentVoice[0]).toMatchObject({ to: "123", caption: "Hola" });
    expect(transport.sentAudio).toHaveLength(0);
  });

  it("sends long audio as a file and splits an oversized caption", async () => {
    const transport = new FakeTelegram();
    const converter: AudioConverterPort = {
      async toOpus() {
        return { bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53]), durationSeconds: 90 };
      },
    };
    await adapter(transport, converter).sendMedia("telegram", { ...media, caption: "x".repeat(1_025) }, "123");
    expect(transport.sentAudio).toHaveLength(1);
    expect(transport.sentAudio[0]?.caption).toBeUndefined();
    expect(transport.sent.at(-1)).toEqual({ to: "123", text: "x".repeat(1_025) });
  });

  it("falls back to the original audio file when conversion fails", async () => {
    const transport = new FakeTelegram();
    const converter: AudioConverterPort = {
      async toOpus() {
        throw new Error("ffmpeg missing");
      },
    };
    await adapter(transport, converter).sendMedia("telegram", media, "123");
    expect(transport.sentVoice).toHaveLength(0);
    expect(transport.sentAudio).toHaveLength(1);
    expect(transport.sentAudio[0]).toMatchObject({ to: "123", mime: "audio/mpeg", caption: "Hola" });
  });

  it("fails explicitly when a channel has no media transport", async () => {
    const router = new IntegrationEgressRouter();
    await expect(router.sendMedia("whatsapp", media, "123")).rejects.toThrow(/no media transport/);
  });
});

describe("egress router", () => {
  it("routes replies to the registered integration", async () => {
    const router = new IntegrationEgressRouter();
    const sent: string[] = [];
    router.register("telegram", async (text) => {
      sent.push(text);
      return {};
    });
    await router.send("telegram", "hola");
    expect(sent).toEqual(["hola"]);
    router.unregister("telegram");
    await expect(router.send("telegram", "hola")).rejects.toThrow(/no transport/);
  });
});
