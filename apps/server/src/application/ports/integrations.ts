import type { IntegrationRecord } from "../../domain/entities.ts";
import type { EgressSendResult } from "./channels.ts";

export interface IntegrationManagerPort {
  start(integration: IntegrationRecord): Promise<void>;
  stop(integrationId: string): Promise<void>;
  stopAll(): Promise<void>;
  test(
    integration: IntegrationRecord,
    options?: { recipient?: string },
  ): Promise<{ ok: boolean; detail?: string; latencyMs?: number }>;
  clearTelegramWebhook(integration: IntegrationRecord): Promise<void>;
  status(integrationId: string): string | undefined;
  qr(integrationId: string): string | undefined;
  send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult>;
}
