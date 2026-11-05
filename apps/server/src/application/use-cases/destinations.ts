import {
  CreateProjectDestinationSchema,
  UpdateProjectDestinationSchema,
  type ProjectDestination,
} from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { ProjectDestinationRecord } from "../../domain/entities.ts";

export class DestinationError extends Error {
  constructor(
    public readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "DestinationError";
  }
}

function referencesIn(value: unknown, id: string, path: string): string[] {
  if (typeof value === "string") return value === id ? [path] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => referencesIn(item, id, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      referencesIn(item, id, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

export class ManageDestinationsUseCase {
  constructor(
    private readonly deps: {
      store: Store;
      workspace: WorkspacePort;
    },
  ) {}

  list(projectSlug: string): ProjectDestinationRecord[] {
    this.requireProject(projectSlug);
    return this.deps.store.destinations.list(projectSlug);
  }

  create(projectSlug: string, input: unknown): ProjectDestinationRecord {
    this.requireProject(projectSlug);
    const parsed = CreateProjectDestinationSchema.safeParse(input);
    if (!parsed.success) {
      throw new DestinationError("VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join("; "));
    }
    const now = new Date().toISOString();
    const record: ProjectDestinationRecord = {
      id: crypto.randomUUID(),
      projectSlug,
      kind: parsed.data.kind,
      label: parsed.data.label.trim(),
      value: parsed.data.value.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.deps.store.destinations.create(record);
    return record;
  }

  update(projectSlug: string, id: string, input: unknown): ProjectDestinationRecord {
    const current = this.findInProject(projectSlug, id);
    const parsed = UpdateProjectDestinationSchema.safeParse(input);
    if (!parsed.success) {
      throw new DestinationError("VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join("; "));
    }
    this.deps.store.destinations.update(current.id, {
      ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.label !== undefined ? { label: parsed.data.label.trim() } : {}),
      ...(parsed.data.value !== undefined ? { value: parsed.data.value.trim() } : {}),
    });
    return this.findInProject(projectSlug, id);
  }

  async remove(projectSlug: string, id: string): Promise<boolean> {
    const current = this.findInProject(projectSlug, id);
    const references = [
      ...this.references(projectSlug, current.id),
      ...(await this.workflowReferences(projectSlug, current.id)),
    ];
    if (references.length > 0) {
      throw new DestinationError("CONFLICT", `destination is still referenced by: ${references.join(", ")}`);
    }
    return this.deps.store.destinations.remove(current.id);
  }

  resolve(projectSlug: string, value?: string): string | undefined {
    if (!value) return undefined;
    const destination = this.deps.store.destinations.findById(value);
    if (!destination) return value;
    if (destination.projectSlug !== projectSlug) {
      throw new DestinationError("FORBIDDEN", "destination belongs to another project");
    }
    return destination.value;
  }

  resolveMany(projectSlug: string, values: string[]): string[] {
    return values.map((value) => this.resolve(projectSlug, value) ?? value);
  }

  references(projectSlug: string, id: string): string[] {
    const references: string[] = [];
    const project = this.deps.store.projects.findBySlug(projectSlug);
    if (project?.approvalRecipient === id) references.push("projects.approvalRecipient");
    for (const integration of this.deps.store.integrations.list({ scope: "project", projectSlug })) {
      const routing = integration.config.routing as { allowlist?: unknown } | undefined;
      const allowlist = Array.isArray(routing?.allowlist) ? routing.allowlist : [];
      if (allowlist.some((value) => value === id)) references.push(`integration:${integration.slug}.routing.allowlist`);
      if (integration.config.alertRecipient === id) references.push(`integration:${integration.slug}.alertRecipient`);
    }
    return references;
  }

  async workflowReferences(projectSlug: string, id: string): Promise<string[]> {
    const graph = await this.deps.workspace.readWorkflow(projectSlug).catch(() => undefined);
    if (!graph) return [];
    return graph.nodes.flatMap((node) =>
      referencesIn(node.config, id, `workflow.node:${node.id}.config`),
    );
  }

  private findInProject(projectSlug: string, id: string): ProjectDestinationRecord {
    const destination = this.deps.store.destinations.findById(id);
    if (!destination) throw new DestinationError("NOT_FOUND", "destination not found");
    if (destination.projectSlug !== projectSlug) {
      throw new DestinationError("FORBIDDEN", "destination belongs to another project");
    }
    return destination;
  }

  private requireProject(projectSlug: string): void {
    if (!this.deps.store.projects.findBySlug(projectSlug)) {
      throw new DestinationError("NOT_FOUND", `project not found: ${projectSlug}`);
    }
  }
}

export function resolveDestinationValue(store: Store, projectSlug: string, value?: string): string | undefined {
  if (!value) return undefined;
  const destination = store.destinations.findById(value);
  if (!destination) return value;
  if (destination.projectSlug !== projectSlug) {
    throw new DestinationError("FORBIDDEN", "destination belongs to another project");
  }
  return destination.value;
}

export function resolveDestinationList(store: Store, projectSlug: string, values: string[]): string[] {
  return values.map((value) => resolveDestinationValue(store, projectSlug, value) ?? value);
}
