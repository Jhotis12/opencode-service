import { describe, expect, it } from "bun:test";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import { redact } from "../src/domain/telemetry/index.ts";
import { createMemoryLogger } from "../src/infrastructure/out/telemetry/logger.ts";
import { sanitizeSentryEvent } from "../src/infrastructure/out/telemetry/sentry.ts";

describe("redaction", () => {
  it("redacts secret-looking keys recursively", () => {
    const output = redact({ user: "ana", password: "hunter2", nested: { apiKey: "abc", ok: 1 } });
    expect(output).toEqual({ user: "ana", password: "[REDACTED]", nested: { apiKey: "[REDACTED]", ok: 1 } });
  });

  it("keeps ordinary fields untouched", () => {
    expect(redact({ projectSlug: "ventas", durationMs: 12 })).toEqual({ projectSlug: "ventas", durationMs: 12 });
  });
});

describe("structured logger", () => {
  it("emits json with correlation fields and no secrets", () => {
    const sink: string[] = [];
    const logger = createMemoryLogger(sink).child({ requestId: "req-1", entryPoint: "web_ui" });
    logger.info({ event: "login_ok", token: "super-secret", user: "ana" });
    const line = JSON.parse(sink[0]!);
    expect(line.requestId).toBe("req-1");
    expect(line.entryPoint).toBe("web_ui");
    expect(line.event).toBe("login_ok");
    expect(line.token).toBe("[REDACTED]");
    expect(JSON.stringify(line)).not.toContain("super-secret");
  });

  it("attributes scheduler runs separately from replay runs", () => {
    const sink: string[] = [];
    const logger = createMemoryLogger(sink);
    logger.info({ entryPoint: "scheduler", runId: "r1" }, "started");
    logger.info({ entryPoint: "replay", runId: "r2" }, "started");
    expect(JSON.parse(sink[0]!).entryPoint).toBe("scheduler");
    expect(JSON.parse(sink[1]!).entryPoint).toBe("replay");
  });
});

describe("metrics", () => {
  it("computes RED percentiles with bounded samples", () => {
    const metrics = new InMemoryMetrics();
    for (let i = 1; i <= 100; i += 1) metrics.recordRequest("/api/x", i === 100 ? 500 : 200, i);
    const snapshot = metrics.snapshot();
    expect(snapshot.requests).toBe(100);
    expect(snapshot.errors).toBe(1);
    expect(snapshot.errorRate).toBeCloseTo(0.01);
    expect(snapshot.p95Ms).toBeGreaterThanOrEqual(95);
    expect(snapshot.p99Ms).toBeGreaterThanOrEqual(99);
  });
});

describe("sentry sanitization", () => {
  it("strips headers, cookies, bodies and secret extras", () => {
    const clean = sanitizeSentryEvent({
      message: "boom",
      request: { headers: { authorization: "Bearer x", accept: "json" }, cookies: { a: "b" }, data: { password: "x" } },
      extra: { dbPassword: "x", projectSlug: "p1" },
    });
    const text = JSON.stringify(clean);
    expect(text).not.toContain("Bearer x");
    expect((clean.extra as Record<string, unknown>).dbPassword).toBe("[REDACTED]");
    expect(text).toContain("projectSlug");
    expect((clean.request as Record<string, unknown>).data).toBe("[REDACTED]");
  });
});
