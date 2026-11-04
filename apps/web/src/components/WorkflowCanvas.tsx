import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  applyEdgeChanges,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeSpec, WorkflowGraph } from "@platform/shared";
import { PlatformNode, type PlatformFlowNode, type ConnectRole } from "./nodes/PlatformNode.tsx";
import { PlatformEdge, type PlatformFlowEdge } from "./PlatformEdge.tsx";
import { CanvasActionsContext } from "./nodes/canvas-actions.ts";
import { NODE_META } from "./nodes/node-catalog.ts";
import { getConnectionIssue, resolveConnection, type GraphIssue } from "./canvas/graph-edits.ts";

const nodeTypes = { platform: PlatformNode };
const edgeTypes = { platform: PlatformEdge };
const EMPTY_ISSUES: GraphIssue[] = [];

function subtitle(node: NodeSpec): string | undefined {
  switch (node.type) {
    case "trigger": {
      const kind = String(node.config.kind ?? "manual");
      const integration = node.config.integrationId ? " · integración" : "";
      return `${kind}${integration}`;
    }
    case "code":
      return node.codeFile;
    case "agent":
      return `${node.agentId ?? "sin agente"}${node.modelOverride ? ` · ${node.modelOverride}` : ""}`;
    case "transcribe":
      return `${String(node.config.model ?? "modelo heredado")}${node.config.integrationId ? " · conexión" : " · proyecto"}`;
    case "decision":
      return node.config.mode === "condition" ? "Condición visual" : node.codeFile;
    case "http":
      return `${String(node.config.method ?? "GET")} ${String(node.config.url ?? "")}`.trim();
    case "database":
      return `${String(node.config.mode ?? "read")} · ${String(node.config.integrationId ?? "sin integración")}`;
    case "notify":
      return `${String(node.config.recipient ?? "canal")} · ${String(node.config.integrationId ?? "sin integración")}`;
    case "subworkflow":
      return String(node.config.versionId ?? "sin versión");
    case "foreach":
      return `${String(node.config.itemsPath ?? "items")} · ${String(node.config.maxConcurrency ?? 1)}`;
    case "delay":
      return `${Number(node.config.ms ?? 0)} ms`;
    case "transform":
      return "Plantilla / mapeo";
    case "approval":
      return "Pausa humana";
    default:
      return undefined;
  }
}

function toNodes(
  graph: WorkflowGraph,
  selectedId: string | undefined,
  runningNodeId: string | undefined,
  nodeStatuses: Record<string, string> | undefined,
  issues: GraphIssue[],
  validity: Record<string, string | undefined> | undefined,
  agentTouchedNodeIds: string[] | undefined,
): PlatformFlowNode[] {
  return graph.nodes.map((node) => {
    const nodeIssue = issues.find((issue) => issue.nodeId === node.id);
    const connectRole: ConnectRole | undefined = validity
      ? validity[node.id]
        ? "invalid"
        : node.id === validity.__source
          ? "source"
          : "valid"
      : undefined;
    return {
      id: node.id,
      type: "platform",
      position: node.position,
      selected: node.id === selectedId,
      data: {
        label: node.label ?? node.id,
        subtitle: subtitle(node),
        nodeType: node.type,
        status: runningNodeId === node.id ? "running" : nodeStatuses?.[node.id],
        issue: nodeIssue?.message,
        connectRole,
        agentTouched: agentTouchedNodeIds?.includes(node.id) ?? false,
      },
    };
  });
}

export interface RunProgress {
  status: string;
  currentNodeLabel?: string;
  completedSteps: number;
  runId: string;
}

function toEdges(
  graph: WorkflowGraph,
  issues: GraphIssue[],
  runningNodeId: string | undefined,
  nodeStatuses: Record<string, string> | undefined,
): PlatformFlowEdge[] {
  const edges: PlatformFlowEdge[] = graph.edges.map((edge) => {
    const sourceNode = graph.nodes.find((node) => node.id === edge.source);
    const isDecision = sourceNode?.type === "decision";
    const edgeIssue = issues.find((issue) => issue.edgeId === edge.id);
    const sourceStatus = nodeStatuses?.[edge.source];
    const targetStatus = runningNodeId === edge.target ? "running" : nodeStatuses?.[edge.target];
    const runState: "active" | "completed" | undefined =
      sourceStatus === "succeeded" && targetStatus === "running"
        ? "active"
        : sourceStatus === "succeeded" && targetStatus === "succeeded"
          ? "completed"
          : undefined;
    const stroke =
      edgeIssue
        ? "var(--color-warn)"
        : runState === "active"
          ? "var(--color-accent)"
          : runState === "completed"
            ? "var(--color-ok)"
            : "var(--color-line-strong)";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: isDecision && (edge.condition === "true" || edge.condition === "false") ? edge.condition : undefined,
      type: "platform",
      animated: runState === "active",
      style: { stroke },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
      data: { condition: edge.condition, isDecision, issue: edgeIssue?.message, runState },
    };
  });
  const errorEdges: PlatformFlowEdge[] = graph.nodes
    .filter((node) => node.onError?.strategy === "route" && node.onError.target)
    .map((node) => ({
      id: `error:${node.id}:${node.onError!.target}`,
      source: node.id,
      target: node.onError!.target!,
      type: "platform",
      animated: false,
      selectable: false,
      deletable: false,
      style: { stroke: "var(--color-warn)", strokeDasharray: "6 4" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-warn)", width: 16, height: 16 },
      data: { condition: "error", isDecision: false },
    }));
  return [...edges, ...errorEdges];
}

export interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  selectedId?: string;
  runningNodeId?: string;
  nodeStatuses?: Record<string, string>;
  runProgress?: RunProgress;
  agentStatus?: { busy: boolean; activity?: string };
  agentTouchedNodeIds?: string[];
  className?: string;
  connecting?: { sourceId: string; condition?: "true" | "false" } | null;
  issues?: GraphIssue[];
  onSelect(nodeId: string): void;
  onChange(graph: WorkflowGraph): void;
  onConnect(sourceId: string, targetId: string, condition?: "true" | "false"): void;
  onConnectRejected(message: string): void;
  onStartConnect(nodeId: string): void;
  onCancelConnect(): void;
  onDuplicateNode(nodeId: string): void;
  onDeleteNode(nodeId: string): void;
  onDeleteEdge(edgeId: string): void;
  onChangeEdgeCondition(edgeId: string, condition: "true" | "false"): void;
  onOpenPalette(): void;
  onOpenRuns?(): void;
  onOpenChat?(): void;
}

export function WorkflowCanvas({
  graph,
  selectedId,
  runningNodeId,
  nodeStatuses,
  runProgress,
  agentStatus,
  agentTouchedNodeIds,
  className,
  connecting,
  issues = EMPTY_ISSUES,
  onSelect,
  onChange,
  onConnect,
  onConnectRejected,
  onStartConnect,
  onCancelConnect,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  onChangeEdgeCondition,
  onOpenPalette,
  onOpenRuns,
  onOpenChat,
}: WorkflowCanvasProps) {
  const validity = useMemo(() => {
    if (!connecting) return undefined;
    const map: Record<string, string | undefined> = { __source: connecting.sourceId };
    for (const node of graph.nodes) {
      if (node.id === connecting.sourceId) continue;
      map[node.id] = getConnectionIssue(graph, connecting.sourceId, node.id, connecting.condition);
    }
    return map;
  }, [connecting, graph]);

  const [nodes, setNodes, onNodesChange] = useNodesState<PlatformFlowNode>(
    toNodes(graph, selectedId, runningNodeId, nodeStatuses, issues, validity, agentTouchedNodeIds),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<PlatformFlowEdge>(
    toEdges(graph, issues, runningNodeId, nodeStatuses),
  );
  const [flow, setFlow] = useState<ReactFlowInstance<PlatformFlowNode, PlatformFlowEdge>>();
  const draggedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastFittedGraphRef = useRef<string | undefined>(undefined);

  const NODE_WIDTH = 252;
  const NODE_HEIGHT = 96;

  useEffect(() => {
    if (!flow || graph.nodes.length === 0 || lastFittedGraphRef.current === graph.id) return;
    lastFittedGraphRef.current = graph.id;
    const timer = setTimeout(() => {
      const minX = Math.min(...graph.nodes.map((node) => node.position.x));
      const maxX = Math.max(...graph.nodes.map((node) => node.position.x + NODE_WIDTH));
      const minY = Math.min(...graph.nodes.map((node) => node.position.y));
      const maxY = Math.max(...graph.nodes.map((node) => node.position.y + NODE_HEIGHT));
      const width = canvasRef.current?.clientWidth ?? 0;
      const height = canvasRef.current?.clientHeight ?? 0;
      const horizontalFit = width > 0 ? (width * 0.8) / Math.max(maxX - minX, 1) : 0;
      const verticalFit = height > 0 ? (height * 0.8) / Math.max(maxY - minY, 1) : 0;
      const fitZoom = Math.min(horizontalFit, verticalFit, 1.2);
      if (fitZoom >= 0.8) {
        flow.fitView({ padding: 0.1, duration: 300, minZoom: 0.8, maxZoom: 1.2 });
        return;
      }
      const trigger = graph.nodes.find((node) => node.type === "trigger") ?? graph.nodes[0];
      const centerX = trigger.position.x + NODE_WIDTH / 2;
      const centerY = trigger.position.y + NODE_HEIGHT / 2;
      flow.setCenter(centerX, centerY, { zoom: 0.8, duration: 300 });
    }, 80);
    return () => clearTimeout(timer);
  }, [flow, graph.id, graph.nodes]);

  function fitOverview() {
    flow?.fitView({ padding: 0.1, duration: 300, minZoom: 0.25, maxZoom: 1.2 });
  }

  useEffect(() => {
    setNodes(toNodes(graph, selectedId, runningNodeId, nodeStatuses, issues, validity, agentTouchedNodeIds));
  }, [graph, selectedId, runningNodeId, nodeStatuses, issues, validity, agentTouchedNodeIds, setNodes]);

  useEffect(() => {
    setEdges(toEdges(graph, issues, runningNodeId, nodeStatuses));
  }, [graph, issues, runningNodeId, nodeStatuses, setEdges]);

  useEffect(() => {
    if (!connecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancelConnect();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [connecting, onCancelConnect]);

  function handleNodesChange(changes: NodeChange<PlatformFlowNode>[]) {
    onNodesChange(changes);
    const removed = changes.filter((change) => change.type === "remove").map((change) => change.id);
    if (removed.length === 0) return;
    onChange({
      ...graph,
      nodes: graph.nodes.filter((node) => !removed.includes(node.id)),
      edges: graph.edges.filter((edge) => !removed.includes(edge.source) && !removed.includes(edge.target)),
    });
  }

  function handleEdgesChange(changes: EdgeChange<PlatformFlowEdge>[]) {
    onEdgesChange(changes);
    if (!changes.some((change) => change.type === "remove")) return;
    const next = applyEdgeChanges(changes, edges);
    onChange({
      ...graph,
      edges: next.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        condition: edge.data?.condition,
      })),
    });
  }

  function handleConnect(connection: Connection) {
    const resolved = resolveConnection(graph, connection);
    if ("issue" in resolved) {
      onConnectRejected(resolved.issue);
      return;
    }
    onConnect(resolved.source, resolved.target, resolved.condition);
  }

  function handleNodeClick(_event: React.MouseEvent, node: PlatformFlowNode) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (connecting) {
      const issue = getConnectionIssue(graph, connecting.sourceId, node.id, connecting.condition);
      if (issue) {
        onConnectRejected(issue);
        return;
      }
      onConnect(connecting.sourceId, node.id, connecting.condition);
      return;
    }
    onSelect(node.id);
  }

  const actions = {
    onDuplicateNode,
    onStartConnect,
    onDeleteNode,
    onDeleteEdge,
    onChangeEdgeCondition,
  };

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div ref={canvasRef} className={`${className ?? "h-full"} relative overflow-hidden bg-ink`} data-testid="workflow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onInit={setFlow}
          onPaneClick={() => {
            if (connecting) onCancelConnect();
          }}
          onNodeDragStart={() => {
            draggedRef.current = true;
          }}
          onNodeDragStop={(_, node) => {
            draggedRef.current = true;
            setTimeout(() => {
              draggedRef.current = false;
            }, 0);
            onChange({
              ...graph,
              nodes: graph.nodes.map((item) => (item.id === node.id ? { ...item, position: node.position } : item)),
            });
          }}
          minZoom={0.25}
          maxZoom={1.6}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} color="var(--color-line)" />
          <Panel position="top-left">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-line bg-well/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg transition hover:border-accent"
                onClick={onOpenPalette}
              >
                + Nodo
              </button>
              <button
                type="button"
                className="rounded-lg border border-line bg-well/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg transition hover:border-accent"
                onClick={fitOverview}
                aria-label="Ajustar vista del flujo"
              >
                Ajustar vista
              </button>
            </div>
          </Panel>
          {connecting && (
            <Panel position="top-center">
              <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-well/95 px-3 py-2 text-xs text-slate-200 shadow-lg">
                Elige el destino
                {connecting.condition && <span className="rounded bg-panel-2 px-1.5 py-0.5">{connecting.condition === "true" ? "sí" : "no"}</span>}
                <span className="text-muted">· Esc para cancelar</span>
                <button type="button" className="text-accent hover:underline" onClick={onCancelConnect}>
                  Cancelar
                </button>
              </div>
            </Panel>
          )}
          {(runProgress || agentStatus?.busy) && (
            <Panel position="top-right">
              <div className="flex flex-col gap-2">
                {agentStatus?.busy && (
                  <div
                    className="flex min-w-[230px] items-center gap-2.5 rounded-xl border border-violet/40 bg-well/95 px-3 py-2 text-xs shadow-xl"
                    data-testid="agent-progress"
                    aria-live="polite"
                  >
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet motion-reduce:animate-none" />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-[11px] text-slate-100">Agente trabajando</strong>
                      <span className="block truncate text-[11px] text-muted">
                        {agentStatus.activity ?? "Preparando respuesta…"}
                      </span>
                    </div>
                    {onOpenChat && (
                      <button type="button" className="shrink-0 text-[11px] text-accent hover:underline" onClick={onOpenChat}>
                        Abrir chat
                      </button>
                    )}
                  </div>
                )}
                {runProgress && (
                  <div
                    className="flex min-w-[230px] items-center gap-2.5 rounded-xl border border-line bg-well/95 px-3 py-2 text-xs shadow-xl"
                    data-testid="run-progress"
                    aria-live="polite"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        runProgress.status === "paused" ? "bg-warn" : "animate-pulse bg-accent motion-reduce:animate-none"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-[11px] text-slate-100">
                        {runProgress.status === "paused" ? "Ejecución pausada" : "Ejecutando"}
                      </strong>
                      <span className="block truncate text-[11px] text-muted">
                        {runProgress.currentNodeLabel ?? "Preparando nodo…"}
                      </span>
                    </div>
                    <span className="shrink-0 rounded bg-panel-2 px-2 py-0.5 text-[11px] text-muted">
                      {runProgress.completedSteps} pasos
                    </span>
                    {onOpenRuns && (
                      <button type="button" className="shrink-0 text-[11px] text-accent hover:underline" onClick={onOpenRuns}>
                        Ejecuciones
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}
          <Controls />
          <MiniMap
            pannable
            zoomable
            style={{ background: "var(--color-well)", width: 140, height: 100 }}
            maskColor="rgba(7, 11, 20, 0.72)"
            nodeColor={(node) => NODE_META[(node.data as PlatformFlowNode["data"])?.nodeType]?.color ?? "var(--color-line-strong)"}
            nodeStrokeColor={() => "var(--color-muted)"}
          />
        </ReactFlow>
      </div>
    </CanvasActionsContext.Provider>
  );
}
