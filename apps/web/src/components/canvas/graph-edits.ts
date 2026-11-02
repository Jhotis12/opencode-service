import type { Edge, NodeSpec, WorkflowGraph } from "@platform/shared";

export interface GraphIssue {
  id: string;
  message: string;
  severity: "error" | "warning";
  nodeId?: string;
  edgeId?: string;
}

export interface MappedIssue {
  message: string;
  nodeId?: string;
  edgeId?: string;
}

function outgoing(graph: WorkflowGraph, nodeId: string): Edge[] {
  return graph.edges.filter((edge) => edge.source === nodeId);
}

function reaches(graph: WorkflowGraph, from: string, target: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of outgoing(graph, current)) stack.push(edge.target);
  }
  return false;
}

export function getConnectionIssue(
  graph: WorkflowGraph,
  sourceId: string,
  targetId: string,
  condition?: "true" | "false",
): string | undefined {
  const source = graph.nodes.find((node) => node.id === sourceId);
  const target = graph.nodes.find((node) => node.id === targetId);
  if (!source) return "El nodo de origen no existe.";
  if (!target) return "El nodo de destino no existe.";
  if (sourceId === targetId) return "Un nodo no puede conectarse a sí mismo.";
  if (target.type === "trigger") return "El trigger es el inicio del flujo y no puede recibir conexiones.";
  if (source.type === "decision" && condition !== "true" && condition !== "false") {
    return "Elige la rama sí o no antes de conectar.";
  }

  const existing = outgoing(graph, sourceId);
  const duplicate = existing.find(
    (edge) =>
      edge.target === targetId && (source.type !== "decision" || edge.condition === condition),
  );
  if (duplicate) return "Ya existe una conexión hacia ese nodo para esta rama.";

  if (reaches(graph, targetId, sourceId)) return "Esta conexión crearía un ciclo en el flujo.";
  return undefined;
}

export interface PendingConnection {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
}

export function resolveConnection(
  graph: WorkflowGraph,
  connection: PendingConnection,
): { source: string; target: string; condition?: "true" | "false" } | { issue: string } {
  if (!connection.source || !connection.target) return { issue: "La conexión está incompleta." };
  const source = graph.nodes.find((node) => node.id === connection.source);
  const condition =
    source?.type === "decision" ? (connection.sourceHandle === "false" ? "false" : "true") : undefined;
  const issue = getConnectionIssue(graph, connection.source, connection.target, condition);
  if (issue) return { issue };
  return {
    source: connection.source,
    target: connection.target,
    ...(condition ? { condition } : {}),
  };
}

export function connectNodes(
  graph: WorkflowGraph,
  sourceId: string,
  targetId: string,
  condition?: "true" | "false",
): WorkflowGraph {
  const source = graph.nodes.find((node) => node.id === sourceId);
  if (!source) throw new Error(`source node not found: ${sourceId}`);
  const normalized = source.type === "decision" ? condition : undefined;
  if (source.type === "decision" && normalized !== "true" && normalized !== "false") {
    throw new Error("decision connections require a true or false condition");
  }

  const edges = graph.edges.filter((edge) => {
    if (edge.source !== sourceId) return true;
    if (source.type === "decision") return edge.condition !== normalized;
    return false;
  });

  const edge: Edge = {
    id: `edge-${crypto.randomUUID().slice(0, 8)}`,
    source: sourceId,
    target: targetId,
    ...(normalized ? { condition: normalized } : {}),
  };
  return { ...graph, edges: [...edges, edge] };
}

function issue(
  issues: GraphIssue[],
  value: Omit<GraphIssue, "id" | "severity"> & { id?: string; severity?: GraphIssue["severity"] },
): void {
  issues.push({
    id: value.id ?? `${value.nodeId ?? value.edgeId ?? "graph"}-${issues.length}`,
    severity: value.severity ?? "error",
    message: value.message,
    ...(value.nodeId ? { nodeId: value.nodeId } : {}),
    ...(value.edgeId ? { edgeId: value.edgeId } : {}),
  });
}

function cycleNodes(graph: WorkflowGraph): Set<string> {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const inCycle = new Set<string>();

  function visit(id: string): void {
    if (visiting.has(id)) {
      inCycle.add(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of outgoing(graph, id)) visit(edge.target);
    visiting.delete(id);
    visited.add(id);
  }

  for (const node of graph.nodes) visit(node.id);
  return inCycle;
}

export function getGraphIssues(graph: WorkflowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) issue(issues, { nodeId: node.id, message: `Identificador de nodo duplicado: ${node.id}.` });
    ids.add(node.id);
  }

  const triggers = graph.nodes.filter((node) => node.type === "trigger");
  if (triggers.length === 0) issue(issues, { message: "El flujo necesita un nodo trigger." });
  if (triggers.length > 1) {
    for (const trigger of triggers.slice(1)) {
      issue(issues, { nodeId: trigger.id, message: "Solo puede existir un trigger en el flujo." });
    }
  }

  for (const node of graph.nodes) {
    if (node.type === "trigger" && ["schedule", "webhook"].includes(String(node.config.kind ?? ""))) {
      issue(issues, { nodeId: node.id, message: "Este tipo de trigger todavía no tiene un ejecutor activo." });
    }
    if (node.type === "code" && !node.codeFile) {
      issue(issues, { nodeId: node.id, message: "El nodo de código necesita un archivo TypeScript." });
    }
    if (node.type === "agent" && !node.agentId) {
      issue(issues, { nodeId: node.id, message: "El nodo de agente necesita un agente asignado." });
    }
    if (node.type === "http" && typeof node.config.url !== "string") {
      issue(issues, { nodeId: node.id, message: "El nodo HTTP necesita una URL." });
    }
    if (node.type === "delay" && !(Number(node.config.ms) > 0)) {
      issue(issues, { nodeId: node.id, message: "El nodo de espera necesita una duración positiva." });
    }
    if (node.type === "validate" && (!Array.isArray(node.config.rules) || node.config.rules.length === 0)) {
      issue(issues, { nodeId: node.id, message: "El nodo de validación necesita al menos una regla." });
    }
    if (
      node.type === "transform" &&
      typeof node.config.template !== "string" &&
      (typeof node.config.mapping !== "object" || node.config.mapping === null)
    ) {
      issue(issues, { nodeId: node.id, message: "El nodo de transformación necesita una plantilla o mapeo." });
    }

    const edges = outgoing(graph, node.id);
    if (node.type === "decision") {
      const conditions = new Set(edges.map((edge) => edge.condition));
      if (edges.length !== 2 || !conditions.has("true") || !conditions.has("false")) {
        issue(issues, {
          nodeId: node.id,
          message: "La condición necesita exactamente una salida sí y una salida no.",
        });
      }
      if (!node.codeFile && (typeof node.config.condition !== "object" || node.config.condition === null)) {
        issue(issues, { nodeId: node.id, message: "La condición necesita una regla visual o un archivo de código." });
      }
      for (const edge of edges) {
        if (edge.condition !== "true" && edge.condition !== "false") {
          issue(issues, {
            nodeId: node.id,
            edgeId: edge.id,
            message: "La rama de la condición debe ser sí o no.",
          });
        }
      }
    } else if (edges.length > 1) {
      issue(issues, { nodeId: node.id, message: "Este nodo solo puede tener una salida; usa una condición para bifurcar." });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) issue(issues, { edgeId: edge.id, message: `Identificador de conexión duplicado: ${edge.id}.` });
    edgeIds.add(edge.id);
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!source) issue(issues, { edgeId: edge.id, message: `La conexión ${edge.id} apunta desde un nodo inexistente.` });
    if (!target) issue(issues, { edgeId: edge.id, message: `La conexión ${edge.id} apunta a un nodo inexistente.` });
    if (edge.source === edge.target) issue(issues, { edgeId: edge.id, message: "Una conexión no puede apuntar al mismo nodo." });
    if (target?.type === "trigger") issue(issues, { edgeId: edge.id, message: "El trigger no puede recibir conexiones." });
  }

  const cyclic = cycleNodes(graph);
  for (const nodeId of cyclic) {
    issue(issues, { nodeId, message: "Este nodo forma parte de un ciclo." });
  }

  if (triggers.length > 0) {
    const start = triggers[0]!.id;
    const reachable = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const edge of outgoing(graph, current)) stack.push(edge.target);
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        issue(issues, { nodeId: node.id, message: "Este nodo no es alcanzable desde el trigger." });
      }
    }
  }

  return issues;
}

export function changeEdgeCondition(
  graph: WorkflowGraph,
  edgeId: string,
  condition: "true" | "false",
): { graph: WorkflowGraph; issue?: string } {
  const edge = graph.edges.find((item) => item.id === edgeId);
  if (!edge) return { graph, issue: "La conexión no existe." };
  const conflict = graph.edges.find(
    (item) => item.id !== edgeId && item.source === edge.source && item.condition === condition,
  );
  if (conflict) {
    return {
      graph,
      issue: "La otra rama ya usa esa condición. Cambia o elimina la conexión existente primero.",
    };
  }
  return {
    graph: {
      ...graph,
      edges: graph.edges.map((item) => (item.id === edgeId ? { ...item, condition } : item)),
    },
  };
}

export function mapServerIssue(graph: WorkflowGraph, message: string): MappedIssue {
  const match = message.match(/\b(?:node|edge|trigger)\s+([a-z0-9][a-z0-9-]*)/i);
  const id = match?.[1];
  if (!id) return { message };
  if (graph.nodes.some((node) => node.id === id)) return { message, nodeId: id };
  if (graph.edges.some((edge) => edge.id === id)) return { message, edgeId: id };
  return { message };
}

export function nodeIssues(issues: GraphIssue[], nodeId: string): GraphIssue[] {
  return issues.filter((issue) => issue.nodeId === nodeId);
}
