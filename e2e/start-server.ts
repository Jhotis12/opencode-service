import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createApplication } from "../apps/server/src/app.ts";

const dataDir = "/tmp/opencode-agentic-platform-e2e";
await rm(dataDir, { recursive: true, force: true });

const application = await createApplication({
  dataDir,
  env: { ...process.env, OPENCODE_MODE: "fake" },
  webDist: join(import.meta.dir, "..", "apps", "web", "dist"),
});

const server = Bun.serve({ port: 3100, fetch: application.app.fetch, idleTimeout: 120 });
console.log(`[e2e] listening on ${server.url}`);

const shutdown = () => {
  application.close();
  server.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
