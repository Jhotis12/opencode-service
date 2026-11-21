import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeSpec, WorkflowGraph } from "@platform/shared";
import { PlatformNode, type PlatformFlowNode, type ConnectRole } from "./nodes/PlatformNode.tsx";
import { PlatformEdge, type PlatformFlowEdge } from "./PlatformEdge.tsx";
import { CanvasActionsContext } from "./nodes/canvas-actions.ts";
import { NODE_META } from "./nodes/node-catalog.ts";
import { getConnectionIssue, resolveConnection, type GraphIssue } from "./canvas/graph-edits.ts";
import { AgentFlowUpdateNotice, ShortcutsHelp, ZoomReadout } from "./canvas/canvas-overlays.tsx";
import { focusRing } from "../ui.ts";
import { useMediaQuery } from "../useMediaQuery.ts";

/** Phone breakpoint shared by the narrow canvas chrome; matches the picker sheet. */
export const PHONE_QUERY = "(max-width: 639px)";
/** Drop radius around a handle, so a fingertip does not have to hit a 10 px dot. */
export const TOUCH_CONNECTION_RADIUS = 32;
/** Doubles the 10 px handle (`!h-2.5` on PlatformNode) into a 16 px touch target. */
const NARROW_HANDLE_TARGET = "[&_[data-handlepos]]:h-4! [&_[data-handlepos]]:w-4!";
/**
 * Air between the measured top of the fixed chat pill and the bottom of the phone stack. The pill's
 * own band is never a constant: its `bottom-*` offset, its padding and its text all scale with the
 * root font size, so the canvas measures the pill's box and reserves exactly what it covers.
 */
const TRANSIENT_PILL_GAP_PX = 12;
/** Air between the top of the phone stack and the top-left canvas actions row. */
const TRANSIENT_STACK_GAP_PX = 10;
/** React Flow's own bottom margin for a panel; also the floor under a below-the-pill stack. */
const TRANSIENT_PANEL_MARGIN_PX = 15;
/**
 * The multi-chip stack is 168.63 px tall at the 16 px root (connect banner + agent + run), so it is
 * measured in rem and scales with the root font size like the chips themselves. Below this band the
 * chips collapse into one line, which is what keeps a 320x568 phone readable: the canvas there has
 * ~95 px between the actions row and the pill, well short of three chips.
 */
const TRANSIENT_FULL_STACK_REM = 11;
const BASE_ROOT_FONT_PX = 16;

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

function ConnectBanner({
  connecting,
  narrow,
  onCancel,
}: {
  connecting: { sourceId: string; condition?: "true" | "false" };
  narrow: boolean;
  onCancel(): void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-accent/40 bg-well/95 px-3 py-2 text-xs text-slate-200 shadow-lg ${
        narrow ? "w-full flex-wrap" : ""
      }`}
    >
      Elige el destino
      {connecting.condition && <span className="rounded bg-panel-2 px-1.5 py-0.5">{connecting.condition === "true" ? "sí" : "no"}</span>}
      <span className="text-muted">· {narrow ? "toca el nodo destino" : "Esc para cancelar"}</span>
      <button type="button" className="text-accent hover:underline" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}

function AgentProgressChip({
  activity,
  narrow,
  onOpenChat,
}: {
  activity?: string;
  narrow: boolean;
  onOpenChat?(): void;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-violet/40 bg-well/95 px-3 py-2 text-xs shadow-xl ${
        narrow ? "w-full min-w-0" : "min-w-[230px]"
      }`}
      data-testid="agent-progress"
      aria-live="polite"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet motion-reduce:animate-none" />
      <div className="min-w-0 flex-1">
        <strong className="block text-[11px] text-slate-100">Agente trabajando</strong>
        <span className="block truncate text-[11px] text-muted">{activity ?? "Preparando respuesta…"}</span>
      </div>
      {onOpenChat && (
        <button type="button" className="shrink-0 text-[11px] text-accent hover:underline" onClick={onOpenChat}>
          Abrir chat
        </button>
      )}
    </div>
  );
}

function RunProgressChip({
  runProgress,
  narrow,
  onOpenRuns,
}: {
  runProgress: RunProgress;
  narrow: boolean;
  onOpenRuns?(): void;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-line bg-well/95 px-3 py-2 text-xs shadow-xl ${
        narrow ? "w-full min-w-0" : "min-w-[230px]"
      }`}
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
        <span className="block truncate text-[11px] text-muted">{runProgress.currentNodeLabel ?? "Preparando nodo…"}</span>
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
  );
}

/**
 * The phone's transient overlays all live in one bottom-centre panel lifted above the chat pill.
 * The panel owns at most the band between the pill and the top-left actions row; when that band is
 * shorter than the multi-chip stack, the chips collapse into a single summarising line whose height
 * does not depend on the copy (truncate + nowrap). `maxHeight` is the hard cap either way.
 */
function TransientStack({
  connecting,
  agentStatus,
  runProgress,
  compact,
  maxHeight,
  placement,
  pillReserve,
  onCancelConnect,
  onOpenChat,
  onOpenRuns,
}: {
  connecting?: { sourceId: string; condition?: "true" | "false" } | null;
  agentStatus?: { busy: boolean; activity?: string };
  runProgress?: RunProgress;
  compact: boolean;
  maxHeight?: number;
  placement?: "above" | "below" | "none";
  pillReserve?: number;
  onCancelConnect(): void;
  onOpenChat?(): void;
  onOpenRuns?(): void;
}) {
  const signals = [
    connecting ? "conexión" : undefined,
    agentStatus?.busy ? "agente" : undefined,
    runProgress ? "ejecución" : undefined,
  ].filter((signal): signal is string => signal !== undefined);
  const hidden = signals.length - 1;
  const cap = maxHeight === undefined ? undefined : { maxHeight };

  if (compact) {
    const notice = connecting
      ? "Elige el destino"
      : agentStatus?.busy
        ? "Agente trabajando"
        : `Ejecutando · ${runProgress?.currentNodeLabel ?? "preparando nodo"}`;
    return (
      <div
        className="pointer-events-auto flex h-8 w-[16rem] max-w-[calc(100vw-6rem)] items-center gap-2 overflow-hidden rounded-lg border border-accent/40 bg-well/95 px-3 text-xs text-slate-200 shadow-lg"
        style={cap}
        data-canvas-overlay="transient"
        data-canvas-compact="true"
        data-canvas-placement={placement}
        data-canvas-transient-signals={signals.join(",")}
        data-canvas-pill-reserve={pillReserve}
        aria-live="polite"
      >
        <span className="min-w-0 flex-1 truncate whitespace-nowrap" data-testid="transient-notice">
          {notice}
        </span>
        {hidden > 0 && (
          <span
            className="shrink-0 rounded bg-panel-2 px-1.5 text-[11px] text-muted"
            title={`También: ${signals.slice(1).join(", ")}`}
          >
            +{hidden}
          </span>
        )}
        {connecting && (
          <button type="button" className="shrink-0 text-[11px] text-accent hover:underline" onClick={onCancelConnect}>
            Cancelar
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto flex w-[16rem] max-w-[calc(100vw-6rem)] flex-col gap-2 overflow-y-auto"
      style={cap}
      data-canvas-overlay="transient"
      data-canvas-placement={placement}
      data-canvas-transient-signals={signals.join(",")}
      data-canvas-pill-reserve={pillReserve}
    >
      {connecting && <ConnectBanner connecting={connecting} narrow onCancel={onCancelConnect} />}
      {agentStatus?.busy && (
        <AgentProgressChip activity={agentStatus.activity} narrow onOpenChat={onOpenChat} />
      )}
      {runProgress && <RunProgressChip runProgress={runProgress} narrow onOpenRuns={onOpenRuns} />}
    </div>
  );
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

/** Air between the fitted graph and the visible edges of the canvas. */
const CHAT_FIT_GAP_PX = 32;
/** Below this much uncovered canvas the drawer hides the graph anyway; keep the viewport. */
const CHAT_FIT_MIN_VISIBLE_PX = 240;

type PixelPadding = `${number}px`;

/**
 * Fit padding that keeps the graph inside the canvas area the chat drawer leaves visible.
 * The drawer is a fixed overlay, so the fit gets the covered width as right padding instead of
 * the canvas shrinking. Returns `null` when the drawer leaves no usable strip to fit into.
 */
export function chatFitPadding(
  canvasWidth: number,
  drawerWidth: number,
): { top: PixelPadding; right: PixelPadding; bottom: PixelPadding; left: PixelPadding } | null {
  if (canvasWidth - drawerWidth < CHAT_FIT_MIN_VISIBLE_PX) return null;
  return {
    top: `${CHAT_FIT_GAP_PX}px`,
    right: `${drawerWidth + CHAT_FIT_GAP_PX}px`,
    bottom: `${CHAT_FIT_GAP_PX}px`,
    left: `${CHAT_FIT_GAP_PX}px`,
  };
}

export interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  selectedId?: string;
  runningNodeId?: string;
  nodeStatuses?: Record<string, string>;
  runProgress?: RunProgress;
  agentStatus?: { busy: boolean; activity?: string };
  /** The layout's fixed chat pill is on screen; the narrow stack must clear its band. */
  chatPillVisible?: boolean;
  agentTouchedNodeIds?: string[];
  agentUpdate?: { summary: string; at?: number };
  onDismissAgentUpdate?(): void;
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
  chatPillVisible = false,
  agentTouchedNodeIds,
  agentUpdate,
  onDismissAgentUpdate,
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
  // The layout renders the chat drawer as a fixed overlay, so it publishes its state on the element
  // and this canvas, which it covers, mirrors it instead of duplicating the workspace state.
  const [chatOpen, setChatOpen] = useState(false);
  const draggedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const lastFittedGraphRef = useRef<string | undefined>(undefined);
  const narrow = useMediaQuery(PHONE_QUERY);
  /**
   * Where the phone stack lives inside the canvas and how tall it may get. `reserve` is the panel's
   * bottom margin; `band` is the measured room between the actions row and the pill (or the canvas
   * bottom when the stack sits under the pill). `null` until the geometry is measurable.
   */
  const [transientLayout, setTransientLayout] = useState<{
    placement: "above" | "below" | "none";
    reserve: number;
    band: number;
  } | null>(null);
  const [rootFontPx, setRootFontPx] = useState(BASE_ROOT_FONT_PX);

  useLayoutEffect(() => {
    if (!narrow) {
      setTransientLayout(null);
      return;
    }
    const canvas = canvasRef.current;
    const actions = actionsRef.current;
    if (!canvas || !actions) return;
    // The pill lives in the layout but publishes `data-chat-pill`; its fixed box is measured, so a
    // different `bottom-*` utility or a 20 px root font size moves the reserve with it.
    const pill = chatPillVisible ? document.querySelector<HTMLElement>("[data-chat-pill]") : null;
    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();
      // jsdom and a detached canvas report no box: stay in the full stack rather than guess.
      if (canvasRect.height <= 0) {
        setTransientLayout(null);
        return;
      }
      const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      setRootFontPx(Number.isFinite(root) && root > 0 ? root : BASE_ROOT_FONT_PX);

      const topLimit = actions.getBoundingClientRect().bottom - canvasRect.top + TRANSIENT_STACK_GAP_PX;
      const base = canvasRect.height - TRANSIENT_PANEL_MARGIN_PX;
      const pillRect = pill?.getBoundingClientRect();
      if (!pillRect || pillRect.height <= 0) {
        setTransientLayout({ placement: "none", reserve: 0, band: Math.max(0, Math.floor(base - topLimit)) });
        return;
      }
      const pillTop = pillRect.top - canvasRect.top;
      const pillBottom = pillRect.bottom - canvasRect.top;
      // Two placements fit a bottom-anchored stack: lifted above the pill, or resting under it with
      // its height capped at the pill's bottom edge. Take the roomier one - a 230 px canvas with a
      // 12 px slit between the actions and the pill still has ~98 px below the pill for the notice.
      const above = Math.floor(pillTop - TRANSIENT_PILL_GAP_PX - topLimit);
      const below = Math.floor(base - Math.max(topLimit, pillBottom + TRANSIENT_PILL_GAP_PX));
      if (above > 0 && above >= below) {
        setTransientLayout({
          placement: "above",
          reserve: Math.ceil(canvasRect.bottom - pillRect.top + TRANSIENT_PILL_GAP_PX),
          band: above,
        });
        return;
      }
      if (below > 0) {
        setTransientLayout({ placement: "below", reserve: 0, band: below });
        return;
      }
      setTransientLayout({ placement: "above", reserve: Math.ceil(canvasRect.bottom - pillRect.top + TRANSIENT_PILL_GAP_PX), band: 0 });
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
    observer?.observe(canvas);
    observer?.observe(actions);
    if (pill) observer?.observe(pill);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [narrow, chatPillVisible]);
  const transientBandPx = transientLayout?.band ?? null;
  const compactTransient =
    narrow && transientBandPx !== null && transientBandPx < TRANSIENT_FULL_STACK_REM * rootFontPx;

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

  useEffect(() => {
    const drawer = document.querySelector<HTMLElement>("[data-chat-drawer]");
    if (!drawer) return;
    const sync = () => setChatOpen(drawer.hasAttribute("data-open"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(drawer, { attributes: true, attributeFilter: ["data-open"] });
    return () => observer.disconnect();
  }, []);

  // The chat state the viewport was last fitted for: a re-run (StrictMode, a new `flow` identity)
  // must not move it twice. Mount counts as closed.
  const fittedChatOpen = useRef(false);
  /** The viewport the drawer covered; closing restores exactly this instead of re-fitting. */
  const preChatViewport = useRef<Viewport | null>(null);
  /** A drawer already open on mount was never seen closed, so it has no viewport to go back to. */
  const sawChatClosed = useRef(false);
  useEffect(() => {
    if (!flow) return;
    if (!chatOpen) sawChatClosed.current = true;
    // The initial-view effect above fits at 80 ms; fitting later keeps that full-canvas fit from
    // winning when the page is entered with the drawer already open (chat open, then navigate here).
    const timer = setTimeout(() => {
      if (fittedChatOpen.current === chatOpen) return;
      fittedChatOpen.current = chatOpen;
      if (chatOpen) {
        // The drawer is a fixed overlay over a full-width canvas, so only the uncovered strip is
        // visible; fit into it instead of centring the graph behind the panel.
        const drawer = document.querySelector<HTMLElement>("[data-chat-drawer]");
        const padding = chatFitPadding(canvasRef.current?.clientWidth ?? 0, drawer?.offsetWidth ?? 0);
        // A drawer that leaves no strip (a phone's full-width sheet) changes nothing, so it has
        // nothing to restore on close, and closing must not move the viewport either.
        if (!padding || !sawChatClosed.current) return;
        preChatViewport.current = flow.getViewport();
        flow.fitView({ padding, duration: 300, minZoom: 0.25, maxZoom: 1.2 });
        return;
      }
      // Closing returns to the viewport the drawer covered. Re-fitting the graph instead would
      // throw away the user's own pan and zoom, and on a phone it shrank the 0.8 placement into a
      // whole-graph fit at ~0.33 as soon as the drawer had been opened once.
      const saved = preChatViewport.current;
      preChatViewport.current = null;
      if (saved) flow.setViewport(saved, { duration: 300 });
    }, 120);
    return () => clearTimeout(timer);
  }, [flow, chatOpen]);

  function fitOverview() {
    flow?.fitView({ padding: 0.1, duration: 300, minZoom: 0.25, maxZoom: 1.2 });
  }

  useEffect(() => {
    if (!flow || !agentUpdate?.at) return;
    const timer = setTimeout(() => {
      flow.fitView({ padding: 0.18, duration: 300, minZoom: 0.4, maxZoom: 1.2 });
    }, 80);
    return () => clearTimeout(timer);
  }, [flow, agentUpdate?.at]);

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
    const removals = changes.filter((change) => change.type === "remove");
    onNodesChange(removals.length > 0 ? changes.filter((change) => change.type !== "remove") : changes);
    for (const removal of removals) onDeleteNode(removal.id);
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

  function handleNodeClick(event: React.MouseEvent, node: PlatformFlowNode) {
    // A handle is a connection affordance, not a selection: tapping it on a phone must start
    // the connection instead of opening the inspector over the canvas.
    if (event.target instanceof Element && event.target.closest(".react-flow__handle")) return;
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
      <div
        ref={canvasRef}
        className={`${className ?? "h-full"} relative overflow-hidden bg-ink${narrow ? ` ${NARROW_HANDLE_TARGET}` : ""}`}
        data-testid="workflow-canvas"
        data-canvas-layout={narrow ? "narrow" : "wide"}
      >
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
          {...(narrow ? { connectOnClick: true, connectionRadius: TOUCH_CONNECTION_RADIUS } : {})}
        >
          <Background gap={18} color="var(--color-line)" />
          <Panel position="top-left">
            <div
              ref={actionsRef}
              className={narrow ? "flex max-w-[calc(100vw-2rem)] items-center gap-1.5" : "flex items-center gap-2"}
              data-canvas-overlay="actions"
            >
              <button
                type="button"
                className={`rounded-lg border border-line bg-well/90 ${narrow ? "px-2.5 py-1.5" : "px-3 py-2"} text-xs font-medium text-slate-200 shadow-lg transition hover:border-accent ${focusRing}`}
                onClick={onOpenPalette}
              >
                + Nodo
              </button>
              <button
                type="button"
                className={`rounded-lg border border-line bg-well/90 ${narrow ? "px-2.5 py-1.5" : "px-3 py-2"} text-xs font-medium text-slate-200 shadow-lg transition hover:border-accent ${focusRing}`}
                onClick={fitOverview}
                aria-label="Ajustar vista del flujo"
              >
                Ajustar vista
              </button>
              {!narrow && (
                <>
                  <ZoomReadout />
                  <ShortcutsHelp />
                </>
              )}
            </div>
          </Panel>
          {narrow ? (
            (connecting || runProgress || agentStatus?.busy) && (
              <Panel
                position="bottom-center"
                className="pointer-events-none"
                style={
                  chatPillVisible && transientLayout && transientLayout.reserve > 0
                    ? { marginBottom: transientLayout.reserve }
                    : undefined
                }
              >
                <TransientStack
                  connecting={connecting}
                  agentStatus={agentStatus}
                  runProgress={runProgress}
                  compact={compactTransient}
                  maxHeight={transientBandPx ?? undefined}
                  placement={transientLayout?.placement}
                  pillReserve={transientLayout && transientLayout.reserve > 0 ? transientLayout.reserve : undefined}
                  onCancelConnect={onCancelConnect}
                  onOpenChat={onOpenChat}
                  onOpenRuns={onOpenRuns}
                />
              </Panel>
            )
          ) : (
            <>
              {connecting && (
                <Panel position="top-center" data-canvas-overlay="connect">
                  <ConnectBanner connecting={connecting} narrow={false} onCancel={onCancelConnect} />
                </Panel>
              )}
              {(runProgress || agentStatus?.busy || agentUpdate) && (
                <Panel position="top-right">
                  <div className="flex flex-col gap-2" data-canvas-overlay="status">
                    {agentUpdate && (
                      <AgentFlowUpdateNotice
                        summary={agentUpdate.summary}
                        onDismiss={onDismissAgentUpdate}
                        onOpenChat={onOpenChat}
                      />
                    )}
                    {agentStatus?.busy && (
                      <AgentProgressChip activity={agentStatus.activity} narrow={false} onOpenChat={onOpenChat} />
                    )}
                    {runProgress && <RunProgressChip runProgress={runProgress} narrow={false} onOpenRuns={onOpenRuns} />}
                  </div>
                </Panel>
              )}
            </>
          )}
          <Controls />
          {!narrow && (
            <MiniMap
              pannable
              zoomable
              style={{ background: "var(--color-well)", width: 140, height: 100 }}
              maskColor="rgba(7, 11, 20, 0.72)"
              nodeColor={(node) => NODE_META[(node.data as PlatformFlowNode["data"])?.nodeType]?.color ?? "var(--color-line-strong)"}
              nodeStrokeColor={() => "var(--color-muted)"}
            />
          )}
        </ReactFlow>
      </div>
    </CanvasActionsContext.Provider>
  );
}
