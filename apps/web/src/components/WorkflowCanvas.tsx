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
    case "decision":
      return node.config.mode === "condition" ? "Condición visual" : node.codeFile;
    case "http":
      return `${String(node.config.method ?? "GET")} ${String(node.config.url ?? "")}`.trim();
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
  return graph.edges.map((edge) => {
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
        ? "#f59e0b"
        : runState === "active"
          ? "#38bdf8"
          : runState === "completed"
            ? "#22c55e"
            : "#475569";
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

  useEffect(() => {
    if (!flow) return;
    const timer = setTimeout(() => flow.fitView({ padding: 0.2, duration: 300 }), 300);
    return () => clearTimeout(timer);
  }, [flow, graph.id, graph.nodes.length]);

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
      <div className={`${className ?? "h-full"} relative overflow-hidden bg-[#060b15]`} data-testid="workflow-canvas">
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
          fitView
          minZoom={0.25}
          maxZoom={1.6}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} color="#1e293b" />
          <Panel position="top-left">
            <button
              type="button"
              className="rounded-lg border border-line bg-[#0b1220]/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg transition hover:border-accent"
              onClick={onOpenPalette}
            >
              + Nodo
            </button>
          </Panel>
          {connecting && (
            <Panel position="top-center">
              <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-[#0b1220]/95 px-3 py-2 text-xs text-slate-200 shadow-lg">
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
                    className="flex min-w-[230px] items-center gap-2.5 rounded-xl border border-violet/40 bg-[#0b1220]/95 px-3 py-2 text-xs shadow-xl"
                    data-testid="agent-progress"
                    aria-live="polite"
                  >
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet motion-reduce:animate-none" />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-[11px] text-slate-100">Agente trabajando</strong>
                      <span className="block truncate text-[10px] text-muted">
                        {agentStatus.activity ?? "Preparando respuesta…"}
                      </span>
                    </div>
                    {onOpenChat && (
                      <button type="button" className="shrink-0 text-[10px] text-accent hover:underline" onClick={onOpenChat}>
                        Abrir chat
                      </button>
                    )}
                  </div>
                )}
                {runProgress && (
                  <div
                    className="flex min-w-[230px] items-center gap-2.5 rounded-xl border border-line bg-[#0b1220]/95 px-3 py-2 text-xs shadow-xl"
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
                      <span className="block truncate text-[10px] text-muted">
                        {runProgress.currentNodeLabel ?? "Preparando nodo…"}
                      </span>
                    </div>
                    <span className="shrink-0 rounded bg-panel-2 px-2 py-0.5 text-[10px] text-muted">
                      {runProgress.completedSteps} pasos
                    </span>
                    {onOpenRuns && (
                      <button type="button" className="shrink-0 text-[10px] text-accent hover:underline" onClick={onOpenRuns}>
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
            style={{ background: "#0b1220", width: 140, height: 100 }}
            maskColor="rgba(2, 6, 23, 0.72)"
            nodeColor={(node) => NODE_META[(node.data as PlatformFlowNode["data"])?.nodeType]?.color ?? "#475569"}
            nodeStrokeColor={() => "#94a3b8"}
          />
        </ReactFlow>
      </div>
    </CanvasActionsContext.Provider>
  );
}
