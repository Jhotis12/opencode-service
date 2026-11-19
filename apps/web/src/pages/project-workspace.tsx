import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChatTurnEvent,
  IntegrationRecord,
  ProjectDestination,
  SubagentProfile,
  WorkflowGraph,
  WorkflowVersion,
} from "@platform/shared";
import {
  api,
  ApiClientError,
  RUNS_LIST_LIMIT,
  type ChatHistoryMessage,
  type ChatTurnResult,
  type ModelInfo,
  type ProjectSettingsView,
  type RunRecord,
  type ScheduleState,
} from "../api.ts";
import { qk } from "../query.ts";
import { getGraphIssues, mapServerIssue, type GraphIssue } from "../components/canvas/graph-edits.ts";

export interface ProjectWorkspace {
  slug: string;
  graph: WorkflowGraph | undefined;
  dirty: boolean;
  changeGraph(next: WorkflowGraph): void;
  graphIssues: GraphIssue[];
  saving: boolean;
  saveWorkflow(next: WorkflowGraph): void;
  runWorkflow(payload: unknown): void;
  replayRun(runId: string, fromNodeId?: string): void;
  rollbackVersion(version: number): void;
  runs: RunRecord[];
  runsLoading: boolean;
  runsError: Error | null;
  refetchRuns(): void;
  agents: SubagentProfile[];
  agentsLoading: boolean;
  agentsError: Error | null;
  models: ModelInfo[];
  modelOptions: string[];
  integrations: IntegrationRecord[];
  destinations: ProjectDestination[];
  schedules: ScheduleState[];
  chatHistory: ChatHistoryMessage[];
  settings: ProjectSettingsView | undefined;
  versions: WorkflowVersion[];
  status: string | undefined;
  setStatus(next: string | undefined): void;
  error: string | undefined;
  setError(next: string | undefined): void;
  displayError: string | undefined;
  saveIssues: GraphIssue[];
  clearSaveIssues(): void;
  runningNodeId: string | undefined;
  detailRun: RunRecord | undefined;
  setDetailRun(next: RunRecord | undefined): void;
  launchOpen: boolean;
  setLaunchOpen(next: boolean): void;
  chatOpen: boolean;
  setChatOpen(next: boolean): void;
  chatBusy: boolean;
  setChatBusy(next: boolean): void;
  chatActivity: string | undefined;
  setChatActivity(next: string | undefined): void;
  chatUnread: boolean;
  setChatUnread(next: boolean): void;
  agentTouchedNodeIds: string[];
  sendChat(message: string, onEvent?: (event: ChatTurnEvent) => void): Promise<ChatTurnResult>;
  requestNavigate(target: string): void;
  pendingPath: string | undefined;
  discardAndContinue(): void;
  cancelPendingNavigation(): void;
}

const ProjectWorkspaceContext = createContext<ProjectWorkspace | undefined>(undefined);

export function useProjectWorkspace(): ProjectWorkspace {
  const workspace = useContext(ProjectWorkspaceContext);
  if (!workspace) throw new Error("useProjectWorkspace debe usarse dentro de ProjectLayout");
  return workspace;
}

export function ProjectWorkspaceProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const workflowQuery = useQuery({ queryKey: qk.workflow(slug), queryFn: () => api.getWorkflow(slug), enabled: Boolean(slug) });
  const schedulesQuery = useQuery({
    queryKey: qk.schedules(slug),
    queryFn: () => api.listSchedules(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });
  const runsQuery = useQuery({
    queryKey: qk.runs(slug),
    queryFn: () => api.listRuns(slug, RUNS_LIST_LIMIT).then((result) => result.data),
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
    queryFn: () => api.listWorkflowVersions(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });

  const runs = runsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const chatHistory = chatQuery.data ?? [];
  const integrations = integrationsQuery.data ?? [];
  const destinations = destinationsQuery.data ?? [];
  const schedules = schedulesQuery.data ?? [];
  const settings = settingsQuery.data;
  const versions = versionsQuery.data ?? [];

  const [graph, setGraph] = useState<WorkflowGraph>();
  const [dirty, setDirty] = useState(false);
  const [runningNodeId, setRunningNodeId] = useState<string>();
  const [detailRun, setDetailRun] = useState<RunRecord>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [launchOpen, setLaunchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [saveIssues, setSaveIssues] = useState<GraphIssue[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatActivity, setChatActivity] = useState<string>();
  const [chatUnread, setChatUnread] = useState(false);
  const [agentTouchedNodeIds, setAgentTouchedNodeIds] = useState<string[]>([]);
  const [pendingPath, setPendingPath] = useState<string>();
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

  useEffect(() => () => clearTimeout(agentTouchTimer.current), []);

  const graphIssues = useMemo(() => (graph ? getGraphIssues(graph) : []), [graph]);

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

  const saveWorkflowMutation = useMutation({
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

  const runWorkflowMutation = useMutation({
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

  const replayRunMutation = useMutation({
    mutationFn: ({ id, fromNodeId }: { id: string; fromNodeId?: string }) => api.replayRun(id, fromNodeId),
    onSuccess: async (replayed) => {
      await queryClient.invalidateQueries({ queryKey: qk.runs(slug) });
      setDetailRun(replayed);
      setStatus(`Ejecución ${replayed.id.slice(0, 8)} re-ejecutada`);
      setError(undefined);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo re-ejecutar"),
  });

  const rollbackVersionMutation = useMutation({
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

  const chatMutation = useMutation({
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

  function requestNavigate(target: string) {
    if (dirty) {
      setPendingPath(target);
      return;
    }
    navigate(target);
  }

  function discardAndContinue() {
    const target = pendingPath;
    setPendingPath(undefined);
    if (target === undefined) return;
    if (workflowQuery.data) setGraph(workflowQuery.data);
    setDirty(false);
    setSaveIssues([]);
    navigate(target);
  }

  function cancelPendingNavigation() {
    setPendingPath(undefined);
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

  const workspace: ProjectWorkspace = {
    slug,
    graph,
    dirty,
    changeGraph,
    graphIssues,
    saving: saveWorkflowMutation.isPending,
    saveWorkflow: (next) => saveWorkflowMutation.mutate(next),
    runWorkflow: (payload) => runWorkflowMutation.mutate(payload),
    replayRun: (runId, fromNodeId) => replayRunMutation.mutate({ id: runId, fromNodeId }),
    rollbackVersion: (version) => rollbackVersionMutation.mutate(version),
    runs,
    runsLoading: runsQuery.isLoading,
    runsError: runsQuery.error,
    refetchRuns: () => void runsQuery.refetch(),
    agents,
    agentsLoading: agentsQuery.isLoading,
    agentsError: agentsQuery.error,
    models,
    modelOptions,
    integrations,
    destinations,
    schedules,
    chatHistory,
    settings,
    versions,
    status,
    setStatus,
    error,
    setError,
    displayError,
    saveIssues,
    clearSaveIssues: () => setSaveIssues([]),
    runningNodeId,
    detailRun,
    setDetailRun,
    launchOpen,
    setLaunchOpen,
    chatOpen,
    setChatOpen,
    chatBusy,
    setChatBusy,
    chatActivity,
    setChatActivity,
    chatUnread,
    setChatUnread,
    agentTouchedNodeIds,
    sendChat: (message, onEvent) => chatMutation.mutateAsync({ message, onEvent }),
    requestNavigate,
    pendingPath,
    discardAndContinue,
    cancelPendingNavigation,
  };

  return <ProjectWorkspaceContext.Provider value={workspace}>{children}</ProjectWorkspaceContext.Provider>;
}

export function ProjectSectionBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 lg:px-8"
        data-testid="project-tab-content"
      >
        {children}
      </div>
    </div>
  );
}
