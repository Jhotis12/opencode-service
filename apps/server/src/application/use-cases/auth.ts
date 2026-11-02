import type { UserRecord } from "../../domain/entities.ts";
import type { Store } from "../ports/store.ts";
import type { PasswordHasher } from "../ports/security.ts";
import { assertPasswordPolicy, PasswordPolicyError } from "../../domain/identity/password-policy.ts";
import { DEFAULT_ADMIN_PASSWORD } from "./bootstrap.ts";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid username or password");
    this.name = "InvalidCredentialsError";
  }
}

export class LoginUseCase {
  constructor(
    private readonly store: Store,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(username: string, password: string): Promise<UserRecord> {
    const user = this.store.users.findByUsername(username.trim());
    if (!user) throw new InvalidCredentialsError();
    const valid = await this.hasher.verify(password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();
    return user;
  }
}

export class ChangePasswordUseCase {
  constructor(
    private readonly store: Store,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<UserRecord> {
    const user = this.store.users.findById(userId);
    if (!user) throw new InvalidCredentialsError();
    const valid = await this.hasher.verify(currentPassword, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();
    assertPasswordPolicy(newPassword, DEFAULT_ADMIN_PASSWORD);
    const hash = await this.hasher.hash(newPassword);
    this.store.users.updatePassword(user.id, hash, false);
    return { ...user, passwordHash: hash, mustChangePassword: false };
  }
}

export { PasswordPolicyError };
