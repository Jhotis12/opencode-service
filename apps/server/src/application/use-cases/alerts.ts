import type { SseEvent } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { IntegrationEgressPort } from "../ports/channels.ts";
import type { Logger } from "../../domain/telemetry/index.ts";
import type { IntegrationRecord } from "../../domain/entities.ts";

const DEFAULT_THROTTLE_MS = 5 * 60_000;

function redact(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_URL]")
    .replace(/mysql:\/\/[^\s]+/gi, "[REDACTED_URL]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/sk_[A-Za-z0-9_-]+/g, "[REDACTED_KEY]")
    .replace(/password\s*=\s*[^\s]+/gi, "password=[REDACTED]");
}

export class AlertService {
  private readonly lastSent = new Map<string, number>();
  private unsubscribe?: () => void;

  constructor(
    private readonly deps: {
      store: Store;
      egress: IntegrationEgressPort;
      events: { subscribe(handler: (event: SseEvent) => void): () => void };
      logger: Logger;
      throttleMs?: number;
    },
  ) {}

  start(): void {
    this.unsubscribe = this.deps.events.subscribe((event) => this.handle(event));
  }

  stop(): void {
    this.unsubscribe?.();
  }

  async handle(event: SseEvent): Promise<void> {
    if (event.type === "run.updated" && (event.status === "failed" || event.status === "timed_out")) {
      await this.send("run.failed", {
        key: `run:${event.runId}`,
        title: `Fallo en ${event.projectSlug}`,
        lines: [
          `Proyecto: ${event.projectSlug}`,
          `Flujo: ${event.workflowId}`,
          event.nodeId ? `Nodo: ${event.nodeId}` : undefined,
          `Run: ${event.runId}`,
          event.error ? `Error: ${redact(event.error)}` : undefined,
        ],
        projectSlug: event.projectSlug,
      });
    }
    if (event.type === "integration.status" && (event.status === "error" || event.status === "needs_config")) {
      await this.send("integration.down", {
        key: `integration:${event.integrationId}:${event.status}`,
        title: `Integración ${event.status}`,
        lines: [
          event.projectSlug ? `Proyecto: ${event.projectSlug}` : "Plano: global",
          `Integración: ${event.integrationId}`,
          event.detail ? `Detalle: ${redact(event.detail)}` : undefined,
        ],
        projectSlug: event.projectSlug,
      });
    }
  }

  private async send(
    type: "run.failed" | "integration.down" | "health.degraded",
    input: { key: string; title: string; lines: Array<string | undefined>; projectSlug?: string },
  ): Promise<void> {
    const now = Date.now();
    const last = this.lastSent.get(input.key) ?? 0;
    if (now - last < (this.deps.throttleMs ?? DEFAULT_THROTTLE_MS)) {
      this.deps.logger.info({ event: "alert_suppressed", type, key: input.key });
      return;
    }
    this.lastSent.set(input.key, now);
    const channels = this.deps.store.integrations.list({ scope: "global" }).filter((integration) => {
      const alerts = Array.isArray(integration.config.alerts) ? integration.config.alerts : [];
      return alerts.includes(type) && ["telegram", "whatsapp", "external_chat", "email"].includes(integration.kind);
    });
    if (channels.length === 0) {
      this.deps.logger.info({ event: "alert_no_channel", type, key: input.key });
      return;
    }
    const text = [input.title, ...input.lines.filter((line): line is string => Boolean(line))].join("\n");
    for (const channel of channels) {
      try {
        const recipient = typeof channel.config.alertRecipient === "string" ? channel.config.alertRecipient : undefined;
        await this.deps.egress.send(channel.id, text, recipient);
        this.deps.logger.info({ event: "alert_sent", type, key: input.key, integrationId: channel.id });
      } catch (error) {
        this.deps.logger.error({
          event: "alert_failed",
          type,
          key: input.key,
          integrationId: channel.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export function alertChannels(integrations: IntegrationRecord[]): IntegrationRecord[] {
  return integrations.filter((integration) => {
    const alerts = Array.isArray(integration.config.alerts) ? integration.config.alerts : [];
    return alerts.length > 0;
  });
}
