import { describe, expect, it } from "vitest";
import { ApiClientError } from "../src/api.ts";
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

  it.each([
    ["invalid username or password", "Usuario o contraseña incorrectos."],
    ["already exists", "Ya existe un recurso con ese identificador."],
    ["failed to fetch", "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo."],
    ["unauthorized", "Tu sesión expiró. Vuelve a iniciar sesión."],
    ["timed out", "La operación tardó demasiado. Vuelve a intentarlo."],
  ])("maps %s to its Spanish copy", (message, copy) => {
    expect(friendlyError(new Error(message), "fallback")).toBe(copy);
  });

  it("keeps the mapped copy when the server error also carries a code", () => {
    expect(friendlyError(new ApiClientError(401, "UNAUTHORIZED", "unauthorized"), "fallback")).toBe(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
    );
  });

  it("answers an unmapped server code with the fallback plus the copyable code, never the server text", () => {
    const copy = friendlyError(
      new ApiClientError(500, "DB_POLICY_DENIED", "row level security policy denied"),
      "No se pudieron guardar los ajustes.",
    );
    expect(copy).toBe("No se pudieron guardar los ajustes. (código: DB_POLICY_DENIED)");
    expect(copy).not.toContain("row level security");
  });

  it("never passes an unmapped raw message through, even when it has no code", () => {
    expect(friendlyError(new Error("database policy denied"), "fallback")).toBe("fallback");
    expect(friendlyError("row level security policy denied", "fallback")).toBe("fallback");
  });

  it("uses a generic Spanish sentence when the call site has no fallback", () => {
    expect(friendlyError(new ApiClientError(500, "INTERNAL_ERROR", "boom"), "")).toBe(
      "La operación no se pudo completar. (código: INTERNAL_ERROR)",
    );
    expect(friendlyError(new Error("boom"), "")).toBe("La operación no se pudo completar.");
  });

  it("keeps the fallback for a rejection that carries nothing", () => {
    expect(friendlyError(undefined, "fallback")).toBe("fallback");
  });
});
