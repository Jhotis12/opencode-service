import type { IntegrationRecord } from "../../domain/entities.ts";

export interface IntegrationManagerPort {
  start(integration: IntegrationRecord): Promise<void>;
  stop(integrationId: string): Promise<void>;
  stopAll(): Promise<void>;
  test(integration: IntegrationRecord): Promise<{ ok: boolean; detail?: string; latencyMs?: number }>;
  status(integrationId: string): string | undefined;
  qr(integrationId: string): string | undefined;
  send(integrationId: string, text: string, recipient?: string): Promise<void>;
}
