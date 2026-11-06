import { describe, expect, it } from "vitest";
import { getConfigValue, setConfigValue } from "../src/components/config-field-utils.ts";

describe("channel routing fields", () => {
  it("defaults voice replies to never and stores them inside routing", () => {
    expect(getConfigValue({}, "voiceReplies")).toBe("never");
    const next = setConfigValue({ routing: { mode: "agent" } }, "voiceReplies", "auto");
    expect(next.routing).toEqual({ mode: "agent", voiceReplies: "auto" });
    expect(getConfigValue(next, "voiceReplies")).toBe("auto");
  });
});
