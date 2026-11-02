import type { PasswordHasher } from "../../../application/ports/security.ts";

export class BunPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Bun.password.hash(password, { algorithm: "argon2id", memoryCost: 19_456, timeCost: 2 });
  }

  verify(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash);
  }
}
