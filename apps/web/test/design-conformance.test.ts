import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(process.cwd(), "src");
const SOURCE_FILE = /\.(?:ts|tsx|css)$/;

type Rule = {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
  readonly sample: string;
  readonly skip?: (file: string) => boolean;
  readonly prepare?: (source: string) => string;
};

const TOKEN_FALLBACK = /var\(--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\)/g;

/**
 * A `var(--token, #hex)` fallback references a theme token; it is not a
 * page-local surface value, so the raw-hex rule strips it before scanning.
 */
function stripTokenFallbacks(source: string): string {
  return source.replace(TOKEN_FALLBACK, "var(--token)");
}

const rules: readonly Rule[] = [
  {
    id: "rose-200-text",
    description: "Tailwind rose-200 text instead of the danger token",
    pattern: /text-rose-200\b/,
    sample: 'className="text-rose-200"',
  },
  {
    id: "10px-radius",
    description: "10px arbitrary radius instead of the 12px card radius",
    pattern: /rounded-\[10px\]/,
    sample: 'className="rounded-[10px]"',
  },
  {
    id: "13px-text",
    description: "13px arbitrary type size outside the type scale",
    pattern: /text-\[13px\]/,
    sample: 'className="text-[13px]"',
  },
  {
    id: "160ms-exit",
    description: "legacy 160 ms modal exit instead of the 140 ms motion token",
    pattern: /EXIT_MS\s*=\s*160\b/,
    sample: "const EXIT_MS = 160;",
  },
  {
    id: "window-confirm",
    description: "native window.confirm instead of the shared ConfirmDialog",
    pattern: /window\.confirm\s*\(/,
    sample: "window.confirm('¿Eliminar el proyecto?')",
  },
  {
    id: "raw-hex",
    description: "raw hex colour outside index.css",
    pattern: /(?<=[\s"'`(,:\[])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    sample: 'className="bg-[#0D1424]"',
    skip: (file) => file.endsWith("/index.css"),
    prepare: stripTokenFallbacks,
  },
  {
    id: "native-select",
    description: "native <select> instead of the shared picker",
    pattern: /<select\b/,
    sample: '<select value="" />',
    // Every component file is scanned; there are no per-file exemptions.
    skip: (file) => !file.endsWith(".tsx"),
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });
}

function scan(source: string, rule: Rule): string[] {
  const pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace("g", "")}g`);
  return [...source.matchAll(pattern)].map((match) => match[0]);
}

function violations(files: readonly string[], rule: Rule): string[] {
  return files.flatMap((file) => {
    if (rule.skip?.(file)) return [];
    const raw = readFileSync(file, "utf8");
    const source = rule.prepare ? rule.prepare(raw) : raw;
    const pattern = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace("g", "")}g`);
    return [...source.matchAll(pattern)].map((match) => {
      const line = source.slice(0, match.index ?? 0).split("\n").length;
      return `${relative(SRC_ROOT, file)}:${line} ${match[0]}`;
    });
  });
}

const files = sourceFiles(SRC_ROOT);

/**
 * The feedback rule's coverage is only as honest as this classification, so the
 * scanner fails when a source file starts handling a failure and nobody said
 * which kind it is. Moving a file out of `REQUEST_FAILURE_DEBT` is how a row
 * proves it converted that surface to a toast.
 */
export const REQUEST_FAILURE_DEBT = [
  "components/AgentCatalog.tsx",
  "components/AgentEditorModal.tsx",
  "components/ControlChannelsPanel.tsx",
  "components/IntegrationCard.tsx",
  "components/IntegrationEditor.tsx",
  "components/ProjectDestinationsPanel.tsx",
  "components/ProjectKnowledgePanel.tsx",
  "components/ProjectSettingsPanel.tsx",
  "pages/ProjectFlowPage.tsx",
  "pages/ProjectIntegrationsPage.tsx",
  "pages/ProjectsPage.tsx",
  "pages/project-workspace.tsx",
  "useChatTurn.ts",
] as const;

export const VALIDATION_INLINE = [
  "components/NodeConfigFields.tsx",
  "components/PlatformSettingsFields.tsx",
  "components/RunLaunchModal.tsx",
] as const;

export const NOT_A_FAILURE_PATH = ["components/NodeInspector.tsx"] as const;

const FAILURE_SIGNAL = /setError\(|onError:/;

function filesHandlingFailure(): string[] {
  return files
    .filter((file) => FAILURE_SIGNAL.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC_ROOT, file))
    .sort();
}

describe("request failure feedback classification", () => {
  const classified: string[] = [
    ...REQUEST_FAILURE_DEBT,
    ...VALIDATION_INLINE,
    ...NOT_A_FAILURE_PATH,
  ].sort();

  const occurrences = (file: string, signal: RegExp): number =>
    (readFileSync(join(SRC_ROOT, file), "utf8").match(new RegExp(signal.source, "g")) ?? []).length;

  it("classifies every source file that handles a failure", () => {
    const unclassified = filesHandlingFailure().filter((file) => !classified.includes(file));
    expect(unclassified).toEqual([]);
  });

  it("keeps no stale classification for a file that stopped handling failures", () => {
    const handling = filesHandlingFailure();
    expect(classified.filter((file) => !handling.includes(file))).toEqual([]);
  });

  it("puts each file in exactly one category", () => {
    expect(classified).toHaveLength(new Set(classified).size);
  });

  it("keeps the config-field category free of any error state", () => {
    const withErrorState = NOT_A_FAILURE_PATH.filter((file) => occurrences(file, /setError\(/) > 0);
    expect(withErrorState).toEqual([]);
  });

  it("keeps the validation category free of onError handlers", () => {
    const withRequestHandler = VALIDATION_INLINE.filter((file) => occurrences(file, /onError:/) > 0);
    expect(withRequestHandler).toEqual([]);
  });

  it("keeps every debt entry holding at least one failure handler", () => {
    const withoutHandler = REQUEST_FAILURE_DEBT.filter(
      (file) => occurrences(file, /setError\(|onError:/) === 0,
    );
    expect(withoutHandler).toEqual([]);
  });
});

describe("design-conformance scanner", () => {
  it("walks the whole source tree instead of passing on an empty file list", () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((file) => file.endsWith("/App.tsx"))).toBe(true);
    expect(files.some((file) => file.endsWith("/index.css"))).toBe(true);
  });

  it("exempts no component file from the native-select rule", () => {
    const rule = rules.find((candidate) => candidate.id === "native-select");
    if (!rule) throw new Error("the native-select rule is missing");
    const components = files.filter((file) => file.endsWith(".tsx"));
    expect(components.length).toBeGreaterThan(30);
    expect(components.filter((file) => rule.skip?.(file))).toEqual([]);
  });

  it.each(rules)("detects its own forbidden sample for $id", (rule) => {
    expect(scan(rule.sample, rule)).toHaveLength(1);
  });

  it.each(rules)("finds no $id violation in apps/web/src", (rule) => {
    expect(violations(files, rule)).toEqual([]);
  });
});
