import { describe, expect, it } from "bun:test";
import { resolveChatTurnPolicy } from "../src/application/use-cases/chat-turn-policy.ts";

describe("chat turn policy", () => {
  it("uses defaults and the compatibility max", () => {
    expect(resolveChatTurnPolicy({}).maxMs).toBe(30 * 60_000);
    expect(resolveChatTurnPolicy({ AGENT_CHAT_TIMEOUT_MS: "900000" }).maxMs).toBe(900_000);
    expect(resolveChatTurnPolicy({ AGENT_TURN_MAX_MS: "1200000", AGENT_CHAT_TIMEOUT_MS: "900000" }).maxMs).toBe(1_200_000);
  });

  it("clamps idle and polling values to safe bounds", () => {
    const policy = resolveChatTurnPolicy({
      AGENT_TURN_MAX_MS: "1000",
      AGENT_TURN_IDLE_MS: "9999999",
      AGENT_TURN_POLL_MS: "1",
      AGENT_TURN_RETRY_MS: "999999",
    });
    expect(policy.idleMs).toBeLessThanOrEqual(policy.maxMs);
    expect(policy.pollMs).toBeGreaterThanOrEqual(100);
    expect(policy.transportRetryMs).toBeLessThanOrEqual(30_000);
  });

  it("falls back on invalid values", () => {
    const policy = resolveChatTurnPolicy({ AGENT_TURN_MAX_MS: "nope", AGENT_TURN_IDLE_MS: "-5" });
    expect(policy.maxMs).toBe(30 * 60_000);
    expect(policy.idleMs).toBe(10 * 60_000);
  });
});
