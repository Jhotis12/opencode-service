import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { AlertService } from "../src/application/use-cases/alerts.ts";
import type { IntegrationEgressPort } from "../src/application/ports/channels.ts";
import type { SseEvent } from "@platform/shared";
import type { Logger } from "../src/domain/telemetry/index.ts";

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return logger;
  },
};

class FakeEgress implements IntegrationEgressPort {
  sent: Array<{ integrationId: string; text: string; recipient?: string }> = [];
  async send(integrationId: string, text: string, recipient?: string) {
    this.sent.push({ integrationId, text, recipient });
    return {};
  }
}

function globalChannel(store: SqliteStore, alerts: string[]) {
  const now = new Date().toISOString();
  store.integrations.create({
    id: "global-1",
    scope: "global",
    kind: "telegram",
    name: "Alertas",
    slug: "alertas",
    config: { alerts, alertRecipient: "123" },
    secretRefs: { token: "token" },
    capabilities: ["inbound_message", "outbound_message"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  });
}

describe("deterministic alerts", () => {
  it("sends one alert per run failure and throttles duplicates", async () => {
    const store = new SqliteStore(":memory:");
    globalChannel(store, ["run.failed"]);
    const egress = new FakeEgress();
    let handler: ((event: SseEvent) => void) | undefined;
    const service = new AlertService({
      store,
      egress,
      events: {
        subscribe(next) {
          handler = next;
          return () => undefined;
        },
      },
      logger,
      throttleMs: 60_000,
    });
    service.start();
    const event: SseEvent = {
      type: "run.updated",
      projectSlug: "ventas",
      runId: "run-1",
      workflowId: "wf",
      status: "failed",
      nodeId: "send",
      error: "boom sk_secret_123 password=supersecret",
    };
    handler?.(event);
    handler?.(event);
    expect(egress.sent).toHaveLength(1);
    expect(egress.sent[0]?.recipient).toBe("123");
    expect(egress.sent[0]?.text).toContain("ventas");
    expect(egress.sent[0]?.text).not.toContain("sk_secret_123");
    expect(egress.sent[0]?.text).not.toContain("supersecret");
    store.close();
  });

  it("prefers a project alert channel over global channels", async () => {
    const store = new SqliteStore(":memory:");
    globalChannel(store, ["run.failed"]);
    const now = new Date().toISOString();
    store.integrations.create({
      id: "project-1",
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Alertas ventas",
      slug: "alertas-ventas",
      config: { alerts: ["run.failed"], alertRecipient: "project-recipient" },
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const egress = new FakeEgress();
    const service = new AlertService({
      store,
      egress,
      events: { subscribe: () => () => undefined },
      logger,
    });
    await service.handle({
      type: "run.updated",
      projectSlug: "ventas",
      runId: "run-3",
      workflowId: "wf",
      status: "failed",
    });
    expect(egress.sent[0]).toMatchObject({ integrationId: "project-1", recipient: "project-recipient" });
    store.close();
  });

  it("does nothing when no global channel subscribes", async () => {
    const store = new SqliteStore(":memory:");
    const egress = new FakeEgress();
    const service = new AlertService({
      store,
      egress,
      events: { subscribe: () => () => undefined },
      logger,
    });
    await service.handle({
      type: "run.updated",
      projectSlug: "ventas",
      runId: "run-2",
      workflowId: "wf",
      status: "timed_out",
    });
    expect(egress.sent).toHaveLength(0);
    store.close();
  });
});
