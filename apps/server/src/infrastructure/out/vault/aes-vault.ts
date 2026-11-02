import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SecretVault } from "../../../application/ports/security.ts";

const VERSION = "v1";

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

export class Aes256GcmVaultAdapter implements SecretVault {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new VaultError("master key must be 32 bytes");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt(ciphertext: string): string {
    const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) throw new VaultError("malformed ciphertext");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
    } catch {
      throw new VaultError("ciphertext failed authentication");
    }
  }
}

/** Reads the master key or creates it with 0600 permissions on first boot. */
export async function loadOrCreateMasterKey(path: string): Promise<Buffer> {
  await mkdir(dirname(path), { recursive: true });
  try {
    const existing = await readFile(path);
    if (existing.length !== 32) throw new VaultError("master key file must contain exactly 32 bytes");
    return existing;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const key = randomBytes(32);
    await writeFile(path, key, { mode: 0o600 });
    await chmod(path, 0o600);
    return key;
  }
}
