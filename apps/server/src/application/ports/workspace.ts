import type { WorkflowGraph } from "@platform/shared";

export interface WorkspacePort {
  createProject(input: { slug: string; name: string; description?: string }): Promise<void>;
  listProjects(): Promise<string[]>;
  projectDirectory(slug: string): Promise<string>;
  readWorkflow(slug: string): Promise<WorkflowGraph>;
  writeWorkflow(slug: string, graph: WorkflowGraph): Promise<void>;
  readNode(slug: string, file: string): Promise<string>;
  writeNode(slug: string, file: string, code: string): Promise<void>;
  listNodes(slug: string): Promise<string[]>;
  readAgent(slug: string, relativePath: string): Promise<string>;
  writeAgent(slug: string, relativePath: string, markdown: string): Promise<void>;
  removeAgent(slug: string, relativePath: string): Promise<void>;
  listAgentFiles(slug: string): Promise<string[]>;
  readOpencodeConfig(slug: string): Promise<Record<string, unknown>>;
  writeOpencodeConfig(slug: string, config: Record<string, unknown>): Promise<void>;
  removeProject(slug: string): Promise<void>;
}
