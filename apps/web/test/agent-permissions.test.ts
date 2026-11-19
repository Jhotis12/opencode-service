import { describe, expect, it } from "vitest";
import { PlatformToolNameSchema, type PermissionRule } from "@platform/shared";
import {
  PLATFORM_TOOL_OPTIONS,
  TOOL_EFFECT_OPTIONS,
  permissionRulesToToolEffects,
  toolEffectsToPermissionRules,
} from "../src/components/AgentEditorModal.tsx";

const rule = (resource: string, effect: PermissionRule["effect"], action = "tool"): PermissionRule => ({
  action,
  resource,
  effect,
});

describe("permission mapping", () => {
  it("covers every platform tool from the schema with a Spanish label and description", () => {
    expect(PLATFORM_TOOL_OPTIONS.map((tool) => tool.name)).toEqual([...PlatformToolNameSchema.options]);
    for (const tool of PLATFORM_TOOL_OPTIONS) {
      expect(tool.label.trim().length).toBeGreaterThan(0);
      expect(tool.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("offers exactly the allow, deny and ask effects", () => {
    expect(TOOL_EFFECT_OPTIONS.map((option) => option.value)).toEqual(["allow", "deny", "ask"]);
  });

  it("accepts an empty permission list", () => {
    expect(permissionRulesToToolEffects(undefined)).toEqual({ effects: {}, unknownRules: [] });
    expect(permissionRulesToToolEffects([])).toEqual({ effects: {}, unknownRules: [] });
  });

  it("maps bare and platform_-prefixed resources to tool effects", () => {
    const { effects, unknownRules } = permissionRulesToToolEffects([
      rule("db_query", "deny"),
      rule("platform_notify", "ask"),
    ]);
    expect(effects).toEqual({ db_query: "deny", notify: "ask" });
    expect(unknownRules).toEqual([]);
  });

  it("resolves duplicate rules for one tool with deny precedence, like evaluateToolPermission", () => {
    const { effects } = permissionRulesToToolEffects([rule("db_query", "allow"), rule("db_query", "deny")]);
    expect(effects).toEqual({ db_query: "deny" });
  });

  it("collects rules with unknown resources instead of mapping or dropping them", () => {
    const legacy = rule("legacy_tool", "deny");
    const wildcard = rule("*", "allow");
    const { effects, unknownRules } = permissionRulesToToolEffects([legacy, wildcard, rule("kb_search", "ask")]);
    expect(effects).toEqual({ kb_search: "ask" });
    expect(unknownRules).toEqual([legacy, wildcard]);
  });

  it("emits rules only for chosen tools, in schema order, with the tool action", () => {
    const rules = toolEffectsToPermissionRules({ notify: "ask", workflow_trigger: "allow" });
    expect(rules).toEqual([
      { action: "tool", resource: "workflow_trigger", effect: "allow" },
      { action: "tool", resource: "notify", effect: "ask" },
    ]);
  });

  it("emits an empty list when no tool has a rule", () => {
    expect(toolEffectsToPermissionRules({})).toEqual([]);
  });

  it("round-trips loaded rules, normalizing platform_ prefixes and keeping unknown rules separate", () => {
    const loaded = [rule("platform_db_query", "deny"), rule("legacy_tool", "deny"), rule("notify", "allow")];
    const { effects, unknownRules } = permissionRulesToToolEffects(loaded);
    expect(toolEffectsToPermissionRules(effects)).toEqual([
      { action: "tool", resource: "db_query", effect: "deny" },
      { action: "tool", resource: "notify", effect: "allow" },
    ]);
    expect(unknownRules.map((item) => item.resource)).toEqual(["legacy_tool"]);
  });
});
