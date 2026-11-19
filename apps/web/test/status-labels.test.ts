import { describe, expect, it } from "vitest";
import { agentModeLabel, friendlyError, statusBadge, statusLabel, statusTone } from "../src/ui.ts";

describe("status labels", () => {
  it("localizes every run, health and integration state", () => {
    const labels: Record<string, string> = {
      queued: "En cola",
      running: "En ejecución",
      paused: "Pausado",
      succeeded: "Completado",
      failed: "Fallido",
      timed_out: "Tiempo agotado",
      cancelled: "Cancelado",
      skipped: "Omitido",
      ok: "Operativo",
      degraded: "Degradado",
      down: "Caído",
      connected: "Conectado",
      disconnected: "Desconectado",
      needs_config: "Falta configurar",
      qr_pending: "QR pendiente",
      error: "Error",
      active: "Activo",
    };
    for (const [raw, label] of Object.entries(labels)) {
      expect(statusLabel(raw)).toBe(label);
    }
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

  it("maps common API failures to actionable copy", () => {
    expect(friendlyError(new Error("invalid username or password"), "fallback")).toBe(
      "Usuario o contraseña incorrectos.",
    );
    expect(friendlyError(new Error("already exists"), "fallback")).toBe(
      "Ya existe un recurso con ese identificador.",
    );
    expect(friendlyError(new Error("failed to fetch"), "fallback")).toMatch(/No se pudo conectar/);
    expect(friendlyError(new Error("timed out"), "fallback")).toMatch(/tardó demasiado/);
    expect(friendlyError(new Error("custom detail"), "fallback")).toBe("custom detail");
    expect(friendlyError(undefined, "fallback")).toBe("fallback");
  });
});
