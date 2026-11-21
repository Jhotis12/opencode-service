import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { defaultNodeConfig, type NodeSpec } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { NodePaletteModal } from "../components/NodePaletteModal.tsx";
import { NodeInspectorModal } from "../components/NodeInspectorModal.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { GraphIssuesSummary } from "../components/GraphIssuesSummary.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { WorkflowCanvas, PHONE_QUERY } from "../components/WorkflowCanvas.tsx";
import {
  changeEdgeCondition as changeEdgeConditionInGraph,
  connectNodes as connectNodesGraph,
  getConnectionIssue,
} from "../components/canvas/graph-edits.ts";
import { NODE_META } from "../components/nodes/node-catalog.ts";
import { projectTabPath } from "../components/ProjectTopBar.tsx";
import { notifyError, notifySuccess } from "../components/Toast.tsx";
import { useMediaQuery } from "../useMediaQuery.ts";
import { useProjectWorkspace } from "./project-workspace.tsx";

const DEFAULT_CODE = `export default async function run(input: unknown, ctx: any) {
  ctx.log("nodo ejecutado", { input });
  return { ok: true, input };
}
`;

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_META).map(([type, meta]) => [type, meta.title]),
);

export function ProjectFlowPage() {
  const workspace = useProjectWorkspace();
  const { slug, graph, runs } = workspace;
  // ProjectLayout owns the fixed chat pill and tells the page whether it is on screen.
  const layout = useOutletContext<{ chatPillVisible?: boolean } | null>();
  const queryClient = useQueryClient();
  // Below 640 px the palette and the inspector open as full-height sheets instead of dialogs.
  const narrow = useMediaQuery(PHONE_QUERY);

  const [selectedId, setSelectedId] = useState<string>();
  const [nodeCode, setNodeCode] = useState("");
  const [nodeCodeDirty, setNodeCodeDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorInitialTab, setInspectorInitialTab] = useState<"settings" | "connections" | "execution">("settings");
  const [connecting, setConnecting] = useState<{ sourceId: string; condition?: "true" | "false" }>();
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [dismissedIssueSignature, setDismissedIssueSignature] = useState("");

  const issueSignature = workspace.graphIssues.map((issue) => issue.id).join("|");
  const pendingDeleteNodes = useMemo(
    () => (graph?.nodes ?? []).filter((node) => pendingDeleteIds.includes(node.id)),
    [graph, pendingDeleteIds],
  );

  const selected = useMemo(() => graph?.nodes.find((node) => node.id === selectedId), [graph, selectedId]);
  const lastStep = useMemo(
    () => runs[0]?.steps.find((step) => step.nodeId === selectedId),
    [runs, selectedId],
  );
  // Shared cache contract: ProjectKnowledgePanel, ProjectOverviewPage and
  // AgentEditorModal store the unwrapped NotebookSummary[] under this same key, so
  // this consumer must unwrap the envelope too or it feeds the inspector an object.
  const notebooksQuery = useQuery({
    queryKey: qk.notebooks(slug),
    queryFn: () => api.listNotebooks(slug).then((result) => result.data),
  });

  const nodeFile = selected?.codeFile;
  const nodeCodeQuery = useQuery({
    queryKey: ["node", slug, nodeFile],
    queryFn: () => api.readNode(slug, nodeFile!).then((result) => result.code),
    enabled: Boolean(slug && nodeFile),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (nodeCodeQuery.data !== undefined) {
      setNodeCode(nodeCodeQuery.data);
      setNodeCodeDirty(false);
    }
  }, [nodeCodeQuery.data]);

  const nodeStatuses = useMemo(() => {
    const statuses: Record<string, string> = {};
    for (const step of runs[0]?.steps ?? []) statuses[step.nodeId] = step.status;
    return statuses;
  }, [runs]);

  const runProgress = useMemo(() => {
    const latest = runs[0];
    if (!latest || (latest.status !== "running" && latest.status !== "paused")) return undefined;
    const current = workspace.runningNodeId ? graph?.nodes.find((node) => node.id === workspace.runningNodeId) : undefined;
    return {
      status: latest.status,
      currentNodeLabel: current?.label ?? current?.id,
      completedSteps: latest.steps.filter((step) => step.status === "succeeded").length,
      runId: latest.id,
    };
  }, [runs, workspace.runningNodeId, graph]);

  useEffect(() => {
    if (!graph || !selectedId) return;
    if (graph.nodes.some((node) => node.id === selectedId)) return;
    setSelectedId(undefined);
    setInspectorOpen(false);
    setConnecting(undefined);
  }, [graph, selectedId]);

  const saveNode = useMutation({
    mutationFn: ({ file, code }: { file: string; code: string }) => api.writeNode(slug, file, code),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(["node", slug, variables.file], variables.code);
      setNodeCodeDirty(false);
      notifySuccess("Nodo guardado");
      workspace.setError(undefined);
    },
    onError: (cause) => notifyError(cause instanceof Error ? cause.message : "No se pudo guardar el nodo"),
  });

  function updateNode(patch: Partial<NodeSpec>) {
    if (!graph || !selectedId) return;
    workspace.changeGraph({ ...graph, nodes: graph.nodes.map((node) => (node.id === selectedId ? { ...node, ...patch } : node)) });
  }

  function updateConfig(patch: Record<string, unknown>) {
    if (!selected) return;
    updateNode({ config: { ...selected.config, ...patch } });
  }

  function replaceConfig(config: Record<string, unknown>) {
    if (!selected) return;
    updateNode({ config });
  }

  async function enableDecisionCode() {
    if (!selected || !slug) return;
    const file = selected.codeFile ?? `nodes/${selected.id}.ts`;
    if (!selected.codeFile) {
      await api.writeNode(
        slug,
        file,
        `export default async function decide(input: unknown) {\n  return Boolean((input as { ok?: boolean })?.ok);\n}\n`,
      );
    }
    updateNode({ codeFile: file, config: { ...selected.config, mode: "code" } });
  }

  function openInspector(nodeId: string, initialTab: "settings" | "connections" | "execution" = "settings") {
    setSelectedId(nodeId);
    setInspectorInitialTab(initialTab);
    setInspectorOpen(true);
  }

  function closeInspector() {
    setInspectorOpen(false);
    setSelectedId(undefined);
    setInspectorInitialTab("settings");
  }

  async function addNode(type: NodeSpec["type"]) {
    if (!graph || !slug) return;
    if (type === "trigger" && graph.nodes.some((node) => node.type === "trigger")) {
      workspace.setError("Este flujo ya tiene un trigger. Cámbialo o edítalo en lugar de agregar otro.");
      return;
    }
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`;
    const position = selected
      ? { x: selected.position.x + 280, y: selected.position.y + 20 }
      : { x: 80 + graph.nodes.length * 40, y: 80 + (graph.nodes.length % 3) * 120 };
    const node: NodeSpec = {
      id,
      type,
      label: NODE_LABELS[type],
      position,
      config: defaultNodeConfig(type),
      notebookIds: [],
      timeoutMs: type === "transcribe" ? 120_000 : 30_000,
      retryPolicy: { maxRetries: 0 },
    };
    try {
      if (type === "code") {
        node.codeFile = `nodes/${id}.ts`;
        await api.writeNode(slug, node.codeFile, DEFAULT_CODE);
        queryClient.setQueryData(["node", slug, node.codeFile], DEFAULT_CODE);
      }
      if (type === "agent") {
        const candidate = workspace.agents.find((agent) => agent.frontmatter.mode !== "primary") ?? workspace.agents[0];
        node.agentId = candidate ? `${candidate.category}/${candidate.role}` : "principal/agente";
      }
      workspace.changeGraph({ ...graph, nodes: [...graph.nodes, node] });
      setPaletteOpen(false);
      openInspector(id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "No se pudo agregar el nodo");
    }
  }

  async function duplicateNode(nodeId: string) {
    if (!graph || !slug) return;
    const source = graph.nodes.find((node) => node.id === nodeId);
    if (!source) return;
    if (source.type === "trigger") {
      workspace.setError("Solo puede existir un trigger. No se puede duplicar.");
      return;
    }
    const id = `${source.type}-${crypto.randomUUID().slice(0, 6)}`;
    let codeFile = source.codeFile;
    try {
      if (source.codeFile) {
        const nextFile = `nodes/${id}.ts`;
        const { code } = await api.readNode(slug, source.codeFile);
        await api.writeNode(slug, nextFile, code);
        queryClient.setQueryData(["node", slug, nextFile], code);
        codeFile = nextFile;
      }
      const clone: NodeSpec = {
        ...source,
        id,
        label: `Copia de ${source.label ?? source.id}`,
        position: { x: source.position.x + 36, y: source.position.y + 36 },
        config: structuredClone(source.config),
        notebookIds: [...source.notebookIds],
        retryPolicy: { ...source.retryPolicy },
        ...(codeFile ? { codeFile } : {}),
      };
      workspace.changeGraph({ ...graph, nodes: [...graph.nodes, clone] });
      openInspector(clone.id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "No se pudo duplicar el nodo");
    }
  }

  function removeNodes(nodeIds: string[]) {
    if (!graph || nodeIds.length === 0) return;
    const removing = new Set(nodeIds);
    workspace.changeGraph({
      ...graph,
      nodes: graph.nodes.filter((node) => !removing.has(node.id)),
      edges: graph.edges.filter((edge) => !removing.has(edge.source) && !removing.has(edge.target)),
    });
    if (selectedId && removing.has(selectedId)) closeInspector();
    if (connecting && removing.has(connecting.sourceId)) setConnecting(undefined);
  }

  function requestDeleteNodes(nodeIds: string[]) {
    if (nodeIds.length === 0) return;
    setPendingDeleteIds((current) => [...new Set([...current, ...nodeIds])]);
  }

  function confirmDeleteNodes() {
    removeNodes(pendingDeleteIds);
    setPendingDeleteIds([]);
  }

  function connect(sourceId: string, targetId: string, condition?: "true" | "false") {
    if (!graph) return;
    const issue = getConnectionIssue(graph, sourceId, targetId, condition);
    if (issue) {
      workspace.setError(issue);
      return;
    }
    workspace.changeGraph(connectNodesGraph(graph, sourceId, targetId, condition));
    setConnecting(undefined);
    workspace.setError(undefined);
    notifySuccess("Conexión agregada");
  }

  function startCanvasConnect(sourceId: string, condition?: "true" | "false") {
    if (!graph) return;
    const source = graph.nodes.find((node) => node.id === sourceId);
    if (!source) return;
    if (source.type === "decision" && !condition) {
      openInspector(sourceId, "connections");
      return;
    }
    setConnecting({ sourceId, condition });
    setInspectorOpen(false);
    setPaletteOpen(false);
    workspace.setError(undefined);
  }

  function handleStartConnect(nodeId: string) {
    if (!graph) return;
    const source = graph.nodes.find((node) => node.id === nodeId);
    if (source?.type === "decision") {
      openInspector(nodeId, "connections");
      return;
    }
    startCanvasConnect(nodeId);
  }

  function deleteEdge(edgeId: string) {
    if (!graph) return;
    workspace.changeGraph({ ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) });
  }

  function changeEdgeCondition(edgeId: string, condition: "true" | "false") {
    if (!graph) return;
    const result = changeEdgeConditionInGraph(graph, edgeId, condition);
    if (result.issue) {
      workspace.setError(result.issue);
      return;
    }
    workspace.changeGraph(result.graph);
    workspace.setError(undefined);
  }

  if (!graph) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pb-4 pt-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <PageHeader
            title="Flujo"
            description="Diseña el recorrido sobre el canvas: nodos, conexiones y ejecución en vivo. Los cambios forman parte del borrador hasta que guardes el flujo."
          />
        </div>
      </div>
      {workspace.graphIssues.length > 0 && dismissedIssueSignature !== issueSignature && (
        <GraphIssuesSummary
          issues={workspace.graphIssues}
          onDismiss={() => setDismissedIssueSignature(issueSignature)}
        />
      )}
      <div className="relative min-h-0 flex-1">
        <WorkflowCanvas
          graph={graph}
          selectedId={selectedId}
          runningNodeId={workspace.runningNodeId}
          nodeStatuses={nodeStatuses}
          runProgress={runProgress}
          agentStatus={workspace.chatBusy ? { busy: true, activity: workspace.chatActivity } : undefined}
          chatPillVisible={layout?.chatPillVisible ?? false}
          agentTouchedNodeIds={workspace.agentTouchedNodeIds}
          issues={workspace.graphIssues}
          connecting={connecting}
          className="h-full"
          onSelect={(nodeId) => openInspector(nodeId)}
          onChange={workspace.changeGraph}
          onConnect={connect}
          onConnectRejected={workspace.setError}
          onStartConnect={handleStartConnect}
          onCancelConnect={() => setConnecting(undefined)}
          onDuplicateNode={(nodeId) => void duplicateNode(nodeId)}
          onDeleteNode={(nodeId) => requestDeleteNodes([nodeId])}
          onDeleteEdge={deleteEdge}
          onChangeEdgeCondition={changeEdgeCondition}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenRuns={() => workspace.requestNavigate(projectTabPath(slug, "runs"))}
          onOpenChat={() => {
            workspace.setChatOpen(true);
            workspace.setChatUnread(false);
          }}
        />
      </div>
      {paletteOpen && (
        <NodePaletteModal
          graph={graph}
          sheet={narrow}
          onClose={() => setPaletteOpen(false)}
          onAdd={(type) => void addNode(type)}
        />
      )}
      {selected && inspectorOpen && (
        <NodeInspectorModal
          key={`${selected.id}-${inspectorInitialTab}`}
          node={selected}
          graph={graph}
          agents={workspace.agents}
          models={workspace.models}
          notebooks={notebooksQuery.data ?? []}
          integrations={workspace.integrations}
          destinations={workspace.destinations}
          lastStep={lastStep}
          scheduleNextRun={workspace.schedules.find((state) => state.nodeId === selected.id)?.nextWindowAt}
          code={nodeCode}
          codeDirty={nodeCodeDirty}
          issues={workspace.graphIssues}
          initialTab={inspectorInitialTab}
          sheet={narrow}
          onClose={closeInspector}
          onPatch={updateNode}
          onConfig={updateConfig}
          onReplaceConfig={replaceConfig}
          onRemove={() => requestDeleteNodes([selected.id])}
          onDuplicate={() => void duplicateNode(selected.id)}
          onConnect={connect}
          onStartCanvasConnect={startCanvasConnect}
          onChangeEdgeCondition={changeEdgeCondition}
          onDeleteEdge={deleteEdge}
          onCodeChange={(value) => {
            setNodeCode(value);
            setNodeCodeDirty(true);
          }}
          onSaveCode={() => selected.codeFile && saveNode.mutate({ file: selected.codeFile, code: nodeCode })}
          onEnableDecisionCode={() => void enableDecisionCode()}
        />
      )}
      {pendingDeleteNodes.length > 0 && (
        <ConfirmDialog
          title={pendingDeleteNodes.length === 1 ? "Eliminar nodo" : "Eliminar nodos"}
          confirmLabel={pendingDeleteNodes.length === 1 ? "Eliminar nodo" : `Eliminar ${pendingDeleteNodes.length} nodos`}
          onCancel={() => setPendingDeleteIds([])}
          onConfirm={confirmDeleteNodes}
        >
          <p className="text-sm text-muted">
            {pendingDeleteNodes.length === 1
              ? `Se eliminará «${pendingDeleteNodes[0]!.label ?? pendingDeleteNodes[0]!.id}» y sus conexiones.`
              : `Se eliminarán ${pendingDeleteNodes.length} nodos y sus conexiones.`}{" "}
            El cambio forma parte del borrador hasta que guardes el flujo.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
