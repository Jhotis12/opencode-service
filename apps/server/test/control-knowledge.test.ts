import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApplication, type Application } from "../src/app.ts";
import { createLogger } from "../src/infrastructure/out/telemetry/logger.ts";

const serviceToken = "service-token-test";
const globalServiceToken = "global-token-test";

let dir: string;
let application: Application;
let app: Application["app"];

const projectHeaders = {
  "content-type": "application/json",
  "x-platform-token": serviceToken,
  "x-platform-project": "kb-bot",
};
const globalHeaders = {
  "content-type": "application/json",
  "x-platform-token": globalServiceToken,
  "x-platform-scope": "global",
};

function controlSearch(body: unknown, headers: Record<string, string> = globalHeaders) {
  return app.request("/api/control/knowledge/search", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "platform-control-knowledge-"));
  application = await createApplication({
    dataDir: dir,
    env: { ...process.env, OPENCODE_MODE: "fake" },
    logger: createLogger({ level: "silent", destination: { write() {} } }),
    serviceToken,
    globalServiceToken,
  });
  app = application.app;
  const project = await app.request("/api/projects", {
    method: "POST",
    headers: projectHeaders,
    body: JSON.stringify({ slug: "kb-bot", name: "KB Bot" }),
  });
  expect(project.status).toBe(201);
  const notebook = await app.request("/api/projects/kb-bot/notebooks", {
    method: "POST",
    headers: projectHeaders,
    body: JSON.stringify({ slug: "manual", name: "Manual" }),
  });
  expect(notebook.status).toBe(201);
});

afterAll(async () => {
  application.close();
  await rm(dir, { recursive: true, force: true });
});

describe("POST /api/control/knowledge/search", () => {
  it("searches one notebook when the global caller names both project and notebook", async () => {
    const response = await controlSearch({ query: "facturas", projectSlug: "kb-bot", notebookSlug: "manual" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
  });

  it("searches across the projects without a notebook filter", async () => {
    const response = await controlSearch({ query: "facturas" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
  });

  it("rejects a notebook search without a project and unsafe identifiers", async () => {
    const noProject = await controlSearch({ query: "facturas", notebookSlug: "manual" });
    expect(noProject.status).toBe(422);

    const unsafeNotebook = await controlSearch({
      query: "facturas",
      projectSlug: "kb-bot",
      notebookSlug: "../secrets",
    });
    expect(unsafeNotebook.status).toBe(422);

    const unsafeProject = await controlSearch({ query: "facturas", projectSlug: "../kb-bot" });
    expect(unsafeProject.status).toBe(422);
  });

  it("rejects a non-string query instead of failing while trimming it", async () => {
    const response = await controlSearch({ query: 7 });
    expect(response.status).toBe(422);
  });

  it("reports an unknown notebook as a client error", async () => {
    const response = await controlSearch({ query: "facturas", projectSlug: "kb-bot", notebookSlug: "missing" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("EXTRACTION_FAILED");
  });

  it("keeps the control plane closed to project-scoped credentials", async () => {
    const response = await controlSearch({ query: "facturas" }, projectHeaders);
    expect(response.status).toBe(403);
  });
});

describe("POST /api/projects/:slug/notebooks/:notebookSlug/search", () => {
  function projectSearch(notebookSlug: string, body: unknown) {
    return app.request(`/api/projects/kb-bot/notebooks/${notebookSlug}/search`, {
      method: "POST",
      headers: projectHeaders,
      body: JSON.stringify(body),
    });
  }

  it("reports an unknown notebook as a client error instead of a server failure", async () => {
    const response = await projectSearch("missing", { query: "facturas" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("EXTRACTION_FAILED");
  });

  it("searches an existing notebook", async () => {
    const response = await projectSearch("manual", { query: "facturas" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
  });
});
