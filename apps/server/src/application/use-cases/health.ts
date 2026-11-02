import type { HealthSnapshot, ServiceHealth } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { Metrics } from "../../domain/telemetry/index.ts";

export class GetHealthUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      agent: AgentRuntimePort;
      metrics: Metrics;
      startedAt: number;
    },
  ) {}

  async execute(): Promise<HealthSnapshot> {
    const services: ServiceHealth[] = [];

    const agentHealth = await this.deps.agent.health();
    services.push({
      name: "OpenCode V2",
      status: agentHealth.ok ? "ok" : "down",
      detail: agentHealth.detail,
      latencyMs: agentHealth.latencyMs,
    });

    const dbStarted = Date.now();
    try {
      this.deps.store.users.count();
      services.push({ name: "Database", status: "ok", detail: "SQLite reachable", latencyMs: Date.now() - dbStarted });
    } catch (error) {
      services.push({
        name: "Database",
        status: "down",
        detail: error instanceof Error ? error.message : "database error",
        latencyMs: Date.now() - dbStarted,
      });
    }

    for (const integration of this.deps.store.integrations.listAll()) {
      services.push({
        name: `Integration ${integration.name}`,
        status:
          integration.status === "error"
            ? "down"
            : integration.status === "needs_config"
              ? "degraded"
              : "ok",
        detail: `${integration.kind} · ${integration.status}`,
      });
    }

    services.push({
      name: "Global orchestrator",
      status: "ok",
      detail: "Control workspace configured",
    });

    services.push({
      name: "Worker pool",
      status: "ok",
      detail: "Bun workers spawn on demand",
    });

    const status = services.some((service) => service.status === "down")
      ? "down"
      : services.some((service) => service.status === "degraded")
        ? "degraded"
        : "ok";

    return {
      status,
      uptimeSeconds: Math.floor((Date.now() - this.deps.startedAt) / 1000),
      services,
      metrics: this.deps.metrics.snapshot(),
      recentErrors: this.deps.store.errors.recent(20).map((row) => ({
        id: row.id,
        requestId: row.requestId,
        entryPoint: row.entryPoint,
        level: row.level,
        message: row.message,
        stack: row.stack,
        context: row.context ? (JSON.parse(row.context) as Record<string, unknown>) : undefined,
        createdAt: row.createdAt,
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
