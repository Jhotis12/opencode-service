import type { Store } from "../ports/store.ts";
import type { IntegrationEgressPort } from "../ports/channels.ts";
import { renderTemplate } from "../../domain/workflow/template.ts";
import type { WorkflowDeliveryRecord } from "../../domain/entities.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
import { resolveDestinationValue } from "./destinations.ts";

export interface SendNotificationInput {
  projectSlug: string;
  integrationId: string;
  text: string;
  input?: unknown;
  recipient?: string;
  actionKey: string;
  runId?: string;
  nodeId?: string;
}

export interface SendNotificationResult {
  delivered: boolean;
  integrationId: string;
  recipient?: string;
  providerMessageId?: string;
  deduplicated?: boolean;
}

const SUPPORTED_CHANNELS = new Set(["telegram", "whatsapp", "external_chat"]);

export class SendNotificationUseCase {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly store: Store,
    private readonly egress: IntegrationEgressPort,
    private readonly logger?: Logger,
  ) {}

  private async waitForRateLimit(integrationId: string, limit: number, windowMs: number): Promise<void> {
    if (!Number.isFinite(limit) || limit <= 0) return;
    const now = Date.now();
    const bucket = (this.buckets.get(integrationId) ?? []).filter((timestamp) => now - timestamp < windowMs);
    if (bucket.length >= limit) {
      const wait = Math.max(0, windowMs - (now - bucket[0]!));
      await new Promise((resolve) => setTimeout(resolve, wait));
      return this.waitForRateLimit(integrationId, limit, windowMs);
    }
    bucket.push(now);
    this.buckets.set(integrationId, bucket);
  }

  async execute(input: SendNotificationInput): Promise<SendNotificationResult> {
    const integration = this.store.integrations.findById(input.integrationId);
    if (!integration || integration.scope !== "project" || integration.projectSlug !== input.projectSlug) {
      throw new Error("notification integration does not belong to this project");
    }
    if (!SUPPORTED_CHANNELS.has(integration.kind)) {
      throw new Error(`notification channel is not supported: ${integration.kind}`);
    }
    if (!integration.capabilities.includes("outbound_message")) {
      throw new Error(`integration ${integration.id} does not support outbound messages`);
    }
    const recipient = resolveDestinationValue(this.store, input.projectSlug, input.recipient);
    if (["telegram", "whatsapp"].includes(integration.kind) && !recipient) {
      throw new Error(`${integration.kind} notifications require a recipient`);
    }
    if (!input.actionKey) throw new Error("notification actionKey is required");

    const rateLimit = Number(integration.config.rateLimitPerMinute ?? 60);
    const rateWindow = Number(integration.config.rateLimitWindowMs ?? 60_000);
    await this.waitForRateLimit(integration.id, rateLimit, rateWindow);

    const existing = this.store.deliveries.findByActionKey({
      actionKey: input.actionKey,
      integrationId: input.integrationId,
    });
    if (existing?.status === "delivered") {
      return {
        delivered: true,
        integrationId: existing.integrationId,
        recipient: existing.recipient,
        providerMessageId: existing.providerMessageId,
        deduplicated: true,
      };
    }

    const rendered = input.input === undefined ? input.text : String(renderTemplate(input.text, input.input));
    const now = new Date().toISOString();
    const attempts = (existing?.attempts ?? 0) + 1;
    const delivery: WorkflowDeliveryRecord = existing ?? {
      id: crypto.randomUUID(),
      projectSlug: input.projectSlug,
      runId: input.runId,
      nodeId: input.nodeId,
      integrationId: input.integrationId,
      actionKey: input.actionKey,
      recipient,
      status: "pending",
      attempts,
      createdAt: now,
      updatedAt: now,
    };
    if (existing) {
      this.store.deliveries.update(existing.id, { status: "pending", attempts, recipient });
    } else {
      this.store.deliveries.create({ ...delivery, attempts });
    }

    try {
      const result = await this.egress.send(input.integrationId, rendered, recipient);
      this.store.deliveries.update(delivery.id, {
        status: "delivered",
        providerMessageId: result.providerMessageId,
        attempts,
      });
      this.logger?.info({
        event: "delivery.succeeded",
        projectSlug: input.projectSlug,
        runId: input.runId,
        nodeId: input.nodeId,
        integrationId: input.integrationId,
        attempts,
      });
      return {
        delivered: true,
        integrationId: input.integrationId,
        recipient,
        providerMessageId: result.providerMessageId,
      };
    } catch (error) {
      this.store.deliveries.update(delivery.id, {
        status: "failed",
        attempts,
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      });
      this.logger?.error({
        event: "delivery.failed",
        projectSlug: input.projectSlug,
        runId: input.runId,
        nodeId: input.nodeId,
        integrationId: input.integrationId,
        attempts,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
