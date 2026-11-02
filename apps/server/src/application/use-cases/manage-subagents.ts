import type { SubagentFrontmatter, SubagentProfile } from "@platform/shared";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { EventBus } from "../ports/events.ts";
import type { MarkdownAgentAdapter, McpServerConfig } from "../../infrastructure/out/agents/markdown-agent-adapter.ts";

export class ManageSubagentsUseCase {
  constructor(
    private readonly workspace: WorkspacePort,
    private readonly adapter: MarkdownAgentAdapter,
    private readonly runtime: AgentRuntimePort,
    private readonly events: EventBus,
  ) {}

  list(slug: string): Promise<SubagentProfile[]> {
    return this.adapter.list(slug);
  }

  get(slug: string, category: string, role: string): Promise<SubagentProfile | undefined> {
    return this.adapter.get(slug, category, role);
  }

  async upsert(
    slug: string,
    input: { category: string; role: string; frontmatter: SubagentFrontmatter; body: string },
  ): Promise<SubagentProfile> {
    const profile = await this.adapter.upsert(slug, {
      category: input.category,
      role: input.role,
      frontmatter: input.frontmatter,
      body: input.body,
    });
    await this.reload(slug, `${input.category}/${input.role}`);
    return profile;
  }

  async remove(slug: string, category: string, role: string): Promise<void> {
    await this.adapter.remove(slug, category, role);
    await this.reload(slug, `${category}/${role}`);
  }

  listMcp(slug: string): Promise<Record<string, McpServerConfig>> {
    return this.adapter.listMcp(slug);
  }

  async upsertMcp(slug: string, name: string, config: McpServerConfig): Promise<void> {
    await this.adapter.upsertMcp(slug, name, config);
    await this.reload(slug, `mcp:${name}`);
  }

  async removeMcp(slug: string, name: string): Promise<void> {
    await this.adapter.removeMcp(slug, name);
    await this.reload(slug, `mcp:${name}`);
  }

  private async reload(slug: string, agentId: string): Promise<void> {
    const directory = await this.workspace.projectDirectory(slug);
    await this.runtime.reloadLocation(directory);
    this.events.publish({ type: "agent.updated", projectSlug: slug, agentId });
  }
}
