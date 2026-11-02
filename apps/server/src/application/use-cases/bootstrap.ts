import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Store } from "../ports/store.ts";
import type { PasswordHasher } from "../ports/security.ts";
import { loadOrCreateMasterKey } from "../../infrastructure/out/vault/aes-vault.ts";

export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin123!";

export interface BootstrapOptions {
  dataDir: string;
  store: Store;
  passwordHasher: PasswordHasher;
  initialPassword?: string;
  logger?: { info(bindings: Record<string, unknown>, message?: string): void };
}

export interface BootstrapResult {
  createdAdmin: boolean;
  dataDir: string;
  directories: string[];
}

const SUBDIRECTORIES = ["db", "workspaces", "knowledge", "channels", "opencode", "db/backups"] as const;

/**
 * Prepares persistent storage and the initial administrator. Safe to run on
 * every start: existing users and the master key are never overwritten.
 */
export class BootstrapSystemUseCase {
  constructor(private readonly options: BootstrapOptions) {}

  async execute(): Promise<BootstrapResult> {
    const directories = SUBDIRECTORIES.map((dir) => join(this.options.dataDir, dir));
    for (const dir of directories) await mkdir(dir, { recursive: true });
    await loadOrCreateMasterKey(join(this.options.dataDir, "master.key"));

    if (this.options.store.users.count() > 0) {
      return { createdAdmin: false, dataDir: this.options.dataDir, directories };
    }

    const password = this.options.initialPassword?.trim() || DEFAULT_ADMIN_PASSWORD;
    const passwordHash = await this.options.passwordHasher.hash(password);
    this.options.store.users.create({
      id: crypto.randomUUID(),
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    });
    this.options.logger?.info(
      { event: "bootstrap_admin_created", entryPoint: "bootstrap", username: DEFAULT_ADMIN_USERNAME },
      "default administrator created",
    );
    return { createdAdmin: true, dataDir: this.options.dataDir, directories };
  }
}
