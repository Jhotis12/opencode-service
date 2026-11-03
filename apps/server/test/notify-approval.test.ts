import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import type { EgressSendResult, IntegrationEgressPort } from "../src/application/ports/channels.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import { SendNotificationUseCase } from "../src/application/use-cases/send-notification.ts";
import { NotifyApprovalUseCase } from "../src/application/use-cases/notify-approval.ts";
import type { IntegrationRecord, WorkflowRunRecord } from "../src/domain/entities.ts";

class FakeEgress implements IntegrationEgressPort {
  sent: Array<{ integrationId: string; text: string; recipient?: string }> = [];
  async send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult> {
    this.sent.push({ integrationId, text, recipient });
    return { providerMessageId: "m1" };
  }
}

function logger() {
  const warnings: Array<Record<string, unknown>> = [];
  const value: Logger = {
    debug() {},
    info() {},
    warn(bindings) {
      warnings.push(bindings);
    },
    error() {},
    child() {
      return value;
    },
  };
  return { logger: value, warnings };
}

function integration(id: string): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    id,
    scope: "project",
    projectSlug: "ventas",
    kind: "telegram",
    name: id,
    slug: id,
    config: {},
    secretRefs: {},
    capabilities: ["inbound_message", "outbound_message"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  };
}

function run(overrides: Partial<WorkflowRunRecord> = {}): WorkflowRunRecord {
  return {
    id: "r1",
    projectSlug: "ventas",
    workflowId: "wf",
    status: "paused",
    payloadHash: "hash",
    input: {},
    entryPoint: "schedule",
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setup(approvalIntegrationId?: string, approvalRecipient?: string) {
  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  store.projects.create({
    id: "p1",
    slug: "ventas",
    name: "Ventas",
    description: "",
    approvalIntegrationId,
    approvalRecipient,
    createdAt: now,
    updatedAt: now,
  });
  store.integrations.create(integration("tg-origin"));
  store.integrations.create(integration("tg-project"));
  const egress = new FakeEgress();
  const log = logger();
  const useCase = new NotifyApprovalUseCase(
    store,
    new SendNotificationUseCase(store, egress),
    log.logger,
  );
  return { store, egress, useCase, warnings: log.warnings };
}

describe("approval notification routing", () => {
  it("uses the run origin channel when available", async () => {
    const { store, egress, useCase } = setup("tg-project", "project-recipient");
    await useCase.execute(run({ integrationId: "tg-origin", launchedBy: "sender-1" }), "review");
    expect(egress.sent[0]).toMatchObject({ integrationId: "tg-origin", recipient: "sender-1" });
    store.close();
  });

  it("falls back to the project approval channel for manual and scheduled runs", async () => {
    const { store, egress, useCase } = setup("tg-project", "project-recipient");
    await useCase.execute(run(), "review");
    expect(egress.sent[0]).toMatchObject({ integrationId: "tg-project", recipient: "project-recipient" });
    store.close();
  });

  it("records a warning when no approval channel is configured", async () => {
    const { store, useCase, warnings } = setup();
    await useCase.execute(run(), "review");
    expect(warnings.some((warning) => warning.event === "approval_notification_missing")).toBe(true);
    store.close();
  });
});
