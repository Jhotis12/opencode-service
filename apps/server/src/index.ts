import { createApplication } from "./app.ts";

const dataDir = process.env.DATA_DIR ?? "./data";
const port = Number(process.env.PORT ?? 3000);

const application = await createApplication({
  dataDir,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD,
  serviceToken: process.env.PLATFORM_SERVICE_TOKEN,
  globalServiceToken: process.env.PLATFORM_GLOBAL_TOKEN,
  sentryDsn: process.env.SENTRY_DSN,
  secureCookies: process.env.NODE_ENV === "production",
  env: process.env,
});

const server = Bun.serve({
  port,
  fetch: application.app.fetch,
  idleTimeout: 120,
});

console.log(`[platform] listening on http://localhost:${server.port} (data: ${dataDir})`);

async function shutdown(signal: string): Promise<void> {
  console.log(`[platform] ${signal} received, shutting down`);
  await application.integrationManager.stopAll().catch(() => undefined);
  application.close();
  server.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
