import { describe, expect, it } from "vitest";
import { agentModeLabel, statusBadge, statusLabel, statusTone } from "../src/ui.ts";

describe("status labels", () => {
  it("localizes run, health and integration states", () => {
    expect(statusLabel("running")).toBe("En ejecución");
    expect(statusLabel("succeeded")).toBe("Completado");
    expect(statusLabel("timed_out")).toBe("Tiempo agotado");
    expect(statusLabel("ok")).toBe("Operativo");
    expect(statusLabel("needs_config")).toBe("Falta configurar");
    expect(statusLabel("connected")).toBe("Conectado");
    expect(statusLabel("unknown_state")).toBe("unknown_state");
  });

  it("uses the informational tone for running and warning only for attention states", () => {
    expect(statusTone("running")).toBe("info");
    expect(statusBadge("running")).toContain("text-accent");
    expect(statusTone("queued")).toBe("neutral");
    expect(statusBadge("queued")).not.toContain("text-warn");
    expect(statusBadge("paused")).toContain("text-warn");
    expect(statusBadge("failed")).toContain("text-danger");
    expect(statusBadge("ok")).toContain("text-ok");
  });

  it("localizes agent modes", () => {
    expect(agentModeLabel("primary")).toBe("Principal");
    expect(agentModeLabel("subagent")).toBe("Sub-agente");
    expect(agentModeLabel("all")).toBe("Principal y sub-agente");
  });
});
