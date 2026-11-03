import type { Store } from "../ports/store.ts";
import type { IntegrationEgressPort } from "../ports/channels.ts";
import { renderTemplate } from "../../domain/workflow/template.ts";
import type { WorkflowDeliveryRecord } from "../../domain/entities.ts";

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
  constructor(
    private readonly store: Store,
    private readonly egress: IntegrationEgressPort,
  ) {}

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
    if (["telegram", "whatsapp"].includes(integration.kind) && !input.recipient) {
      throw new Error(`${integration.kind} notifications require a recipient`);
    }
    if (!input.actionKey) throw new Error("notification actionKey is required");

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
      recipient: input.recipient,
      status: "pending",
      attempts,
      createdAt: now,
      updatedAt: now,
    };
    if (existing) {
      this.store.deliveries.update(existing.id, { status: "pending", attempts, recipient: input.recipient });
    } else {
      this.store.deliveries.create({ ...delivery, attempts });
    }

    try {
      const result = await this.egress.send(input.integrationId, rendered, input.recipient);
      this.store.deliveries.update(delivery.id, {
        status: "delivered",
        providerMessageId: result.providerMessageId,
        attempts,
      });
      return {
        delivered: true,
        integrationId: input.integrationId,
        recipient: input.recipient,
        providerMessageId: result.providerMessageId,
      };
    } catch (error) {
      this.store.deliveries.update(delivery.id, {
        status: "failed",
        attempts,
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      });
      throw error;
    }
  }
}
