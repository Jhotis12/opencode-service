export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface SecretVault {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
