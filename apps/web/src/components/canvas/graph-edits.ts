import {
  getGraphInvariantIssues,
  getGraphTraversalIssues,
  validateNodeConfig,
  type Edge,
  type GraphInvariantIssue,
  type WorkflowGraph,
} from "@platform/shared";

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

function describeInvariant(issue: GraphInvariantIssue): string {
  const id = issue.nodeId ?? issue.edgeId ?? "";
  switch (issue.code) {
    case "node.duplicate-id":
      return `Identificador de nodo duplicado: ${id}.`;
    case "trigger.missing":
      return "El flujo necesita un nodo trigger.";
    case "trigger.duplicate":
      return "Solo puede existir un trigger en el flujo.";
    case "trigger.kind-unsupported":
      return "Este tipo de trigger todavía no tiene un ejecutor activo.";
    case "trigger.cron-invalid":
      return "El trigger programado necesita una expresión cron válida.";
    case "trigger.run-at-invalid":
      return "El trigger programado necesita una fecha válida para ejecutarse una sola vez.";
    case "trigger.secret-alias-missing":
      return "El trigger webhook necesita un alias de secreto.";
    case "trigger.integration-id-missing":
      return "El trigger de integración necesita una integración asignada.";
    case "trigger.event-unsupported":
      return `El trigger de integración no admite el evento ${issue.detail}.`;
    case "trigger.event-duplicate":
      return "Ya existe otro trigger para esa integración y evento.";
    case "node.code-file-missing":
      return "El nodo de código necesita un archivo TypeScript.";
    case "node.agent-id-missing":
      return "El nodo de agente necesita un agente asignado.";
    case "node.subworkflow-version-missing":
      return "El nodo de subflujo necesita una versión del flujo.";
    case "node.foreach-version-missing":
      return "El nodo de lote necesita una versión del flujo.";
    case "node.foreach-items-path-missing":
      return "El nodo de lote necesita una ruta de elementos en el input.";
    case "node.on-error-target-missing":
      return "Elige el nodo que recibe los errores de este paso.";
    case "node.on-error-target-self":
      return "Un nodo no puede enviar sus errores a sí mismo.";
    case "node.on-error-target-unknown":
      return "La ruta de errores apunta a un nodo que ya no existe.";
    case "node.on-error-target-trigger":
      return "La ruta de errores no puede apuntar al trigger.";
    case "node.delay-invalid":
      return "El nodo de espera necesita una duración positiva.";
    case "node.validate-rules-missing":
      return "El nodo de validación necesita al menos una regla.";
    case "node.transform-target-missing":
      return "El nodo de transformación necesita una plantilla o mapeo.";
    case "node.transcribe-media-path-missing":
      return "El nodo Transcribir necesita una ruta de audios en el input.";
    case "node.decision-condition-missing":
      return "La condición necesita una regla visual o un archivo de código.";
    case "node.decision-branches":
      return "La condición necesita exactamente una salida sí y una salida no.";
    case "node.decision-edge-condition":
      return "La rama de la condición debe ser sí o no.";
    case "node.branching":
      return "Este nodo solo puede tener una salida; usa una condición para bifurcar.";
    case "edge.duplicate-id":
      return `Identificador de conexión duplicado: ${id}.`;
    case "edge.unknown-source":
      return `La conexión ${id} apunta desde un nodo inexistente.`;
    case "edge.unknown-target":
      return `La conexión ${id} apunta a un nodo inexistente.`;
    case "edge.self-loop":
      return "Una conexión no puede apuntar al mismo nodo.";
    case "edge.target-trigger":
      return "El trigger no puede recibir conexiones.";
    case "graph.cycle":
      return "Este nodo forma parte de un ciclo.";
    case "node.unreachable":
      return "Este nodo no es alcanzable desde el trigger.";
  }
}

export function getGraphIssues(graph: WorkflowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  for (const node of graph.nodes) {
    const validation = validateNodeConfig(node.type, node.config);
    if (!validation.success) {
      for (const problem of validation.error.issues) {
        const path = problem.path.length > 0 ? `config.${problem.path.join(".")}` : "config";
        issue(issues, {
          nodeId: node.id,
          message: `Configuración inválida (${path}): ${problem.message}`,
        });
      }
    }
  }

  const invariants = [...getGraphInvariantIssues(graph), ...getGraphTraversalIssues(graph)];
  for (const invariant of invariants) {
    issue(issues, {
      nodeId: invariant.nodeId,
      edgeId: invariant.edgeId,
      message: describeInvariant(invariant),
    });
  }

  // UI-only precheck: the executor accepts audio attachments without a transcribe
  // node, so the server must not enforce this.
  for (const node of graph.nodes) {
    if (node.type !== "trigger" || node.config.kind !== "integration") continue;
    const accepts = Array.isArray(node.config.accepts) ? node.config.accepts : ["text"];
    if (accepts.includes("audio") && !graph.nodes.some((candidate) => candidate.type === "transcribe")) {
      issue(issues, {
        nodeId: node.id,
        message: "El trigger acepta audio pero el flujo no tiene un nodo Transcribir.",
      });
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
