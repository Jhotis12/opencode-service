import { useEffect, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  applyEdgeChanges,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeSpec, WorkflowGraph } from "@platform/shared";
import { PlatformNode, type PlatformFlowNode } from "./nodes/PlatformNode.tsx";

const nodeTypes = { platform: PlatformNode };

function subtitle(node: NodeSpec): string | undefined {
  switch (node.type) {
    case "trigger": {
      const kind = String(node.config.kind ?? "manual");
      const channel = node.config.channelSlug ? ` · ${node.config.channelSlug}` : "";
      return `${kind}${channel}`;
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
): PlatformFlowNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "platform",
    position: node.position,
    data: {
      label: node.label ?? node.id,
      subtitle: subtitle(node),
      nodeType: node.type,
      status: runningNodeId === node.id ? "running" : nodeStatuses?.[node.id],
    },
  }));
}

function toEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.condition === "true" || edge.condition === "false" ? edge.condition : undefined,
    label: edge.condition,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#475569" },
    labelStyle: { fill: "#94a3b8", fontSize: 10 },
    labelBgStyle: { fill: "#0b1220" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#475569", width: 16, height: 16 },
  }));
}

export interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  selectedId?: string;
  runningNodeId?: string;
  nodeStatuses?: Record<string, string>;
  onSelect(nodeId: string): void;
  onChange(graph: WorkflowGraph): void;
}

export function WorkflowCanvas({
  graph,
  selectedId,
  runningNodeId,
  nodeStatuses,
  onSelect,
  onChange,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<PlatformFlowNode>(
    toNodes(graph, selectedId, runningNodeId, nodeStatuses),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(graph));
  const [flow, setFlow] = useState<ReactFlowInstance<PlatformFlowNode, Edge>>();

  useEffect(() => {
    if (!flow) return;
    const timer = setTimeout(() => flow.fitView({ padding: 0.2, duration: 300 }), 300);
    return () => clearTimeout(timer);
  }, [flow, graph.id, graph.nodes.length]);

  useEffect(() => {
    setNodes(toNodes(graph, selectedId, runningNodeId, nodeStatuses));
  }, [graph, selectedId, runningNodeId, nodeStatuses, setNodes]);

  useEffect(() => {
    setEdges(toEdges(graph));
  }, [graph, setEdges]);

  function handleEdgesChange(changes: EdgeChange[]) {
    onEdgesChange(changes);
    if (changes.some((change) => change.type === "remove")) {
      const next = applyEdgeChanges(changes, edges);
      onChange({
        ...graph,
        edges: next.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          condition: graph.edges.find((item) => item.id === edge.id)?.condition,
        })),
      });
    }
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    const id = `edge-${crypto.randomUUID().slice(0, 8)}`;
    const sourceNode = graph.nodes.find((node) => node.id === connection.source);
    const condition =
      sourceNode?.type === "decision" ? (connection.sourceHandle === "false" ? "false" : "true") : undefined;
    setEdges((current) => [
      ...current,
      {
        id,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: condition,
        label: condition,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#475569" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#475569", width: 16, height: 16 },
      },
    ]);
    onChange({ ...graph, edges: [...graph.edges, { id, source: connection.source, target: connection.target, condition }] });
  }

  return (
    <div className="h-[540px] overflow-hidden rounded-xl border border-line bg-[#060b15]" data-testid="workflow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onInit={setFlow}
        onNodeDragStop={(_, node) =>
          onChange({
            ...graph,
            nodes: graph.nodes.map((item) => (item.id === node.id ? { ...item, position: node.position } : item)),
          })
        }
        fitView
        minZoom={0.25}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} color="#1e293b" />
        <Controls />
        <MiniMap
          pannable
          zoomable
          style={{ background: "#0b1220", width: 140, height: 100 }}
          maskColor="rgba(2, 6, 23, 0.72)"
          nodeColor={(node) => String(node.style?.border ?? "#475569")}
          nodeStrokeColor={() => "#94a3b8"}
        />
      </ReactFlow>
    </div>
  );
}
