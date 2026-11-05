import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createApplication } from "../apps/server/src/app.ts";
import type { TelegramTransport } from "../apps/server/src/infrastructure/in/channels/telegram-adapter.ts";

function fakeTelegramTransport(token: string): TelegramTransport {
  const invalid = token.includes("invalid");
  return {
    type: "telegram",
    async verify() {
      if (invalid) throw new Error("Unauthorized");
      return { botId: "e2e-bot", username: "e2e_bot" };
    },
    async clearWebhook() {},
    async start() {},
    async send() {
      return { providerMessageId: "e2e-message" };
    },
    async stop() {},
    status() {
      return "connected";
    },
  };
}

const dataDir = "/tmp/opencode-agentic-platform-e2e";
await rm(dataDir, { recursive: true, force: true });

const application = await createApplication({
  dataDir,
  env: { ...process.env, OPENCODE_MODE: "fake", ORCHESTRATOR_MODEL: "opencode-go/fast", SENTRY_DSN: "" },
  webDist: join(import.meta.dir, "..", "apps", "web", "dist"),
  telegramTransportFactory: fakeTelegramTransport,
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
