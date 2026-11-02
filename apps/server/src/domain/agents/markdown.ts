import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  SubagentFrontmatterSchema,
  type SubagentFrontmatter,
  type SubagentProfile,
} from "@platform/shared";

export class AgentMarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentMarkdownError";
  }
}

const CATEGORY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const ROLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function agentRelativePath(category: string, role: string): string {
  if (!CATEGORY_PATTERN.test(category)) throw new AgentMarkdownError(`invalid agent category: ${category}`);
  if (!ROLE_PATTERN.test(role)) throw new AgentMarkdownError(`invalid agent role: ${role}`);
  return `.opencode/agents/${category}/${role}.md`;
}

export function parseAgentPath(relativePath: string): { category: string; role: string } {
  const match = /^\.opencode\/agents\/([^/]+)\/([^/]+)\.md$/.exec(relativePath);
  if (!match) throw new AgentMarkdownError(`agent path must be .opencode/agents/<category>/<role>.md: ${relativePath}`);
  return { category: match[1]!, role: match[2]! };
}

export function parseAgentMarkdown(markdown: string, path?: string): SubagentProfile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown.trimStart());
  if (!match) throw new AgentMarkdownError("agent markdown requires YAML frontmatter delimited by ---");
  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(match[1]!);
  } catch (error) {
    throw new AgentMarkdownError(`invalid YAML frontmatter: ${(error as Error).message}`);
  }
  const parsed = SubagentFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) throw new AgentMarkdownError(`invalid agent frontmatter: ${parsed.error.message}`);
  const location = path ? parseAgentPath(path) : { category: "general", role: "agent" };
  return {
    category: location.category,
    role: location.role,
    frontmatter: parsed.data,
    body: match[2]!.trim(),
    path,
  };
}

export function serializeAgentMarkdown(frontmatter: SubagentFrontmatter, body: string): string {
  const normalized = SubagentFrontmatterSchema.parse(frontmatter);
  const yaml = stringifyYaml(normalized).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}
