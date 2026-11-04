import { TranscribeNodeConfigSchema, type WorkflowGraph } from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import { WorkflowValidationError } from "../../domain/workflow/graph.ts";

/**
 * Validates that every resource referenced by a workflow exists and belongs to
 * the same project. This runs on save and before a run so a stale reference
 * cannot fail halfway through the graph.
 */
export async function validateWorkflowResources(
  store: Store,
  workspace: WorkspacePort,
  projectSlug: string,
  graph: WorkflowGraph,
): Promise<void> {
  const issues: string[] = [];
  for (const node of graph.nodes) {
    if (node.type === "trigger" && node.config.kind === "integration") {
      const integrationId = String(node.config.integrationId ?? "");
      const integration = integrationId ? store.integrations.findById(integrationId) : undefined;
      if (!integration) {
        issues.push(`trigger ${node.id} references an unknown integration`);
      } else if (integration.scope !== "project" || integration.projectSlug !== projectSlug) {
        issues.push(`trigger ${node.id} references an integration from another project or the global scope`);
      }
    }
    if (node.type === "trigger" && node.config.kind === "webhook") {
      const alias = String(node.config.secretAlias ?? "").trim();
      const secret = alias ? store.vault.findByAlias({ scope: "project", projectSlug, alias }) : undefined;
      if (!secret) {
        issues.push(`webhook trigger ${node.id} references an unknown project secret alias: ${alias || "(empty)"}`);
      }
    }
    if (node.type === "agent" && node.agentId) {
      const markdown = await workspace
        .readAgent(projectSlug, `.opencode/agents/${node.agentId}.md`)
        .catch(() => undefined);
      if (!markdown) issues.push(`agent node ${node.id} references an unknown agent: ${node.agentId}`);
    }
    if (node.type === "transcribe") {
      const config = TranscribeNodeConfigSchema.safeParse(node.config);
      if (!config.success) issues.push(`transcribe node ${node.id} has invalid config`);
      const project = store.projects.findBySlug(projectSlug);
      const integrationId = config.success
        ? config.data.integrationId ?? project?.transcriptionIntegrationId
        : undefined;
      if (!integrationId) {
        issues.push(`transcribe node ${node.id} requires a transcription integration or project default`);
      } else {
        const integration = store.integrations.findById(integrationId);
        if (!integration || integration.scope !== "project" || integration.projectSlug !== projectSlug) {
          issues.push(
            `transcribe node ${node.id} references a transcription integration from another project or the global scope`,
          );
        } else if (integration.kind !== "transcription" || !integration.capabilities.includes("transcribe_audio")) {
          issues.push(`transcribe node ${node.id} requires a transcription integration`);
        }
      }
    }
    for (const notebookId of node.notebookIds) {
      const notebook = store.notebooks.findById(notebookId);
      if (!notebook || notebook.projectSlug !== projectSlug) {
        issues.push(`node ${node.id} references a notebook outside the project: ${notebookId}`);
      }
    }
  }
  if (issues.length > 0) throw new WorkflowValidationError(issues);
}
