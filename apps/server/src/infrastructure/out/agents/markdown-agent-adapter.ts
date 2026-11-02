import type { SubagentProfile } from "@platform/shared";
import type { WorkspacePort } from "../../../application/ports/workspace.ts";
import {
  agentRelativePath,
  parseAgentMarkdown,
  parseAgentPath,
  serializeAgentMarkdown,
} from "../../../domain/agents/markdown.ts";

export interface McpServerConfig {
  type: "local" | "remote";
  command?: string[];
  url?: string;
  disabled?: boolean;
  environment?: Record<string, string>;
}

export class MarkdownAgentAdapter {
  constructor(private readonly workspace: WorkspacePort) {}

  async list(slug: string): Promise<SubagentProfile[]> {
    const files = await this.workspace.listAgentFiles(slug);
    const profiles: SubagentProfile[] = [];
    for (const file of files) {
      const markdown = await this.workspace.readAgent(slug, file);
      profiles.push(parseAgentMarkdown(markdown, file));
    }
    return profiles;
  }

  async get(slug: string, category: string, role: string): Promise<SubagentProfile | undefined> {
    const path = agentRelativePath(category, role);
    try {
      const markdown = await this.workspace.readAgent(slug, path);
      return parseAgentMarkdown(markdown, path);
    } catch {
      return undefined;
    }
  }

  async upsert(slug: string, profile: SubagentProfile): Promise<SubagentProfile> {
    const path = agentRelativePath(profile.category, profile.role);
    const markdown = serializeAgentMarkdown(profile.frontmatter, profile.body);
    await this.workspace.writeAgent(slug, path, markdown);
    return parseAgentMarkdown(markdown, path);
  }

  async remove(slug: string, category: string, role: string): Promise<void> {
    const path = agentRelativePath(category, role);
    await this.workspace.removeAgent(slug, path);
  }

  async listMcp(slug: string): Promise<Record<string, McpServerConfig>> {
    const config = await this.workspace.readOpencodeConfig(slug);
    const mcp = config.mcp as { servers?: Record<string, McpServerConfig> } | undefined;
    return mcp?.servers ?? {};
  }

  async upsertMcp(slug: string, name: string, server: McpServerConfig): Promise<void> {
    if (!/^[a-z0-9][a-z0-9-_]{1,60}$/.test(name)) throw new Error(`invalid MCP server name: ${name}`);
    const config = await this.workspace.readOpencodeConfig(slug);
    const mcp = (config.mcp as { servers?: Record<string, McpServerConfig> } | undefined) ?? {};
    mcp.servers = { ...(mcp.servers ?? {}), [name]: server };
    config.mcp = mcp;
    await this.workspace.writeOpencodeConfig(slug, config);
  }

  async removeMcp(slug: string, name: string): Promise<void> {
    const config = await this.workspace.readOpencodeConfig(slug);
    const mcp = config.mcp as { servers?: Record<string, McpServerConfig> } | undefined;
    if (mcp?.servers) {
      delete mcp.servers[name];
      config.mcp = mcp;
      await this.workspace.writeOpencodeConfig(slug, config);
    }
  }

  async listFiles(slug: string): Promise<string[]> {
    return (await this.workspace.listAgentFiles(slug)).map((file) => {
      const { category, role } = parseAgentPath(file);
      return `${category}/${role}`;
    });
  }
}
