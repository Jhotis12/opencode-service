import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLATFORM_DEFAULT_MODEL } from "@platform/shared";
import { Aes256GcmVaultAdapter, VaultError, loadOrCreateMasterKey } from "../src/infrastructure/out/vault/aes-vault.ts";
import { BunPasswordHasher } from "../src/infrastructure/out/security/bun-password-hasher.ts";
import { BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD } from "../src/application/use-cases/bootstrap.ts";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { assertPasswordPolicy, PasswordPolicyError } from "../src/domain/identity/password-policy.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "platform-test-"));
  dirs.push(dir);
  return dir;
}

describe("AES-256-GCM vault", () => {
  it("round-trips a secret and produces a unique ciphertext each time", () => {
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 7));
    const first = vault.encrypt("postgres://user:pass@host/db");
    const second = vault.encrypt("postgres://user:pass@host/db");
    expect(vault.decrypt(first)).toBe("postgres://user:pass@host/db");
    expect(first).not.toBe(second);
    expect(first).not.toContain("postgres");
  });

  it("rejects tampered ciphertext", () => {
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 7));
    const ciphertext = vault.encrypt("secret");
    const tampered = `${ciphertext.slice(0, -4)}AAAA`;
    expect(() => vault.decrypt(tampered)).toThrow(VaultError);
  });

  it("creates a 32-byte master key with 0600 permissions and reuses it", async () => {
    const dir = await tempDir();
    const path = join(dir, "master.key");
    const first = await loadOrCreateMasterKey(path);
    const second = await loadOrCreateMasterKey(path);
    expect(first.length).toBe(32);
    expect(second.equals(first)).toBe(true);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await readFile(path)).length).toBe(32);
  });
});

describe("password policy", () => {
  it("accepts a long password different from the default", () => {
    expect(() => assertPasswordPolicy("una-clave-larga-2026", DEFAULT_ADMIN_PASSWORD)).not.toThrow();
  });

  it("rejects short passwords and the default", () => {
    expect(() => assertPasswordPolicy("corta", DEFAULT_ADMIN_PASSWORD)).toThrow(PasswordPolicyError);
    expect(() => assertPasswordPolicy(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD)).toThrow(PasswordPolicyError);
  });
});

describe("first boot bootstrap", () => {
  it("creates the admin, directories and master key on an empty volume", async () => {
    const dataDir = await tempDir();
    const store = new SqliteStore(join(dataDir, "db", "platform.sqlite"));
    const result = await new BootstrapSystemUseCase({
      dataDir,
      store,
      passwordHasher: new BunPasswordHasher(),
    }).execute();

    expect(result.createdAdmin).toBe(true);
    const user = store.users.findByUsername("admin");
    expect(user?.mustChangePassword).toBe(true);
    expect(await Bun.password.verify(DEFAULT_ADMIN_PASSWORD, user!.passwordHash)).toBe(true);
    expect((await stat(join(dataDir, "master.key"))).size).toBe(32);
    for (const dir of ["workspaces", "knowledge", "channels", "opencode", "opencode/state", "control"]) {
      expect((await stat(join(dataDir, dir))).isDirectory()).toBe(true);
    }
    expect((await stat(join(dataDir, "control", "AGENTS.md"))).isFile()).toBe(true);
    expect((await stat(join(dataDir, "control", ".opencode", "agents", "orchestrator", "agente.md"))).isFile()).toBe(true);
    store.close();
  });

  it("seeds DeepSeek V4.1 Flash as the platform and orchestrator default", async () => {
    const dataDir = await tempDir();
    const store = new SqliteStore(join(dataDir, "db", "platform.sqlite"));
    await new BootstrapSystemUseCase({
      dataDir,
      store,
      passwordHasher: new BunPasswordHasher(),
    }).execute();

    expect(store.settings.get("default_model")).toBe(PLATFORM_DEFAULT_MODEL);
    expect(store.settings.get("orchestrator_model")).toBe(PLATFORM_DEFAULT_MODEL);
    store.close();
  });

  it("uses DEFAULT_MODEL when provided and keeps an explicit ORCHESTRATOR_MODEL in the environment", async () => {
    const dataDir = await tempDir();
    const store = new SqliteStore(join(dataDir, "db", "platform.sqlite"));
    await new BootstrapSystemUseCase({
      dataDir,
      store,
      passwordHasher: new BunPasswordHasher(),
      defaultModel: "opencode-go/custom",
      orchestratorModel: "opencode-go/orchestrator",
    }).execute();

    expect(store.settings.get("default_model")).toBe("opencode-go/custom");
    expect(store.settings.get("orchestrator_model")).toBeUndefined();
    store.close();
  });

  it("preserves custom models already stored", async () => {
    const dataDir = await tempDir();
    const store = new SqliteStore(join(dataDir, "db", "platform.sqlite"));
    store.settings.set("default_model", "opencode-go/fast");
    store.settings.set("orchestrator_model", "opencode-go/reasoning");
    await new BootstrapSystemUseCase({
      dataDir,
      store,
      passwordHasher: new BunPasswordHasher(),
    }).execute();

    expect(store.settings.get("default_model")).toBe("opencode-go/fast");
    expect(store.settings.get("orchestrator_model")).toBe("opencode-go/reasoning");
    store.close();
  });

  it("does not overwrite the admin or key on restart", async () => {
    const dataDir = await tempDir();
    const store = new SqliteStore(join(dataDir, "db", "platform.sqlite"));
    const hasher = new BunPasswordHasher();
    await new BootstrapSystemUseCase({ dataDir, store, passwordHasher: hasher }).execute();
    const firstUser = store.users.findByUsername("admin")!;
    const firstKey = await readFile(join(dataDir, "master.key"));

    const second = await new BootstrapSystemUseCase({
      dataDir,
      store,
      passwordHasher: hasher,
      initialPassword: "otra-clave-distinta-1",
    }).execute();

    expect(second.createdAdmin).toBe(false);
    expect(store.users.findByUsername("admin")!.passwordHash).toBe(firstUser.passwordHash);
    expect((await readFile(join(dataDir, "master.key"))).equals(firstKey)).toBe(true);
    store.close();
  });
});
