import { describe, expect, it } from "vitest";
import { NODE_CATEGORY_COLORS, NODE_META } from "../src/components/nodes/node-catalog.ts";

describe("node category colors", () => {
  it("groups action node types under one token", () => {
    for (const type of ["http", "code", "transform", "delay"] as const) {
      expect(NODE_META[type].color).toBe(NODE_CATEGORY_COLORS.action);
    }
  });

  it("groups logic node types under one token", () => {
    for (const type of ["validate", "decision"] as const) {
      expect(NODE_META[type].color).toBe(NODE_CATEGORY_COLORS.logic);
    }
  });

  it("keeps input, ai and human categories distinct", () => {
    expect(NODE_META.trigger.color).toBe(NODE_CATEGORY_COLORS.input);
    expect(NODE_META.agent.color).toBe(NODE_CATEGORY_COLORS.ai);
    expect(NODE_META.approval.color).toBe(NODE_CATEGORY_COLORS.human);
    expect(new Set(Object.values(NODE_CATEGORY_COLORS)).size).toBe(5);
  });
});
