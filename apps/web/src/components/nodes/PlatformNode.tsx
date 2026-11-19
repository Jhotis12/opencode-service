import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@platform/shared";
import { NODE_META } from "./node-catalog.ts";
import { NodeIcon } from "./node-icons.tsx";
import { nodeShapeStyle } from "./node-shapes.ts";
import { statusLabel } from "../../ui.ts";
import { useCanvasActions } from "./canvas-actions.ts";

export type ConnectRole = "source" | "valid" | "invalid";

export type PlatformNodeData = {
  label: string;
  subtitle?: string;
  nodeType: NodeType;
  status?: string;
  issue?: string;
  connectRole?: ConnectRole;
  agentTouched?: boolean;
} & Record<string, unknown>;

export type PlatformFlowNode = Node<PlatformNodeData, "platform">;

const statusColor: Record<string, string> = {
  succeeded: "var(--color-ok)",
  failed: "var(--color-danger)",
  timed_out: "var(--color-danger)",
  running: "var(--color-accent)",
};

function NodeStatusIcon({ status }: { status: string }) {
  const color = statusColor[status] ?? "var(--color-faint)";
  if (status === "running") {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="animate-spin motion-reduce:animate-none"
        style={{ color }}
        aria-hidden
      >
        <circle cx="12" cy="12" r="8" strokeDasharray="32 18" />
      </svg>
    );
  }
  if (status === "failed" || status === "timed_out") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ color }} aria-hidden>
        <path d="M12 7v7M12 17h.01" />
      </svg>
    );
  }
  if (status === "succeeded") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ color }} aria-hidden>
        <path d="m5 12 4.5 4.5L19 7" />
      </svg>
    );
  }
  return <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />;
}

function ToolbarIcon({ kind }: { kind: "duplicate" | "connect" | "delete" }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "duplicate") {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </svg>
    );
  }
  if (kind === "connect") {
    return (
      <svg {...common}>
        <path d="M9 15 15 9M8 5H5a2 2 0 0 0-2 2v3M16 19h3a2 2 0 0 0 2-2v-3" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

function ToolbarButton({
  label,
  kind,
  onClick,
}: {
  label: string;
  kind: "duplicate" | "connect" | "delete";
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-md border border-transparent text-slate-300 transition hover:border-line hover:bg-panel-2 ${
        kind === "delete" ? "hover:text-danger" : ""
      }`}
      onClick={(event: ReactMouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <ToolbarIcon kind={kind} />
    </button>
  );
}

export function PlatformNode({ id, data, selected }: NodeProps<PlatformFlowNode>) {
  const meta = NODE_META[data.nodeType];
  const isTrigger = data.nodeType === "trigger";
  const isDecision = data.nodeType === "decision";
  const actions = useCanvasActions();
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shape = nodeShapeStyle(data.nodeType);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  function showToolbar() {
    clearTimeout(hideTimer.current);
    setHovered(true);
  }

  function hideToolbarSoon() {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 180);
  }

  const borderColor =
    selected
      ? "var(--color-selection)"
      : data.issue
        ? "var(--color-warn)"
        : data.status === "running"
          ? "var(--color-accent)"
          : data.status === "failed" || data.status === "timed_out"
            ? "var(--color-danger)"
            : meta.color;
  const connectClass =
    data.connectRole === "valid"
      ? "ring-2 ring-emerald-400/90"
      : data.connectRole === "invalid"
        ? "opacity-35"
        : data.connectRole === "source"
          ? "ring-2 ring-sky-300"
          : "";

  return (
    <div
      className={`relative h-[96px] w-[252px] text-slate-200 transition ${
        data.status === "running" ? "run-node-running" : ""
      } ${connectClass}`}
      data-node-shape={data.nodeType}
      data-node-id={id}
      onMouseEnter={showToolbar}
      onMouseLeave={hideToolbarSoon}
    >
      {data.agentTouched && (
        <div className="agent-touch-layer absolute -inset-[3px]" style={{ ...shape, background: "var(--color-violet)" } as CSSProperties} />
      )}
      <div className="absolute inset-0" style={{ ...shape, background: borderColor } as CSSProperties} />
      <div
        className="absolute inset-[2px] overflow-hidden"
        style={
          {
            ...shape,
            background: `linear-gradient(135deg, color-mix(in srgb, ${meta.color} 18%, var(--color-panel-2)), var(--color-well))`,
          } as CSSProperties
        }
      >
        <div className={`relative flex h-full min-w-0 items-center gap-2.5 ${data.nodeType === "transform" ? "px-3.5 pr-7" : "px-4"}`}>
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            style={{ background: `color-mix(in srgb, ${meta.color} 22%, var(--color-well))`, color: meta.color }}
          >
            <NodeIcon type={data.nodeType} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[11px] uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.title}
            </span>
            <strong className="truncate text-[14px]" title={data.label}>
              {data.label}
            </strong>
            {data.subtitle && (
              <small className="truncate text-[11px] text-muted" title={data.subtitle}>
                {data.subtitle}
              </small>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {data.issue && (
              <span
                role="img"
                aria-label="Problema de conexión"
                title={data.issue}
                className="h-2 w-2 rounded-full bg-warn"
              />
            )}
            {data.status && (
              <span
                role="status"
                aria-label={`Estado: ${statusLabel(data.status)}`}
                title={statusLabel(data.status)}
                data-status={data.status}
                className="inline-flex h-3 w-3 items-center justify-center"
              >
                <NodeStatusIcon status={data.status} />
              </span>
            )}
          </div>
        </div>
      </div>

      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-well"
          style={{ background: meta.color }}
        />
      )}

      {isDecision ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            className="!h-2.5 !w-2.5 !border-2 !border-well"
            style={{ top: "34%", background: "var(--color-node-logic)" }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            className="!h-2.5 !w-2.5 !border-2 !border-well"
            style={{ top: "66%", background: "var(--color-danger)" }}
          />
          <span className="absolute -right-6 top-[28%] text-[11px] text-muted">sí</span>
          <span className="absolute -right-6 top-[60%] text-[11px] text-muted">no</span>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-well"
          style={{ background: meta.color }}
        />
      )}

      <NodeToolbar position={Position.Top} offset={10} isVisible={selected || hovered}>
        <div
          className="flex items-center gap-0.5 rounded-lg border border-line bg-well/95 p-1 shadow-xl"
          onMouseEnter={showToolbar}
          onMouseLeave={hideToolbarSoon}
        >
          <ToolbarButton label="Duplicar nodo" kind="duplicate" onClick={() => actions?.onDuplicateNode(id)} />
          <ToolbarButton label="Conectar nodo" kind="connect" onClick={() => actions?.onStartConnect(id)} />
          <ToolbarButton label="Eliminar nodo" kind="delete" onClick={() => actions?.onDeleteNode(id)} />
        </div>
      </NodeToolbar>
    </div>
  );
}
