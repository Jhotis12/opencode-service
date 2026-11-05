import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatTurnEvent, NodeSpec, WorkflowGraph } from "@platform/shared";
import { api, ApiClientError, type RunRecord } from "../api.ts";
import { qk } from "../query.ts";
import { AgentCatalog } from "../components/AgentCatalog.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { WorkflowCanvas } from "../components/WorkflowCanvas.tsx";
import { ProjectTopBar, type ProjectTab } from "../components/ProjectTopBar.tsx";
import { NodePaletteModal } from "../components/NodePaletteModal.tsx";
import { NodeInspectorModal } from "../components/NodeInspectorModal.tsx";
import {
  changeEdgeCondition as changeEdgeConditionInGraph,
  connectNodes as connectNodesGraph,
  getConnectionIssue,
  getGraphIssues,
  mapServerIssue,
  type GraphIssue,
} from "../components/canvas/graph-edits.ts";
import { RunDetailModal, previewValue } from "../components/RunDetailModal.tsx";
import { RunLaunchModal } from "../components/RunLaunchModal.tsx";
import { ProjectKnowledgePanel } from "../components/ProjectKnowledgePanel.tsx";
import { ProjectConfigurationPanel } from "../components/ProjectConfigurationPanel.tsx";
import { NODE_META } from "../components/nodes/node-catalog.ts";
import { badge, buttonDanger, buttonGhost, buttonPrimary, card } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

const DEFAULT_CODE = `export default async function run(input: unknown, ctx: any) {
  ctx.log("nodo ejecutado", { input });
  return { ok: true, input };
}
`;

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_META).map(([type, meta]) => [type, meta.title]),
);

export function ProjectPage() {
  const { slug = "" } = useParams();
  const queryClient = useQueryClient();

  const workflowQuery = useQuery({ queryKey: qk.workflow(slug), queryFn: () => api.getWorkflow(slug), enabled: Boolean(slug) });
  const schedulesQuery = useQuery({
    queryKey: qk.schedules(slug),
    queryFn: () => api.listSchedules(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const runsQuery = useQuery({
    queryKey: qk.runs(slug),
    queryFn: () => api.listRuns(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const agentsQuery = useQuery({
    queryKey: qk.agents(slug),
    queryFn: () => api.listAgents(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const modelsQuery = useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((result) => result.data),
    staleTime: 5 * 60_000,
  });
  const chatQuery = useQuery({
    queryKey: qk.chat(slug),
    queryFn: () => api.chatHistory(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const integrationsQuery = useQuery({
    queryKey: qk.integrations(slug),
    queryFn: () => api.listIntegrations(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const settingsQuery = useQuery({
    queryKey: qk.projectSettings(slug),
    queryFn: () => api.getProjectSettings(slug),
    enabled: Boolean(slug),
  });
  const destinationsQuery = useQuery({
    queryKey: qk.destinations(slug),
    queryFn: () => api.listDestinations(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const versionsQuery = useQuery({
    queryKey: qk.workflowVersions(slug),
    queryFn: () =>
      typeof api.listWorkflowVersions === "function"
        ? api.listWorkflowVersions(slug).then((result) => result.data)
        : Promise.resolve([]),
    enabled: Boolean(slug),
  });

  const runs = runsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const chatHistory = chatQuery.data ?? [];
  const integrations = integrationsQuery.data ?? [];
  const destinations = destinationsQuery.data ?? [];
  const projectSettings = settingsQuery.data;
  const versions = versionsQuery.data ?? [];

  const [graph, setGraph] = useState<WorkflowGraph>();
  useDocumentTitle(graph?.name ?? "Proyecto");
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [nodeCode, setNodeCode] = useState("");
  const [nodeCodeDirty, setNodeCodeDirty] = useState(false);
  const [runningNodeId, setRunningNodeId] = useState<string>();
  const [detailRun, setDetailRun] = useState<RunRecord>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<ProjectTab>("canvas");
  const [launchOpen, setLaunchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorInitialTab, setInspectorInitialTab] = useState<"settings" | "connections" | "execution">("settings");
  const [connecting, setConnecting] = useState<{ sourceId: string; condition?: "true" | "false" }>();
  const [saveIssues, setSaveIssues] = useState<GraphIssue[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatActivity, setChatActivity] = useState<string>();
  const [chatUnread, setChatUnread] = useState(false);
  const [agentTouchedNodeIds, setAgentTouchedNodeIds] = useState<string[]>([]);
  const chatOpenRef = useRef(false);
  const chatBusyRef = useRef(false);
  const graphRef = useRef<WorkflowGraph | undefined>(undefined);
  const agentTouchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  chatOpenRef.current = chatOpen;
  chatBusyRef.current = chatBusy;
  graphRef.current = graph;

  useEffect(() => {
    if (workflowQuery.data) {
      setGraph(workflowQuery.data);
      setDirty(false);
    }
  }, [workflowQuery.data]);

  useEffect(() => {
    if (!graph || !selectedId) return;
    if (graph.nodes.some((node) => node.id === selectedId)) return;
    setSelectedId(undefined);
    setInspectorOpen(false);
    setConnecting(undefined);
  }, [graph, selectedId]);

  useEffect(() => () => clearTimeout(agentTouchTimer.current), []);

  const selected = useMemo(() => graph?.nodes.find((node) => node.id === selectedId), [graph, selectedId]);
  const graphIssues = useMemo(() => (graph ? getGraphIssues(graph) : []), [graph]);
  const lastStep = useMemo(
    () => runs[0]?.steps.find((step) => step.nodeId === selectedId),
    [runs, selectedId],
  );
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
    const current = runningNodeId ? graph?.nodes.find((node) => node.id === runningNodeId) : undefined;
    return {
      status: latest.status,
      currentNodeLabel: current?.label ?? current?.id,
      completedSteps: latest.steps.filter((step) => step.status === "succeeded").length,
      runId: latest.id,
    };
  }, [runs, runningNodeId, graph]);

  useEffect(() => {
    if (!detailRun) return;
    const updated = runs.find((run) => run.id === detailRun.id);
    if (updated && updated !== detailRun) setDetailRun(updated);
  }, [runs, detailRun]);

  useEffect(() => {
    if (!slug) return;
    const source = new EventSource("/api/events");
    source.addEventListener("workflow.updated", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { projectSlug: string; graph: WorkflowGraph };
      if (data.projectSlug === slug) {
        if (chatBusyRef.current) markAgentChanges(data.graph);
        queryClient.setQueryData(qk.workflow(slug), data.graph);
        setGraph(data.graph);
        setDirty(false);
      }
    });
    source.addEventListener("run.updated", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        projectSlug: string;
        nodeId?: string;
        status: string;
        stepStatus?: string;
      };
      if (data.projectSlug !== slug) return;
      if (data.nodeId) {
        setRunningNodeId(data.stepStatus === "running" ? data.nodeId : undefined);
      } else {
        setRunningNodeId(undefined);
      }
      if (data.status === "succeeded") {
        setStatus("Ejecución completada. El detalle está en Ejecuciones.");
      } else if (["failed", "timed_out", "cancelled"].includes(data.status)) {
        setStatus("La ejecución terminó con error. El detalle está en Ejecuciones.");
      } else if (data.status === "paused") {
        setStatus("Ejecución pausada. Revisa Ejecuciones para el detalle.");
      }
      void queryClient.invalidateQueries({ queryKey: qk.runs(slug) });
    });
    source.addEventListener("chat.turn.updated", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        projectSlug?: string;
        status: string;
      };
      if (data.projectSlug !== slug) return;
      if (["succeeded", "failed", "timed_out", "cancelled", "unknown"].includes(data.status)) {
        void queryClient.invalidateQueries({ queryKey: qk.chat(slug) });
        if (!chatOpenRef.current) setChatUnread(true);
      }
    });
    return () => source.close();
  }, [slug, queryClient]);

  const saveWorkflow = useMutation({
    mutationFn: (next: WorkflowGraph) => api.saveWorkflow(slug, next),
    onSuccess: (saved) => {
      queryClient.setQueryData(qk.workflow(slug), saved);
      void queryClient.invalidateQueries({ queryKey: qk.workflowVersions(slug) });
      setGraph(saved);
      setDirty(false);
      setSaveIssues([]);
      setStatus("Flujo guardado");
      setError(undefined);
    },
    onError: (cause) => {
      if (graph && cause instanceof ApiClientError && cause.code === "INVALID_WORKFLOW") {
        const messages =
          cause.issues ??
          cause.message
            .replace(/^invalid workflow:\s*/, "")
            .split(";")
            .map((item) => item.trim())
            .filter(Boolean);
        setSaveIssues(
          messages.map((message) => ({
            id: message,
            severity: "error",
            ...mapServerIssue(graph, message),
          })),
        );
        setError(undefined);
      } else {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar");
      }
      setStatus(undefined);
    },
  });

  const runWorkflow = useMutation({
    mutationFn: (payload: unknown) => api.runWorkflow(slug, payload),
    onSuccess: async (run) => {
      setLaunchOpen(false);
      await queryClient.invalidateQueries({ queryKey: qk.runs(slug) });
      setStatus(
        run.status === "paused"
          ? "Ejecución pausada. Revisa Ejecuciones para el detalle."
          : "Ejecución iniciada. El recorrido se muestra en el canvas.",
      );
      setError(undefined);
    },
    onError: (cause) => {
      setError(cause instanceof Error ? cause.message : "No se pudo ejecutar");
      setStatus(undefined);
    },
  });

  const replayRun = useMutation({
    mutationFn: ({ id, fromNodeId }: { id: string; fromNodeId?: string }) => api.replayRun(id, fromNodeId),
    onSuccess: async (replayed) => {
      await queryClient.invalidateQueries({ queryKey: qk.runs(slug) });
      setDetailRun(replayed);
      setStatus(`Ejecución ${replayed.id.slice(0, 8)} re-ejecutada`);
      setError(undefined);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo re-ejecutar"),
  });

  const saveNode = useMutation({
    mutationFn: ({ file, code }: { file: string; code: string }) => api.writeNode(slug, file, code),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(["node", slug, variables.file], variables.code);
      setNodeCodeDirty(false);
      setStatus("Nodo guardado");
      setError(undefined);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el nodo"),
  });

  const rollbackVersion = useMutation({
    mutationFn: (version: number) => api.rollbackWorkflowVersion(slug, version),
    onSuccess: async (result, version) => {
      queryClient.setQueryData(qk.workflow(slug), result.graph);
      await queryClient.invalidateQueries({ queryKey: qk.workflowVersions(slug) });
      setGraph(result.graph);
      setDirty(false);
      setStatus(`Flujo restaurado a v${version}`);
      setError(undefined);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo restaurar la versión"),
  });

  const chat = useMutation({
    mutationFn: ({ message, onEvent }: { message: string; onEvent?: (event: ChatTurnEvent) => void }) =>
      api.chat(slug, message, onEvent),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.chat(slug) });
      if (!chatOpenRef.current) setChatUnread(true);
    },
  });

  const modelOptions = useMemo(() => models.map((model) => `${model.providerID}/${model.modelID}`), [models]);

  function changeGraph(next: WorkflowGraph) {
    setGraph(next);
    setDirty(true);
  }

  function markAgentChanges(next: WorkflowGraph) {
    const previous = graphRef.current;
    if (!previous) return;
    const added = next.nodes.filter((node) => !previous.nodes.some((item) => item.id === node.id));
    const changed = next.nodes.filter((node) => {
      const old = previous.nodes.find((item) => item.id === node.id);
      return Boolean(old && JSON.stringify(old) !== JSON.stringify(node));
    });
    const touched = [...added, ...changed].map((node) => node.id);
    if (touched.length > 0) {
      const names = [...added, ...changed]
        .map((node) => node.label ?? node.id)
        .slice(0, 3)
        .join(", ");
      setChatActivity(
        added.length > 0
          ? `Flujo actualizado: +${added.length} nodo${added.length === 1 ? "" : "s"}${names ? ` (${names})` : ""}`
          : `Nodo actualizado: ${names}`,
      );
      setAgentTouchedNodeIds(touched);
      clearTimeout(agentTouchTimer.current);
      agentTouchTimer.current = setTimeout(() => setAgentTouchedNodeIds([]), 4500);
    } else if (JSON.stringify(previous.edges) !== JSON.stringify(next.edges)) {
      setChatActivity("Conexiones del flujo actualizadas");
    }
  }

  function updateNode(patch: Partial<NodeSpec>) {
    if (!graph || !selectedId) return;
    changeGraph({ ...graph, nodes: graph.nodes.map((node) => (node.id === selectedId ? { ...node, ...patch } : node)) });
  }

  function updateConfig(patch: Record<string, unknown>) {
    if (!selected) return;
    updateNode({ config: { ...selected.config, ...patch } });
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
      setError("Este flujo ya tiene un trigger. Cámbialo o edítalo en lugar de agregar otro.");
      return;
    }
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`;
    const defaults: Record<string, Record<string, unknown>> = {
      trigger: { kind: "manual", inputSchema: { fields: [] } },
      http: { method: "GET", url: "https://api.example.com", headers: "{}", body: "" },
      delay: { ms: 1000 },
      transform: { template: '{"result":"{{input}}"}' },
      validate: { rules: [{ name: "tema", type: "string", required: true, message: "Falta el campo tema." }] },
      decision: { mode: "condition", condition: { field: "status", operator: "equals", value: "ok" } },
      approval: { message: "Revisar antes de continuar", autoApprove: false },
      agent: { instruction: "" },
      transcribe: { mediaPath: "attachments" },
      code: {},
    };
    const position = selected
      ? { x: selected.position.x + 280, y: selected.position.y + 20 }
      : { x: 80 + graph.nodes.length * 40, y: 80 + (graph.nodes.length % 3) * 120 };
    const node: NodeSpec = {
      id,
      type,
      label: NODE_LABELS[type],
      position,
      config: defaults[type] ?? {},
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
        const candidate = agents.find((agent) => agent.frontmatter.mode !== "primary") ?? agents[0];
        node.agentId = candidate ? `${candidate.category}/${candidate.role}` : "principal/agente";
      }
      changeGraph({ ...graph, nodes: [...graph.nodes, node] });
      setPaletteOpen(false);
      openInspector(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar el nodo");
    }
  }

  async function duplicateNode(nodeId: string) {
    if (!graph || !slug) return;
    const source = graph.nodes.find((node) => node.id === nodeId);
    if (!source) return;
    if (source.type === "trigger") {
      setError("Solo puede existir un trigger. No se puede duplicar.");
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
      changeGraph({ ...graph, nodes: [...graph.nodes, clone] });
      openInspector(clone.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo duplicar el nodo");
    }
  }

  function removeNode(nodeId: string) {
    if (!graph) return;
    changeGraph({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    });
    if (selectedId === nodeId) closeInspector();
    if (connecting?.sourceId === nodeId) setConnecting(undefined);
  }

  function connect(sourceId: string, targetId: string, condition?: "true" | "false") {
    if (!graph) return;
    const issue = getConnectionIssue(graph, sourceId, targetId, condition);
    if (issue) {
      setError(issue);
      return;
    }
    changeGraph(connectNodesGraph(graph, sourceId, targetId, condition));
    setConnecting(undefined);
    setError(undefined);
    setStatus("Conexión agregada");
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
    setError(undefined);
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
    changeGraph({ ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) });
  }

  function changeEdgeCondition(edgeId: string, condition: "true" | "false") {
    if (!graph) return;
    const result = changeEdgeConditionInGraph(graph, edgeId, condition);
    if (result.issue) {
      setError(result.issue);
      return;
    }
    changeGraph(result.graph);
    setError(undefined);
  }

  const queryError =
    workflowQuery.error ??
    runsQuery.error ??
    agentsQuery.error ??
    modelsQuery.error ??
    chatQuery.error ??
    integrationsQuery.error ??
    settingsQuery.error;
  const displayError = error ?? (queryError instanceof Error ? queryError.message : undefined);

  if (!graph) {
    return (
      <section>
        <p className="text-sm text-muted">{displayError ?? "Cargando proyecto…"}</p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ProjectTopBar
        slug={slug}
        graph={graph}
        tab={tab}
        counts={{ runs: runs.length, agents: agents.length, integrations: integrations.length }}
        dirty={dirty}
        issueCount={graphIssues.length}
        saving={saveWorkflow.isPending}
        modelOptions={modelOptions}
        chatBusy={chatBusy}
        chatUnread={chatUnread}
        versions={versions}
        onTab={(next) => {
          setTab(next);
          setPaletteOpen(false);
          setConnecting(undefined);
        }}
        onChange={(patch) => changeGraph({ ...graph, ...patch })}
        onSave={() => saveWorkflow.mutate(graph)}
        onRun={() => setLaunchOpen(true)}
        onChat={() => {
          setChatOpen(true);
          setChatUnread(false);
        }}
        onRollbackVersion={(version) => rollbackVersion.mutate(version)}
      />

      {(status || displayError || (projectSettings && projectSettings.readiness.some((item) => !item.ready))) && (
        <div className="flex flex-col gap-1 border-b border-line px-3 py-2 lg:px-4">
          {status && <p className="text-xs text-ok">{status}</p>}
          {displayError && <p className="text-xs text-danger">{displayError}</p>}
          {projectSettings && projectSettings.readiness.some((item) => !item.ready) && (
            <p className="text-xs text-warn">
              Configuración pendiente: {projectSettings.readiness.filter((item) => !item.ready).map((item) => item.label).join(", ")}.
            </p>
          )}
        </div>
      )}

      {saveIssues.length > 0 && (
        <div className="border-b border-danger/30 bg-danger/5 px-3 py-2 lg:px-4" role="alert">
          <div className="flex items-start justify-between gap-3">
            <ul className="flex flex-col gap-1 text-xs text-danger">
              {saveIssues.map((issue) => {
                const label = issue.nodeId
                  ? graph.nodes.find((node) => node.id === issue.nodeId)?.label
                  : issue.edgeId
                    ? `Conexión ${issue.edgeId}`
                    : undefined;
                return (
                  <li key={issue.id}>
                    {label ? `${label}: ` : ""}
                    {issue.message}
                  </li>
                );
              })}
            </ul>
            <button type="button" className={buttonGhost} onClick={() => setSaveIssues([])}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {tab === "canvas" ? (
        <div className="relative min-h-0 flex-1">
          <WorkflowCanvas
            graph={graph}
            selectedId={selectedId}
            runningNodeId={runningNodeId}
            nodeStatuses={nodeStatuses}
            runProgress={runProgress}
            agentStatus={chatBusy ? { busy: true, activity: chatActivity } : undefined}
            agentTouchedNodeIds={agentTouchedNodeIds}
            issues={graphIssues}
            connecting={connecting}
            className="h-full"
            onSelect={(nodeId) => openInspector(nodeId)}
            onChange={changeGraph}
            onConnect={connect}
            onConnectRejected={setError}
            onStartConnect={handleStartConnect}
            onCancelConnect={() => setConnecting(undefined)}
            onDuplicateNode={(nodeId) => void duplicateNode(nodeId)}
            onDeleteNode={removeNode}
            onDeleteEdge={deleteEdge}
            onChangeEdgeCondition={changeEdgeCondition}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenRuns={() => setTab("runs")}
            onOpenChat={() => {
              setChatOpen(true);
              setChatUnread(false);
            }}
          />
          {paletteOpen && (
            <NodePaletteModal graph={graph} onClose={() => setPaletteOpen(false)} onAdd={(type) => void addNode(type)} />
          )}
          {selected && inspectorOpen && (
            <NodeInspectorModal
              key={`${selected.id}-${inspectorInitialTab}`}
              node={selected}
              graph={graph}
              agents={agents}
              models={models}
              integrations={integrations}
              destinations={destinations}
              lastStep={lastStep}
              scheduleNextRun={schedulesQuery.data?.find((state) => state.nodeId === selected.id)?.nextWindowAt}
              code={nodeCode}
              codeDirty={nodeCodeDirty}
              issues={graphIssues}
              initialTab={inspectorInitialTab}
              onClose={closeInspector}
              onPatch={updateNode}
              onConfig={updateConfig}
              onRemove={() => removeNode(selected.id)}
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
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div
            className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 lg:px-8"
            data-testid="project-tab-content"
          >
          {tab === "runs" && (
            <div className="flex flex-col gap-3">
              {runs.length === 0 && <p className="text-sm text-muted">Sin ejecuciones todavía.</p>}
              {runs.map((run) => (
                <article className={`${card} gap-2`} key={run.id}>
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <strong className="text-sm">{run.id.slice(0, 8)}</strong>
                    <StatusBadge status={run.status} />
                  </header>
                  <small className="text-xs text-muted">
                    {new Date(run.startedAt).toLocaleString()} · {run.launchedBy ?? "sistema"} · {run.sourceDetail ?? run.entryPoint}
                  </small>
                  {run.error && <p className="text-sm text-danger">{run.error}</p>}
                  {run.output !== undefined && <p className="text-xs text-muted">Resultado: {previewValue(run.output)}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    <button className={buttonGhost} onClick={() => setDetailRun(run)}>
                      Ver detalle
                    </button>
                    <button className={buttonGhost} onClick={() => replayRun.mutate({ id: run.id })}>
                      Re-ejecutar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === "agents" && (
            <AgentCatalog
              projectSlug={slug}
              agents={agents}
              modelOptions={modelOptions}
              isLoading={agentsQuery.isLoading}
              error={agentsQuery.error}
            />
          )}

          {tab === "knowledge" && <ProjectKnowledgePanel projectSlug={slug} />}
          {tab === "configuration" && <ProjectConfigurationPanel projectSlug={slug} />}
          </div>
        </div>
      )}

      <div
        className={`fixed inset-0 z-50 ${chatOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!chatOpen}
        inert={!chatOpen}
      >
        <div
          className={`chat-backdrop absolute inset-0 bg-ink/55 ${chatOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setChatOpen(false)}
        />
        <div
          className={`chat-drawer absolute inset-y-0 right-0 flex w-full max-w-[500px] flex-col overflow-hidden border-l border-line bg-ink p-3 shadow-2xl ${
            chatOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <ChatPanel
            fill
            onMinimize={() => setChatOpen(false)}
            onBusyChange={setChatBusy}
            onActivityChange={setChatActivity}
            onSend={(message, onProgress) => chat.mutateAsync({ message, onEvent: onProgress })}
            onAttachTurn={(turnId, onEvent) => api.attachChatTurn(slug, turnId, onEvent)}
            onCancelTurn={(turnId) => api.cancelChatTurn(slug, turnId)}
            onRetryTurn={(turnId) => api.retryChatTurn(slug, turnId)}
            hint="El canvas se sincroniza en vivo cuando el agente edita archivos. Puede tardar varios minutos."
            initialMessages={chatHistory}
            storageKey={slug}
          />
        </div>
      </div>

      {!chatOpen && (chatBusy || chatUnread) && (
        <button
          type="button"
          className="agent-status-pill fixed bottom-28 right-4 z-40 flex max-w-[280px] items-center gap-2.5 rounded-full border border-accent/40 bg-well/95 px-3.5 py-2 text-left text-xs text-slate-100 shadow-2xl"
          onClick={() => {
            setChatOpen(true);
            setChatUnread(false);
          }}
          aria-label={chatBusy ? "Abrir chat, el agente está trabajando" : "Abrir chat, hay una respuesta nueva"}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              chatBusy ? "animate-pulse bg-accent motion-reduce:animate-none" : "bg-ok"
            }`}
          />
          <span className="min-w-0">
            <strong className="block text-[11px]">{chatBusy ? "Agente trabajando" : "Respuesta lista"}</strong>
            <span className="block truncate text-[11px] text-muted">
              {chatBusy ? (chatActivity ?? "Preparando respuesta…") : "Abre el chat para verla"}
            </span>
          </span>
        </button>
      )}

      {launchOpen && (
        <RunLaunchModal
          graph={graph}
          onClose={() => setLaunchOpen(false)}
          onLaunch={(payload) => runWorkflow.mutate(payload)}
        />
      )}

      {detailRun && (
        <RunDetailModal
          run={detailRun}
          nodeLabels={Object.fromEntries(graph.nodes.map((node) => [node.id, node.label ?? node.id]))}
          onClose={() => setDetailRun(undefined)}
          onReplay={(fromNodeId) => replayRun.mutate({ id: detailRun.id, fromNodeId })}
        />
      )}
    </section>
  );
}
