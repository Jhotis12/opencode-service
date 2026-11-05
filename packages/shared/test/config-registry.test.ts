import { describe, expect, it } from "bun:test";
import {
  CHANNEL_EVENTS,
  INTEGRATION_CONFIG_REGISTRY,
  NODE_CONFIG_REGISTRY,
  IntegrationKindSchema,
  NodeTypeSchema,
  defaultNodeConfig,
  findSecretLikeFields,
  integrationEvents,
  validateIntegrationConfig,
  validateNodeConfig,
} from "../src/index.ts";

function duplicateFields(fields: Array<{ key: string }>): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const field of fields) {
    if (seen.has(field.key)) duplicates.push(field.key);
    seen.add(field.key);
  }
  return duplicates;
}

describe("configuration registry", () => {
  it("defines every integration kind with valid defaults", () => {
    for (const kind of IntegrationKindSchema.options) {
      const definition = INTEGRATION_CONFIG_REGISTRY[kind];
      expect(definition, `missing integration definition for ${kind}`).toBeDefined();
      expect(definition.kind).toBe(kind);
      const parsed = validateIntegrationConfig(kind, definition.defaults);
      expect(parsed.success, `invalid defaults for ${kind}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
      expect(duplicateFields(definition.fields), `duplicate fields for ${kind}`).toEqual([]);
      expect(definition.capabilities.length).toBeGreaterThanOrEqual(0);
      expect(definition.secretFields).toEqual(expect.any(Array));
    }
  });

  it("defines every node type with defaults that validate against its schema", () => {
    for (const type of NodeTypeSchema.options) {
      const definition = NODE_CONFIG_REGISTRY[type];
      expect(definition, `missing node definition for ${type}`).toBeDefined();
      expect(definition.type).toBe(type);
      const parsed = validateNodeConfig(type, definition.defaults);
      expect(parsed.success, `invalid defaults for ${type}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
      expect(duplicateFields(definition.fields), `duplicate fields for ${type}`).toEqual([]);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.category.length).toBeGreaterThan(0);
    }
  });

  it("exposes the inbound event catalog by channel kind", () => {
    expect(integrationEvents("telegram")).toEqual(["message.received"]);
    expect(integrationEvents("whatsapp")).toEqual(["message.received"]);
    expect(integrationEvents("external_chat")).toEqual(["message.received"]);
    expect(integrationEvents("postgres")).toEqual([]);
    expect(integrationEvents("transcription")).toEqual([]);
    expect(CHANNEL_EVENTS.email).toEqual([]);
  });

  it("rejects invalid integration and node configurations", () => {
    expect(validateIntegrationConfig("telegram", { routing: { mode: "nope" } }).success).toBe(false);
    expect(validateIntegrationConfig("postgres", { host: "localhost" }).success).toBe(false);
    expect(validateNodeConfig("http", { method: "GET" }).success).toBe(false);
    expect(validateNodeConfig("notify", { integrationId: "", text: "" }).success).toBe(false);
  });

  it("detects secret-like values in non-secret configuration", () => {
    expect(findSecretLikeFields({ token: "123:ABC" })).toEqual(["token"]);
    expect(findSecretLikeFields({ smtp: { password: "nope" } })).toEqual(["smtp.password"]);
    expect(findSecretLikeFields({ secretAlias: "wh-secret", botUsername: "bot" })).toEqual([]);
    expect(findSecretLikeFields({ nested: [{ apiKey: "sk_live" }] })).toEqual([]);
  });

  it("returns independent default copies", () => {
    const first = defaultNodeConfig("trigger");
    const second = defaultNodeConfig("trigger");
    (first.inputSchema as { fields: unknown[] }).fields.push({ name: "x" });
    expect((second.inputSchema as { fields: unknown[] }).fields).toEqual([]);
  });
});
