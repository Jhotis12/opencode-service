import type { ConfigField } from "@platform/shared";

export function getPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

export function setPath(value: Record<string, unknown>, path: string, next: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const clone = structuredClone(value);
  let current: Record<string, unknown> = clone;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1)!] = next;
  return clone;
}

export function getConfigValue(config: Record<string, unknown>, key: string): unknown {
  if (key === "routing") return (config.routing as { mode?: unknown } | undefined)?.mode ?? "hybrid";
  if (key === "allowlist") return (config.routing as { allowlist?: unknown } | undefined)?.allowlist ?? [];
  if (key === "public") return Boolean((config.routing as { public?: unknown } | undefined)?.public);
  if (key === "voiceReplies") return (config.routing as { voiceReplies?: unknown } | undefined)?.voiceReplies ?? "never";
  return getPath(config, key);
}

export function setConfigValue(config: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const routing = { ...((config.routing as Record<string, unknown> | undefined) ?? {}) };
  if (key === "routing") return { ...config, routing: { ...routing, mode: value } };
  if (key === "allowlist") return { ...config, routing: { ...routing, allowlist: value } };
  if (key === "public") return { ...config, routing: { ...routing, public: value } };
  if (key === "voiceReplies") return { ...config, routing: { ...routing, voiceReplies: value } };
  return setPath(config, key, value);
}

export function isFieldVisible(config: Record<string, unknown>, field: ConfigField): boolean {
  if (!field.visibleWhen) return true;
  const actual = getConfigValue(config, field.visibleWhen.key);
  if ("equals" in field.visibleWhen) return actual === field.visibleWhen.equals;
  if ("notEquals" in field.visibleWhen) return actual !== field.visibleWhen.notEquals;
  return true;
}

export function toList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
