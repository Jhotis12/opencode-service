export function resolvePath(input: unknown, path: string): unknown {
  const clean = path.replace(/^input\.?/, "").trim();
  if (!clean) return input;
  return clean.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) return current[Number(key)];
    if (typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, input);
}

function templateValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

export function renderTemplate(template: string, input: unknown): unknown {
  const rendered = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path) =>
    templateValue(resolvePath(input, String(path))),
  );
  try {
    return JSON.parse(rendered);
  } catch {
    return rendered;
  }
}

export function renderParams(value: unknown, input: unknown): unknown {
  if (typeof value === "string") return renderTemplate(value, input);
  if (Array.isArray(value)) return value.map((item) => renderParams(item, input));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderParams(item, input)]));
  }
  return value;
}
