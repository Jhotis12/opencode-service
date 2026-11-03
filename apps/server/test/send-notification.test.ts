import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import type { EgressSendResult, IntegrationEgressPort } from "../src/application/ports/channels.ts";
import { SendNotificationUseCase } from "../src/application/use-cases/send-notification.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

function integration(overrides: Partial<IntegrationRecord> = {}): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    id: "tg1",
    scope: "project",
    projectSlug: "ventas",
    kind: "telegram",
    name: "Ventas",
    slug: "ventas-bot",
    config: {},
    secretRefs: {},
    capabilities: ["inbound_message", "outbound_message"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeEgress implements IntegrationEgressPort {
  sent: Array<{ integrationId: string; text: string; recipient?: string }> = [];
  fail?: Error;
  async send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult> {
    if (this.fail) throw this.fail;
    this.sent.push({ integrationId, text, recipient });
    return { providerMessageId: `msg-${this.sent.length}` };
  }
}

describe("send notification use case", () => {
  it("delivers to telegram with a recipient and records the delivery", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(integration());
    const egress = new FakeEgress();
    const result = await new SendNotificationUseCase(store, egress).execute({
      projectSlug: "ventas",
      integrationId: "tg1",
      recipient: "123",
      text: "Hola {{input.nombre}}",
      input: { nombre: "Ana" },
      actionKey: "r1:notify",
      runId: "r1",
      nodeId: "notify",
    });
    expect(result).toMatchObject({ delivered: true, providerMessageId: "msg-1" });
    expect(egress.sent[0]).toEqual({ integrationId: "tg1", text: "Hola Ana", recipient: "123" });
    expect(store.deliveries.findByActionKey({ actionKey: "r1:notify", integrationId: "tg1" })?.status).toBe("delivered");
    store.close();
  });

  it("deduplicates a delivered action key", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(integration());
    const egress = new FakeEgress();
    const useCase = new SendNotificationUseCase(store, egress);
    const input = {
      projectSlug: "ventas",
      integrationId: "tg1",
      recipient: "123",
      text: "Hola",
      actionKey: "r1:notify",
    };
    await useCase.execute(input);
    const second = await useCase.execute(input);
    expect(second.deduplicated).toBe(true);
    expect(egress.sent).toHaveLength(1);
    store.close();
  });

  it("requires a recipient for telegram and whatsapp", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(integration());
    const egress = new FakeEgress();
    await expect(
      new SendNotificationUseCase(store, egress).execute({
        projectSlug: "ventas",
        integrationId: "tg1",
        text: "Hola",
        actionKey: "r1:notify",
      }),
    ).rejects.toThrow(/recipient/);
    expect(egress.sent).toHaveLength(0);
    store.close();
  });

  it("allows external chat without a recipient and records provider failures", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(integration({ id: "chat1", kind: "external_chat" }));
    const egress = new FakeEgress();
    const useCase = new SendNotificationUseCase(store, egress);
    await useCase.execute({
      projectSlug: "ventas",
      integrationId: "chat1",
      text: "Hola",
      actionKey: "r1:notify",
    });
    expect(egress.sent).toHaveLength(1);

    egress.fail = new Error("provider down");
    await expect(
      useCase.execute({
        projectSlug: "ventas",
        integrationId: "chat1",
        text: "Otra",
        actionKey: "r2:notify",
      }),
    ).rejects.toThrow(/provider down/);
    expect(store.deliveries.findByActionKey({ actionKey: "r2:notify", integrationId: "chat1" })?.status).toBe("failed");
    store.close();
  });

  it("waits for the configured notification rate limit", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(integration({ config: { rateLimitPerMinute: 1, rateLimitWindowMs: 40 } }));
    const egress = new FakeEgress();
    const useCase = new SendNotificationUseCase(store, egress);
    const started = Date.now();
    await useCase.execute({ projectSlug: "ventas", integrationId: "tg1", recipient: "123", text: "uno", actionKey: "r1:notify" });
    await useCase.execute({ projectSlug: "ventas", integrationId: "tg1", recipient: "123", text: "dos", actionKey: "r2:notify" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(30);
    expect(egress.sent).toHaveLength(2);
    store.close();
  });

  it("rejects integrations from another project", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(integration());
    await expect(
      new SendNotificationUseCase(store, new FakeEgress()).execute({
        projectSlug: "soporte",
        integrationId: "tg1",
        recipient: "123",
        text: "Hola",
        actionKey: "r1:notify",
      }),
    ).rejects.toThrow(/does not belong/);
    store.close();
  });
});
