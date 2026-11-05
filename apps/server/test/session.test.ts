import { describe, expect, it } from "bun:test";
import { SessionCodec } from "../src/infrastructure/in/auth/session.ts";

describe("session TTL", () => {
  it("expires a signed session after the configured TTL", () => {
    const codec = new SessionCodec("test-secret", 1);
    const token = codec.sign("user-1", 1_000);
    expect(codec.verify(token, 1_500)).toEqual({ userId: "user-1" });
    expect(codec.verify(token, 3_000)).toBeUndefined();
  });
});
