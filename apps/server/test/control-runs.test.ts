import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApplication, type Application } from "../src/app.ts";
import { createLogger } from "../src/infrastructure/out/telemetry/logger.ts";
import type { WorkflowRunRecord } from "../src/domain/entities.ts";

const serviceToken = "service-token-test";
const globalServiceToken = "global-token-test";

let dir: string;
let application: Application;
let app: Application["app"];

function seedRun(overrides: Partial<WorkflowRunRecord> & Pick<WorkflowRunRecord, "id" | "startedAt">): void {
  application.store.runs.claim({
    projectSlug: "alpha",
    workflowId: "wf-a",
    status: "succeeded",
    payloadHash: "hash",
    input: {},
    entryPoint: "web_ui",
    ...overrides,
  });
}

function seedStep(runId: string, id: string, startedAt: string): void {
  application.store.runs.insertStep({
    id,
    runId,
    nodeId: `node-${id}`,
    status: "succeeded",
    input: {},
    output: {},
    durationMs: 5,
    startedAt,
  });
}

function controlGet(path: string, headers: Record<string, string> = { "x-platform-token": globalServiceToken }) {
  return app.request(path, { headers });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "platform-control-runs-"));
  application = await createApplication({
    dataDir: dir,
    env: { ...process.env, OPENCODE_MODE: "fake" },
    logger: createLogger({ level: "silent", destination: { write() {} } }),
    serviceToken,
    globalServiceToken,
  });
  app = application.app;

  seedRun({ id: "run-old", projectSlug: "alpha", status: "succeeded", entryPoint: "web_ui", startedAt: "2026-01-01T10:00:00.000Z", finishedAt: "2026-01-01T10:00:05.000Z" });
  seedRun({ id: "run-legacy", projectSlug: "alpha", status: "failed", entryPoint: "scheduler", startedAt: "2026-01-03T10:00:00.000Z", finishedAt: "2026-01-03T10:00:05.000Z", error: "boom" });
  seedRun({ id: "run-approval", projectSlug: "alpha", status: "failed", entryPoint: "scheduler", startedAt: "2026-01-04T10:00:00.000Z", finishedAt: "2026-01-04T10:00:05.000Z" });
  seedStep("run-approval", "step-a", "2026-01-04T10:00:01.000Z");
  seedRun({ id: "run-web", projectSlug: "beta", status: "succeeded", entryPoint: "webhook", startedAt: "2026-01-05T10:00:00.000Z", finishedAt: "2026-01-05T10:00:05.000Z", parentRunId: "run-approval" });
  seedStep("run-web", "step-b", "2026-01-05T10:00:01.000Z");
  seedStep("run-web", "step-c", "2026-01-05T10:00:02.000Z");
  seedRun({ id: "run-live", projectSlug: "beta", status: "running", entryPoint: "web_ui", startedAt: "2026-01-06T10:00:00.000Z" });
});

afterAll(async () => {
  application.close();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/control/runs", () => {
  it("keeps the legacy shape with steps and adds pagination metadata", async () => {
    const response = await controlGet("/api/control/runs");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<WorkflowRunRecord & { steps: unknown[] }>;
      total: number;
      limit: number;
      offset: number;
    };
    expect(body.total).toBe(5);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.data).toHaveLength(5);
    expect(body.data.map((run) => run.id)).toEqual([
      "run-live",
      "run-web",
      "run-approval",
      "run-legacy",
      "run-old",
    ]);
    expect(Array.isArray(body.data[0]!.steps)).toBe(true);
    expect(body.data[1]!.steps).toHaveLength(2);
  });

  it("filters by status, project, entry point and applies limit", async () => {
    const response = await controlGet("/api/control/runs?status=failed&project=alpha&limit=1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }>; total: number; limit: number; offset: number };
    expect(body.total).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.id).toBe("run-approval");

    const byEntry = await controlGet("/api/control/runs?entryPoint=webhook");
    const entryBody = (await byEntry.json()) as { data: Array<{ id: string }>; total: number };
    expect(entryBody.total).toBe(1);
    expect(entryBody.data[0]!.id).toBe("run-web");
  });

  it("treats from and to as inclusive ISO bounds", async () => {
    const response = await controlGet(
      "/api/control/runs?from=2026-01-03T10:00:00.000Z&to=2026-01-05T10:00:00.000Z",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }>; total: number };
    expect(body.total).toBe(3);
    expect(body.data.map((run) => run.id)).toEqual(["run-web", "run-approval", "run-legacy"]);
  });

  it("pages with limit and offset over the filtered set", async () => {
    const response = await controlGet("/api/control/runs?limit=2&offset=2");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }>; total: number; limit: number; offset: number };
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(2);
    expect(body.data.map((run) => run.id)).toEqual(["run-approval", "run-legacy"]);
  });

  it("caps limit at 200 and falls back to the default on malformed values", async () => {
    const capped = await controlGet("/api/control/runs?limit=500");
    expect(capped.status).toBe(200);
    expect(((await capped.json()) as { limit: number }).limit).toBe(200);

    const malformed = await controlGet("/api/control/runs?limit=abc");
    expect(malformed.status).toBe(200);
    expect(((await malformed.json()) as { limit: number }).limit).toBe(20);
  });

  it("rejects an unknown status with 400 VALIDATION_ERROR", async () => {
    const response = await controlGet("/api/control/runs?status=bogus");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed date filters with 400 VALIDATION_ERROR", async () => {
    const response = await controlGet("/api/control/runs?from=nonsense");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("forbids project-scoped service access to the control plane", async () => {
    const response = await controlGet("/api/control/runs", {
      "x-platform-token": serviceToken,
      "x-platform-project": "alpha",
    });
    expect(response.status).toBe(403);
  });
});

describe("GET /api/control/runs/:runId", () => {
  it("returns the run with its embedded steps", async () => {
    const response = await controlGet("/api/control/runs/run-web");
    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkflowRunRecord & { steps: Array<{ id: string }> };
    expect(body.id).toBe("run-web");
    expect(body.parentRunId).toBe("run-approval");
    expect(body.steps.map((step) => step.id)).toEqual(["step-b", "step-c"]);
  });

  it("answers 404 for an unknown run id", async () => {
    const response = await controlGet("/api/control/runs/does-not-exist");
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
