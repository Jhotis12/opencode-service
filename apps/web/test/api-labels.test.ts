import { afterEach, describe, expect, it, vi } from "vitest";
import { api, runOriginLabel, runSourceLabel } from "../src/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("run labels", () => {
  it("localizes the origin and the technical source detail", () => {
    expect(runOriginLabel("web_ui")).toBe("Interfaz web");
    expect(runSourceLabel("canvas:web")).toBe("Lienzo web");
    expect(runSourceLabel("cron:0 9 * * *")).toBe("Programación · 0 9 * * *");
    expect(runSourceLabel("webhook:notify")).toBe("Webhook · notify");
    expect(runSourceLabel("replay:abcdef123456")).toBe("Re-ejecución de abcdef12");
    expect(runSourceLabel("once")).toBe("Una vez");
    expect(runSourceLabel("sin-prefijo-conocido")).toBe("sin-prefijo-conocido");
  });
});

describe("vault deletion", () => {
  it("sends the project scope to the vault endpoint and keeps the global call unscoped", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await api.deleteSecret("provider:token", "ventas");
    await api.deleteSecret("provider:token");
    await api.deleteProjectSecret("ventas", "api_key");

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/vault/secrets/provider%3Atoken?project=ventas",
      "/api/vault/secrets/provider%3Atoken",
      "/api/vault/secrets/api_key?project=ventas",
    ]);
  });
});
