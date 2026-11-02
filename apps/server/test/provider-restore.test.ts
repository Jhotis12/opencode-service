import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../src/app.ts";
import { createLogger } from "../src/infrastructure/out/telemetry/logger.ts";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter, loadOrCreateMasterKey } from "../src/infrastructure/out/vault/aes-vault.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("provider credential restore", () => {
  it("re-registers the saved OpenCode Go key when the service starts", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "platform-provider-restore-"));
    dirs.push(dataDir);
    const databasePath = join(dataDir, "db", "platform.sqlite");
    const masterKey = await loadOrCreateMasterKey(join(dataDir, "master.key"));
    const vault = new Aes256GcmVaultAdapter(masterKey);
    const store = new SqliteStore(databasePath);
    store.vault.upsert({
      id: "v1",
      scope: "global",
      alias: "provider:opencode-go",
      kind: "provider_key",
      ciphertext: vault.encrypt("sk-opencode-go-restored-123"),
      createdAt: new Date().toISOString(),
    });
    store.close();

    const application = await createApplication({
      dataDir,
      env: { ...process.env, OPENCODE_MODE: "fake" },
      logger: createLogger({ level: "silent", destination: { write() {} } }),
    });
    const agent = application.agent as FakeAgentRuntime;
    expect(agent.registeredKeys).toContainEqual({
      providerID: "opencode-go",
      apiKey: "sk-opencode-go-restored-123",
    });
    const settings = await application.app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123!" }),
    });
    expect(settings.status).toBe(200);
    application.close();
  });
});
