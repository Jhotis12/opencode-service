import type { CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@platform/shared";
import { NODE_META } from "./node-catalog.ts";
import { NodeIcon } from "./node-icons.tsx";

export type PlatformNodeData = {
  label: string;
  subtitle?: string;
  nodeType: NodeType;
  status?: string;
} & Record<string, unknown>;

export type PlatformFlowNode = Node<PlatformNodeData, "platform">;

const statusColor: Record<string, string> = {
  succeeded: "#22c55e",
  failed: "#fb7185",
  timed_out: "#fb7185",
  running: "#38bdf8",
};

export function PlatformNode({ data, selected }: NodeProps<PlatformFlowNode>) {
  const meta = NODE_META[data.nodeType];
  const isTrigger = data.nodeType === "trigger";
  const isDecision = data.nodeType === "decision";
  const dashed = data.nodeType === "decision" || data.nodeType === "approval";

  return (
    <div
      className={`relative flex min-w-[230px] max-w-[280px] items-center gap-2.5 border-2 px-3.5 py-2.5 text-slate-200 shadow-lg transition ${
        isTrigger ? "rounded-full" : "rounded-[14px]"
      } ${dashed ? "border-dashed" : ""} ${selected ? "ring-2 ring-slate-100/25" : ""}`}
      style={
        {
          borderColor: selected ? "#f8fafc" : meta.color,
          background: `linear-gradient(135deg, color-mix(in srgb, ${meta.color} 18%, #0f172a), #0b1220)`,
        } as CSSProperties
      }
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-[#0b1220]"
          style={{ background: meta.color }}
        />
      )}
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
        style={{ background: `color-mix(in srgb, ${meta.color} 22%, #0b1220)`, color: meta.color }}
      >
        <NodeIcon type={data.nodeType} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-wider" style={{ color: meta.color }}>
          {meta.title}
        </span>
        <strong className="truncate text-[13px]">{data.label}</strong>
        {data.subtitle && <small className="truncate text-[10px] text-muted">{data.subtitle}</small>}
      </div>
      {data.status && (
        <span
          role="status"
          aria-label={`Estado: ${data.status}`}
          className={`absolute right-2.5 top-2 h-2 w-2 rounded-full ${data.status === "running" ? "animate-pulse" : ""}`}
          style={{ background: statusColor[data.status] ?? "#64748b" }}
          title={data.status}
        />
      )}
      {isDecision ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            className="!h-2.5 !w-2.5 !border-2 !border-[#0b1220]"
            style={{ top: "36%", background: "#34d399" }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            className="!h-2.5 !w-2.5 !border-2 !border-[#0b1220]"
            style={{ top: "72%", background: "#fb7185" }}
          />
          <span className="absolute -right-7 top-[30%] text-[9px] text-muted">sí</span>
          <span className="absolute -right-7 top-[66%] text-[9px] text-muted">no</span>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-[#0b1220]"
          style={{ background: meta.color }}
        />
      )}
    </div>
  );
}
