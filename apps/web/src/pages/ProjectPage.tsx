import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NodeSpec, WorkflowGraph } from "@platform/shared";
import { api, type RunRecord } from "../api.ts";
import { qk } from "../query.ts";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { CodeEditor } from "../components/CodeEditor.tsx";
import { WorkflowCanvas } from "../components/WorkflowCanvas.tsx";
import { RunDetailModal, previewValue } from "../components/RunDetailModal.tsx";
import { NODE_CATALOG, NODE_META } from "../components/nodes/node-catalog.ts";
import { NodeIcon } from "../components/nodes/node-icons.tsx";
import { badge, button, buttonDanger, buttonGhost, buttonPrimary, card, pageTitle, statusBadge } from "../ui.ts";

const DEFAULT_CODE = `export default async function run(input: unknown, ctx: any) {
  ctx.log("nodo ejecutado", { input });
  return { ok: true, input };
}
`;

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_META).map(([type, meta]) => [type, meta.title]),
);

type Tab = "canvas" | "runs" | "agents";

export function ProjectPage() {
  const { slug = "" } = useParams();
  const queryClient = useQueryClient();

  const workflowQuery = useQuery({ queryKey: qk.workflow(slug), queryFn: () => api.getWorkflow(slug), enabled: Boolean(slug) });
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

  const runs = runsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const chatHistory = chatQuery.data ?? [];

  const [graph, setGraph] = useState<WorkflowGraph>();
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [nodeCode, setNodeCode] = useState("");
  const [nodeCodeDirty, setNodeCodeDirty] = useState(false);
  const [runningNodeId, setRunningNodeId] = useState<string>();
  const [detailRun, setDetailRun] = useState<RunRecord>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>("canvas");
  const [agentForm, setAgentForm] = useState({
    category: "",
    role: "",
    description: "",
    body: "",
    model: "",
    notebooks: "",
  });

  useEffect(() => {
    if (workflowQuery.data) {
      setGraph(workflowQuery.data);
      setDirty(false);
    }
  }, [workflowQuery.data]);

  const selected = useMemo(() => graph?.nodes.find((node) => node.id === selectedId), [graph, selectedId]);
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
        queryClient.setQueryData(qk.workflow(slug), data.graph);
        setGraph(data.graph);
        setDirty(false);
      }
    });
    source.addEventListener("run.updated", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { projectSlug: string; nodeId?: string; status: string };
      if (data.projectSlug !== slug) return;
      setRunningNodeId(data.status === "running" ? data.nodeId : undefined);
      void queryClient.invalidateQueries({ queryKey: qk.runs(slug) });
    });
    return () => source.close();
  }, [slug, queryClient]);

  const saveWorkflow = useMutation({
    mutationFn: (next: WorkflowGraph) => api.saveWorkflow(slug, next),
    onSuccess: (saved) => {
      queryClient.setQueryData(qk.workflow(slug), saved);
      setGraph(saved);
      setDirty(false);
      setStatus("Flujo guardado");
      setError(undefined);
    },
    onError: (cause) => {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar");
      setStatus(undefined);
    },
  });

  const runWorkflow = useMutation({
    mutationFn: () => api.runWorkflow(slug, { message: "Ejecución manual desde el canvas" }),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: qk.runs(slug) });
      setDetailRun(run);
      setStatus(run.status === "paused" ? "Ejecución pausada esperando aprobación" : "Ejecución completada");
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

  const upsertAgent = useMutation({
    mutationFn: () =>
      api.upsertAgent(slug, agentForm.category, agentForm.role, {
        description: agentForm.description,
        body: agentForm.body,
        model: agentForm.model || undefined,
        mode: "subagent",
        notebooks: agentForm.notebooks
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.agents(slug) });
      setStatus(`Sub-agente ${agentForm.category}/${agentForm.role} guardado`);
      setError(undefined);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el sub-agente"),
  });

  const deleteAgent = useMutation({
    mutationFn: ({ category, role }: { category: string; role: string }) => api.deleteAgent(slug, category, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.agents(slug) });
    },
  });

  const chat = useMutation({
    mutationFn: (message: string) => api.chat(slug, message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.chat(slug) });
    },
  });

  const modelOptions = useMemo(() => models.map((model) => `${model.providerID}/${model.modelID}`), [models]);

  function changeGraph(next: WorkflowGraph) {
    setGraph(next);
    setDirty(true);
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

  async function addNode(type: NodeSpec["type"]) {
    if (!graph || !slug) return;
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`;
    const defaults: Record<string, Record<string, unknown>> = {
      trigger: { kind: "manual", isPublic: false },
      http: { method: "GET", url: "https://api.example.com", headers: "{}", body: "" },
      delay: { ms: 1000 },
      transform: { template: '{"result":"{{input}}"}' },
      decision: { mode: "condition", condition: { field: "status", operator: "equals", value: "ok" } },
      approval: { message: "Revisar antes de continuar", autoApprove: false },
      agent: { instruction: "" },
      code: {},
    };
    const node: NodeSpec = {
      id,
      type,
      label: NODE_LABELS[type],
      position: { x: 80 + graph.nodes.length * 30, y: 80 + (graph.nodes.length % 4) * 110 },
      config: defaults[type] ?? {},
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    };
    if (type === "code") {
      node.codeFile = `nodes/${id}.ts`;
      await api.writeNode(slug, node.codeFile, DEFAULT_CODE);
      queryClient.setQueryData(["node", slug, node.codeFile], DEFAULT_CODE);
    }
    if (type === "agent") {
      node.agentId = agents[0] ? `${agents[0].category}/${agents[0].role}` : "general/agent";
    }
    const outgoing = new Set(graph.edges.map((edge) => edge.source));
    const source =
      graph.nodes.find((candidate) => candidate.id === selectedId && candidate.type !== "decision") ??
      graph.nodes.find((candidate) => !outgoing.has(candidate.id) && candidate.type !== "decision");
    const edges = source
      ? [...graph.edges, { id: `edge-${crypto.randomUUID().slice(0, 8)}`, source: source.id, target: id }]
      : graph.edges;
    changeGraph({ ...graph, nodes: [...graph.nodes, node], edges });
    setSelectedId(id);
  }

  async function removeSelectedNode() {
    if (!graph || !selectedId) return;
    changeGraph({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== selectedId),
      edges: graph.edges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId),
    });
    setSelectedId(undefined);
  }

  const queryError = workflowQuery.error ?? runsQuery.error ?? agentsQuery.error ?? modelsQuery.error ?? chatQuery.error;
  const displayError = error ?? (queryError instanceof Error ? queryError.message : undefined);

  if (!graph) {
    return (
      <section>
        <p className="text-sm text-muted">{displayError ?? "Cargando proyecto…"}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">
            <Link className="text-accent" to="/projects">
              ← Proyectos
            </Link>{" "}
            / {slug}
          </p>
          <h1 className={`${pageTitle} mt-1`}>{graph.name}</h1>
          <p className="mt-1 text-sm text-muted">{graph.description || "Sin descripción"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className={statusBadge("paused")}>Cambios sin guardar</span>}
          <select
            aria-label="Modelo por defecto"
            className="w-auto min-w-[220px]"
            value={graph.defaultModel ?? ""}
            onChange={(event) => changeGraph({ ...graph, defaultModel: event.target.value || undefined })}
          >
            <option value="">Modelo por defecto del sistema</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <button className={button} onClick={() => saveWorkflow.mutate(graph)}>
            Guardar flujo
          </button>
          <button className={buttonPrimary} onClick={() => runWorkflow.mutate()}>
            Ejecutar
          </button>
        </div>
      </header>

      {status && <p className="text-sm text-ok">{status}</p>}
      {displayError && <p className="text-sm text-danger">{displayError}</p>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex gap-1.5 border-b border-line pb-2">
            {(
              [
                ["canvas", "Canvas"],
                ["runs", `Ejecuciones (${runs.length})`],
                ["agents", `Sub-agentes (${agents.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  tab === key ? "border-line bg-panel text-slate-100" : "border-transparent text-muted hover:bg-panel"
                }`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "canvas" && (
            <div className="flex flex-col gap-2.5">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {NODE_CATALOG.map((type) => (
                  <button
                    key={type}
                    className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-[#0b1220] p-2.5 text-left text-slate-200 transition hover:border-[var(--node-color)]"
                    style={{ "--node-color": NODE_META[type].color } as CSSProperties}
                    onClick={() => void addNode(type)}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${NODE_META[type].color} 20%, #0b1220)`,
                        color: NODE_META[type].color,
                      }}
                    >
                      <NodeIcon type={type} />
                    </span>
                    <span>
                      <strong className="block text-xs">{NODE_META[type].title}</strong>
                      <small className="block text-[10px] text-muted">{NODE_META[type].description}</small>
                    </span>
                  </button>
                ))}
              </div>
              <WorkflowCanvas
                graph={graph}
                selectedId={selectedId}
                runningNodeId={runningNodeId}
                nodeStatuses={nodeStatuses}
                onSelect={setSelectedId}
                onChange={changeGraph}
              />
            </div>
          )}

          {tab === "runs" && (
            <div className="flex flex-col gap-3">
              {runs.length === 0 && <p className="text-sm text-muted">Sin ejecuciones todavía.</p>}
              {runs.map((run) => (
                <article className={`${card} gap-2`} key={run.id}>
                  <header className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{run.id.slice(0, 8)}</strong>
                    <span className={statusBadge(run.status)}>{run.status}</span>
                  </header>
                  <small className="text-xs text-muted">{new Date(run.startedAt).toLocaleString()}</small>
                  {run.error && <p className="text-sm text-danger">{run.error}</p>}
                  {run.output !== undefined && (
                    <p className="text-xs text-muted">Resultado: {previewValue(run.output)}</p>
                  )}
                  <ol className="flex list-inside list-decimal flex-col gap-1 text-xs text-muted">
                    {run.steps.map((step) => (
                      <li key={step.id}>
                        <span className={`inline-block h-2 w-2 rounded-full ${step.status === "succeeded" ? "bg-ok" : step.status === "running" ? "bg-accent" : "bg-danger"}`} />{" "}
                        {step.status} · {step.nodeId} · {step.durationMs}ms
                        {step.model ? ` · ${step.model}` : ""}
                        {step.agentId ? ` · ${step.agentId}` : ""}
                        {step.error ? ` · ${step.error}` : ""}
                      </li>
                    ))}
                  </ol>
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
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {agents.map((agent) => (
                  <article className={card} key={`${agent.category}/${agent.role}`}>
                    <strong className="text-sm">
                      {agent.category}/{agent.role}
                    </strong>
                    <p className="text-sm text-muted">{agent.frontmatter.description}</p>
                    <small className="text-xs text-muted">{agent.frontmatter.model ?? "modelo heredado"}</small>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        className={buttonGhost}
                        onClick={() =>
                          setAgentForm({
                            category: agent.category,
                            role: agent.role,
                            description: agent.frontmatter.description,
                            body: agent.body,
                            model: agent.frontmatter.model ?? "",
                            notebooks: (agent.frontmatter.notebooks ?? []).join(", "),
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        className={buttonDanger}
                        onClick={() => deleteAgent.mutate({ category: agent.category, role: agent.role })}
                      >
                        Borrar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <form
                className={`${card} !grid gap-3 md:grid-cols-2`}
                onSubmit={(event) => {
                  event.preventDefault();
                  upsertAgent.mutate();
                }}
                aria-label="Editor de sub-agente"
              >
                <h2 className="text-base font-semibold text-slate-100 md:col-span-2">Crear o editar sub-agente</h2>
                <label>
                  Categoría
                  <input
                    value={agentForm.category}
                    onChange={(event) => setAgentForm({ ...agentForm, category: event.target.value })}
                    placeholder="ventas"
                  />
                </label>
                <label>
                  Rol
                  <input
                    value={agentForm.role}
                    onChange={(event) => setAgentForm({ ...agentForm, role: event.target.value })}
                    placeholder="calificador"
                  />
                </label>
                <label>
                  Descripción
                  <input
                    value={agentForm.description}
                    onChange={(event) => setAgentForm({ ...agentForm, description: event.target.value })}
                  />
                </label>
                <label>
                  Modelo
                  <select value={agentForm.model} onChange={(event) => setAgentForm({ ...agentForm, model: event.target.value })}>
                    <option value="">Heredar del flujo</option>
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notebooks (separados por coma)
                  <input
                    value={agentForm.notebooks}
                    onChange={(event) => setAgentForm({ ...agentForm, notebooks: event.target.value })}
                  />
                </label>
                <label className="md:col-span-2">
                  Instrucciones (.md)
                  <textarea
                    rows={6}
                    value={agentForm.body}
                    onChange={(event) => setAgentForm({ ...agentForm, body: event.target.value })}
                    placeholder="Eres el especialista de…"
                  />
                </label>
                <button
                  className={`${buttonPrimary} md:col-span-2`}
                  disabled={upsertAgent.isPending || !agentForm.category || !agentForm.role || !agentForm.description || !agentForm.body}
                >
                  Guardar sub-agente
                </button>
              </form>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:overflow-auto">
          <ChatPanel
            onSend={(message) => chat.mutateAsync(message).then((result) => result.reply)}
            hint="El canvas se sincroniza en vivo cuando el agente edita archivos. Puede tardar varios minutos."
            initialMessages={chatHistory}
          />
          {tab === "canvas" && selected && (
            <section className={`${card} gap-2.5`} aria-label="Inspector de nodo">
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-100">{NODE_LABELS[selected.type]}</h2>
                <button className={buttonDanger} onClick={() => void removeSelectedNode()}>
                  Eliminar
                </button>
              </header>
              <label>
                Etiqueta
                <input value={selected.label ?? ""} onChange={(event) => updateNode({ label: event.target.value })} />
              </label>

              {selected.type === "trigger" && (
                <>
                  <label>
                    Tipo de trigger
                    <select value={String(selected.config.kind ?? "manual")} onChange={(event) => updateConfig({ kind: event.target.value })}>
                      <option value="manual">Manual</option>
                      <option value="cron">Cron / programado</option>
                      <option value="webhook">Webhook</option>
                      <option value="telegram">Telegram</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="external_chat">Chat externo</option>
                    </select>
                  </label>
                  {selected.config.kind === "cron" && (
                    <label>
                      Expresión cron
                      <input
                        value={String(selected.config.cron ?? "")}
                        onChange={(event) => updateConfig({ cron: event.target.value })}
                        placeholder="0 9 * * *"
                      />
                    </label>
                  )}
                  {["telegram", "whatsapp", "external_chat"].includes(String(selected.config.kind)) && (
                    <label>
                      Canal (slug)
                      <input
                        value={String(selected.config.channelSlug ?? "")}
                        onChange={(event) => updateConfig({ channelSlug: event.target.value })}
                        placeholder="mi-canal"
                      />
                    </label>
                  )}
                  <label className="flex-row items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-auto"
                      checked={selected.config.isPublic === true}
                      onChange={(event) => updateConfig({ isPublic: event.target.checked })}
                    />
                    Permitir remitentes públicos
                  </label>
                </>
              )}

              {selected.type === "http" && (
                <>
                  <label>
                    Método
                    <select value={String(selected.config.method ?? "GET")} onChange={(event) => updateConfig({ method: event.target.value })}>
                      {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    URL
                    <input
                      value={String(selected.config.url ?? "")}
                      onChange={(event) => updateConfig({ url: event.target.value })}
                      placeholder="https://api.example.com"
                    />
                  </label>
                  <label>
                    Headers (JSON)
                    <textarea
                      rows={3}
                      value={String(selected.config.headers ?? "{}")}
                      onChange={(event) => updateConfig({ headers: event.target.value })}
                    />
                  </label>
                  <label>
                    Body (JSON o texto)
                    <textarea
                      rows={3}
                      value={String(selected.config.body ?? "")}
                      onChange={(event) => updateConfig({ body: event.target.value })}
                    />
                  </label>
                </>
              )}

              {selected.type === "delay" && (
                <label>
                  Espera (ms, máx. 60000)
                  <input
                    type="number"
                    min={0}
                    max={60000}
                    value={Number(selected.config.ms ?? 1000)}
                    onChange={(event) => updateConfig({ ms: Number(event.target.value) })}
                  />
                </label>
              )}

              {selected.type === "transform" && (
                <>
                  <label>
                    Plantilla / mapeo JSON
                    <textarea
                      rows={5}
                      value={String(selected.config.template ?? "")}
                      onChange={(event) => updateConfig({ template: event.target.value })}
                      placeholder={'{"nombre":"{{input.name}}","activo":true}'}
                    />
                  </label>
                  <p className="text-xs text-muted">Usa {"{{input.campo}}"} para interpolar la entrada.</p>
                </>
              )}

              {selected.type === "decision" && (
                <>
                  <label>
                    Modo
                    <select
                      value={String(selected.config.mode ?? (selected.codeFile ? "code" : "condition"))}
                      onChange={(event) => {
                        if (event.target.value === "code") void enableDecisionCode();
                        else updateConfig({ mode: "condition" });
                      }}
                    >
                      <option value="condition">Condición visual</option>
                      <option value="code">Código TypeScript</option>
                    </select>
                  </label>
                  {selected.config.mode !== "code" && (
                    <>
                      <label>
                        Campo de entrada
                        <input
                          value={String((selected.config.condition as { field?: string })?.field ?? "")}
                          onChange={(event) =>
                            updateConfig({ condition: { ...(selected.config.condition as object), field: event.target.value } })
                          }
                          placeholder="status"
                        />
                      </label>
                      <label>
                        Operador
                        <select
                          value={String((selected.config.condition as { operator?: string })?.operator ?? "equals")}
                          onChange={(event) =>
                            updateConfig({ condition: { ...(selected.config.condition as object), operator: event.target.value } })
                          }
                        >
                          <option value="equals">igual a</option>
                          <option value="not_equals">distinto de</option>
                          <option value="contains">contiene</option>
                          <option value="greater_than">mayor que</option>
                          <option value="less_than">menor que</option>
                          <option value="exists">existe</option>
                          <option value="truthy">es verdadero</option>
                        </select>
                      </label>
                      <label>
                        Valor
                        <input
                          value={String((selected.config.condition as { value?: unknown })?.value ?? "")}
                          onChange={(event) =>
                            updateConfig({ condition: { ...(selected.config.condition as object), value: event.target.value } })
                          }
                        />
                      </label>
                      <p className="text-xs text-muted">Conecta las salidas sí / no a los siguientes nodos.</p>
                    </>
                  )}
                </>
              )}

              {selected.type === "agent" && (
                <>
                  <label>
                    Sub-agente
                    <select value={selected.agentId ?? ""} onChange={(event) => updateNode({ agentId: event.target.value })}>
                      <option value="">Selecciona un sub-agente</option>
                      {agents.map((agent) => (
                        <option key={`${agent.category}/${agent.role}`} value={`${agent.category}/${agent.role}`}>
                          {agent.category}/{agent.role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modelo del nodo
                    <select value={selected.modelOverride ?? ""} onChange={(event) => updateNode({ modelOverride: event.target.value || undefined })}>
                      <option value="">Heredar del flujo</option>
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notebooks (coma)
                    <input
                      value={selected.notebookIds.join(", ")}
                      onChange={(event) =>
                        updateNode({
                          notebookIds: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    Instrucción adicional
                    <textarea
                      rows={3}
                      value={String(selected.config.instruction ?? "")}
                      onChange={(event) => updateConfig({ instruction: event.target.value })}
                    />
                  </label>
                  <label className="flex-row items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-auto"
                      checked={selected.config.strictGrounding === true}
                      onChange={(event) => updateConfig({ strictGrounding: event.target.checked })}
                    />
                    Respuestas fundamentadas solo en Notebooks
                  </label>
                </>
              )}

              {selected.type === "approval" && (
                <>
                  <label>
                    Mensaje de aprobación
                    <textarea
                      rows={2}
                      value={String(selected.config.message ?? "")}
                      onChange={(event) => updateConfig({ message: event.target.value })}
                    />
                  </label>
                  <label className="flex-row items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-auto"
                      checked={selected.config.autoApprove === true}
                      onChange={(event) => updateConfig({ autoApprove: event.target.checked })}
                    />
                    Aprobar automáticamente (solo pruebas)
                  </label>
                </>
              )}

              {["code", "http", "decision", "agent"].includes(selected.type) && (
                <>
                  <label>
                    Timeout (ms)
                    <input
                      type="number"
                      value={selected.timeoutMs}
                      onChange={(event) => updateNode({ timeoutMs: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Reintentos
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={selected.retryPolicy.maxRetries}
                      onChange={(event) => updateNode({ retryPolicy: { maxRetries: Number(event.target.value) } })}
                    />
                  </label>
                </>
              )}

              {(selected.type === "code" || (selected.type === "decision" && selected.config.mode === "code")) && (
                <div>
                  <p className="text-xs text-muted">{selected.codeFile}</p>
                  <CodeEditor
                    value={nodeCode}
                    onChange={(value) => {
                      setNodeCode(value);
                      setNodeCodeDirty(true);
                    }}
                  />
                  <button
                    className={button}
                    disabled={!nodeCodeDirty || saveNode.isPending || !selected.codeFile}
                    onClick={() => selected.codeFile && saveNode.mutate({ file: selected.codeFile, code: nodeCode })}
                  >
                    Guardar nodo
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

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
