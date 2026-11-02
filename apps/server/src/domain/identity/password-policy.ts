export const MIN_PASSWORD_LENGTH = 12;

export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

/** New passwords must be long enough and must not repeat the shipped default. */
export function assertPasswordPolicy(password: string, currentDefault: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password === currentDefault) {
    throw new PasswordPolicyError("password must differ from the initial default password");
  }
  if (/^\s+$/.test(password)) {
    throw new PasswordPolicyError("password must not be blank");
  }
}
