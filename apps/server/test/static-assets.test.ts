import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApplication, type Application } from "../src/app.ts";
import { createLogger } from "../src/infrastructure/out/telemetry/logger.ts";

const indexHtml = '<!doctype html><html><head><link rel="icon" href="/favicon.svg"></head><body>spa</body></html>';
const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#070B14"/></svg>';

let root: string;
let webDist: string;
let application: Application;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "platform-static-"));
  webDist = join(root, "web");
  await mkdir(webDist, { recursive: true });
  await mkdir(join(root, "data"), { recursive: true });
  await writeFile(join(webDist, "index.html"), indexHtml);
  await writeFile(join(webDist, "favicon.svg"), favicon);
  application = await createApplication({
    dataDir: join(root, "data"),
    webDist,
    env: { ...process.env, OPENCODE_MODE: "fake" },
    logger: createLogger({ level: "silent", destination: { write() {} } }),
  });
});

afterAll(async () => {
  application.close();
  await rm(root, { recursive: true, force: true });
});

describe("static brand assets", () => {
  it("serves the favicon as an SVG instead of the SPA fallback", async () => {
    const response = await application.app.request("/favicon.svg");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toBe(favicon);
  });

  it("keeps the SPA fallback for client routes", async () => {
    const response = await application.app.request("/projects/demo");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe(indexHtml);
  });

  it("serves brand SVGs from nested public paths", async () => {
    const brandDir = join(webDist, "brand");
    await mkdir(brandDir, { recursive: true });
    await writeFile(join(brandDir, "agentic-mark.svg"), favicon);
    const response = await application.app.request("/brand/agentic-mark.svg");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toBe(favicon);
  });
});
