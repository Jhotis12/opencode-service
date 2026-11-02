import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeToolbar,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useCanvasActions } from "./nodes/canvas-actions.ts";

export type PlatformEdgeData = {
  condition?: string;
  isDecision?: boolean;
  issue?: string;
  runState?: "active" | "completed";
};

export type PlatformFlowEdge = Edge<PlatformEdgeData, "platform">;

export function PlatformEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style,
  data,
}: EdgeProps<PlatformFlowEdge>) {
  const actions = useCanvasActions();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
  });
  const label = data?.condition === "true" ? "sí" : data?.condition === "false" ? "no" : undefined;
  const runColor = data?.runState === "active" ? "var(--color-accent)" : data?.runState === "completed" ? "var(--color-ok)" : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={22}
        style={{
          ...style,
          stroke: selected ? "var(--color-accent)" : (runColor ?? String(style?.stroke ?? "var(--color-line-strong)")),
          strokeWidth: selected ? 2.2 : data?.runState === "active" ? 2.5 : data?.runState === "completed" ? 2 : 1.5,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan absolute rounded border border-line bg-well px-1.5 py-0.5 text-[11px] text-slate-300"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
      <EdgeToolbar
        edgeId={id}
        x={labelX}
        y={labelY}
        isVisible={selected}
        alignY="bottom"
        className="flex items-center gap-1 rounded-lg border border-line bg-well/95 p-1 shadow-xl"
      >
        {data?.issue && (
          <span role="img" aria-label="Problema de conexión" title={data.issue} className="px-1 text-[11px] text-warn">
            !
          </span>
        )}
        {data?.isDecision && (
          <select
            aria-label="Rama de la conexión"
            className="!w-auto !rounded-md !border-line !bg-panel-2 !px-2 !py-1 !text-[11px]"
            value={data.condition ?? "true"}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => actions?.onChangeEdgeCondition(id, event.target.value as "true" | "false")}
          >
            <option value="true">sí</option>
            <option value="false">no</option>
          </select>
        )}
        <button
          type="button"
          aria-label="Eliminar conexión"
          title="Eliminar conexión"
          className="grid h-7 w-7 place-items-center rounded-md text-slate-300 transition hover:bg-danger/10 hover:text-danger"
          onClick={(event) => {
            event.stopPropagation();
            actions?.onDeleteEdge(id);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      </EdgeToolbar>
    </>
  );
}
