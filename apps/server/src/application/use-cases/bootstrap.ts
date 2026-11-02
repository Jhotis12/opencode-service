import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const SUBDIRECTORIES = ["db", "workspaces", "knowledge", "channels", "opencode", "opencode/state", "control", "db/backups"] as const;

async function writeIfMissing(path: string, content: string): Promise<void> {
  const exists = await readFile(path, "utf8").then(() => true).catch(() => false);
  if (!exists) await writeFile(path, content, "utf8");
}

async function ensureControlWorkspace(dataDir: string): Promise<void> {
  const control = join(dataDir, "control");
  await mkdir(join(control, ".opencode", "agents", "orchestrator"), { recursive: true });
  await writeIfMissing(
    join(control, "AGENTS.md"),
    [
      "# Orquestador global",
      "",
      "Eres el plano de control de la plataforma. Consultas todos los proyectos y reportas su estado.",
      "- No edites archivos de proyectos.",
      "- Usa las herramientas `platform_*` para consultar proyectos, runs, errores, salud y conocimiento.",
      "- Cita proyecto, run y nodo cuando informes un fallo.",
      "- Para acciones destructivas o ejecuciones, pide confirmación explícita.",
    ].join("\n") + "\n",
  );
  await writeIfMissing(
    join(control, ".opencode", "agents", "orchestrator", "agente.md"),
    [
      "---",
      "description: Orquestador global de la plataforma; consulta y reporta proyectos.",
      "mode: primary",
      "---",
      "",
      "Eres el orquestador global de la plataforma.",
      "Hablas con el administrador y respondes con datos verificables.",
      "- No edites proyectos ni ejecutes acciones sin confirmación.",
      "- Reporta fallos con proyecto, flujo, nodo, run y error resumido.",
      "- Si no tienes evidencia, dilo; no inventes resultados.",
    ].join("\n") + "\n",
  );
  await writeIfMissing(
    join(control, "opencode.jsonc"),
    `${JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        default_agent: "orchestrator/agente",
        permissions: [
          { action: "edit", resource: "*", effect: "deny" },
          { action: "shell", resource: "*", effect: "deny" },
          { action: "external_directory", resource: "*", effect: "deny" },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

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
    await ensureControlWorkspace(this.options.dataDir);

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
