import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { IntegrationRecord, NodeSpec, NodeType, WorkflowGraph } from "@platform/shared";
import { WorkflowCanvas } from "../src/components/WorkflowCanvas.tsx";
import { NodePaletteModal } from "../src/components/NodePaletteModal.tsx";
import { NodeInspectorModal } from "../src/components/NodeInspectorModal.tsx";
import { ProjectTopBar, type ProjectTab } from "../src/components/ProjectTopBar.tsx";
import { chooseOption } from "./render.tsx";

vi.mock("../src/components/CodeEditor.tsx", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => (
    <textarea aria-label="Editor de código" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function node(id: string, type: NodeType, extra: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id,
    type,
    label: id,
    position: { x: 0, y: 0 },
    config: {},
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
    ...(type === "code" ? { codeFile: `nodes/${id}.ts` } : {}),
    ...(type === "agent" ? { agentId: "ventas/calificador" } : {}),
    ...(type === "http" ? { config: { url: "https://example.com" } } : {}),
    ...(type === "delay" ? { config: { ms: 1000 } } : {}),
    ...(type === "validate" ? { config: { rules: [{ name: "tema", type: "string", required: true }] } } : {}),
    ...(type === "transform" ? { config: { template: "{}" } } : {}),
    ...(type === "decision" ? { config: { mode: "condition", condition: { field: "ok", operator: "truthy" } } } : {}),
    ...extra,
  };
}

function graph(nodes: NodeSpec[], edges: WorkflowGraph["edges"] = []): WorkflowGraph {
  return {
    version: 1,
    id: "graph",
    name: "Demo",
    description: "Demo flow",
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

const allTypes: NodeType[] = ["trigger", "http", "database", "notify", "subworkflow", "code", "transform", "delay", "validate", "foreach", "agent", "transcribe", "decision", "approval"];

function renderCanvas(overrides: Partial<React.ComponentProps<typeof WorkflowCanvas>> = {}) {
  const props: React.ComponentProps<typeof WorkflowCanvas> = {
    graph: graph(allTypes.map((type, index) => node(type, type, { position: { x: index * 280, y: 0 } }))),
    onSelect: vi.fn(),
    onChange: vi.fn(),
    onConnect: vi.fn(),
    onConnectRejected: vi.fn(),
    onStartConnect: vi.fn(),
    onCancelConnect: vi.fn(),
    onDuplicateNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onDeleteEdge: vi.fn(),
    onChangeEdgeCondition: vi.fn(),
    onOpenPalette: vi.fn(),
    ...overrides,
  };
  const result = render(<WorkflowCanvas {...props} />);
  return { ...result, props };
}

describe("WorkflowCanvas", () => {
  it("renders a distinct silhouette for every node type", () => {
    const { container } = renderCanvas();
    const shapes = Array.from(container.querySelectorAll("[data-node-shape]")).map((element) =>
      element.getAttribute("data-node-shape"),
    );
    expect(shapes.sort()).toEqual([...allTypes].sort());
  });

  it("shows the node toolbar for the selected node, exposes both decision handles and calls actions", async () => {
    const { container, props } = renderCanvas({ selectedId: "decision" });
    expect(await screen.findByRole("button", { name: "Duplicar nodo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar nodo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar nodo" })).toBeInTheDocument();

    const decision = container.querySelector('[data-node-id="decision"]')!;
    expect(decision.querySelector('[data-handleid="true"]')).not.toBeNull();
    expect(decision.querySelector('[data-handleid="false"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Duplicar nodo" }));
    fireEvent.click(screen.getByRole("button", { name: "Conectar nodo" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar nodo" }));
    expect(vi.mocked(props.onDuplicateNode)).toHaveBeenCalledWith("decision");
    expect(vi.mocked(props.onStartConnect)).toHaveBeenCalledWith("decision");
    expect(vi.mocked(props.onDeleteNode)).toHaveBeenCalledWith("decision");
  });

  it("highlights valid connection targets, connects on click and cancels with Escape", async () => {
    const { container, props } = renderCanvas({ connecting: { sourceId: "trigger" } });
    expect(screen.getByText("Elige el destino")).toBeInTheDocument();
    const source = container.querySelector('[data-node-id="trigger"]');
    await waitFor(() => expect(source).not.toBeNull());
    expect(source!.className).toContain("ring-sky-300");
    const codeTarget = container.querySelector('[data-node-id="code"]');
    await waitFor(() => expect(codeTarget).not.toBeNull());
    expect(codeTarget!.className).toContain("ring-emerald-400");

    fireEvent.click(codeTarget!);
    await waitFor(() => expect(vi.mocked(props.onConnect)).toHaveBeenCalledWith("trigger", "code", undefined));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(vi.mocked(props.onCancelConnect)).toHaveBeenCalled();
  });

  it("keeps selection and live status visible after a graph re-sync", async () => {
    const first = graph([node("start", "trigger"), node("code", "code")]);
    const { rerender, props } = renderCanvas({ graph: first, selectedId: "code" });
    expect(await screen.findByRole("button", { name: "Duplicar nodo" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Estado: Completado")).not.toBeInTheDocument();

    rerender(
      <WorkflowCanvas
        {...props}
        graph={{ ...first, updatedAt: new Date().toISOString() }}
        nodeStatuses={{ code: "succeeded" }}
        selectedId="code"
      />,
    );
    const status = screen.getByLabelText("Estado: Completado");
    expect(status).toBeInTheDocument();
    expect(status.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Duplicar nodo" })).toBeInTheDocument();
  });

  it("exposes an explicit fit-view action", () => {
    renderCanvas();
    expect(screen.getByRole("button", { name: "Ajustar vista del flujo" })).toBeInTheDocument();
  });

  it("uses the readable node footprint and title size", async () => {
    const { container } = renderCanvas({ graph: graph([node("code", "code", { label: "Consultar" })]) });
    const wrapper = container.querySelector('[data-node-id="code"]')!;
    expect(wrapper.className).toContain("h-[96px]");
    expect(wrapper.className).toContain("w-[252px]");
    expect(screen.getByText("Consultar").className).toContain("text-[14px]");
    expect(screen.getByText("Código").className).toContain("text-[11px]");
  });

  it("selects a node on click and keeps long labels in a truncated element", async () => {
    const onSelect = vi.fn();
    const { container } = renderCanvas({
      graph: graph([node("start", "trigger", { label: "Un nombre de nodo extremadamente largo que no debería romper la silueta" })]),
      onSelect,
    });
    const label = screen.getByTitle("Un nombre de nodo extremadamente largo que no debería romper la silueta");
    expect(label.className).toContain("truncate");
    fireEvent.click(container.querySelector('[data-node-id="start"]')!);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("start"));
  });

  it("routes keyboard node removal through the delete action so the owner can confirm it", async () => {
    const onChange = vi.fn();
    const { container, props } = renderCanvas({ onChange });
    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    fireEvent.keyDown(document, { key: "Delete", code: "Delete" });
    await waitFor(() => expect(vi.mocked(props.onDeleteNode)).toHaveBeenCalledWith("code"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the live zoom percentage and lists the editor shortcuts", async () => {
    renderCanvas();
    await waitFor(() => expect(screen.getByText(/Zoom \d+%/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Atajos de teclado" }));
    const dialog = screen.getByRole("dialog", { name: "Atajos de teclado" });
    expect(within(dialog).getByText("Guardar el flujo")).toBeInTheDocument();
    expect(within(dialog).getByText("Ctrl/Cmd")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Atajos de teclado" })).not.toBeInTheDocument();
  });
});

describe("NodePaletteModal", () => {
  const paletteGraph = graph([node("start", "trigger")]);

  it("searches, shows an empty state and disables a second trigger", async () => {
    const onAdd = vi.fn();
    render(<NodePaletteModal graph={paletteGraph} onClose={vi.fn()} onAdd={onAdd} />);

    const triggerOption = screen.getByRole("button", { name: /Trigger/ });
    expect(triggerOption).toBeDisabled();
    expect(screen.getAllByText("Este flujo ya tiene un trigger.").length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("Buscar nodo"), "agente");
    expect(screen.getByRole("button", { name: /Agente/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HTTP Request/ })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar nodo"));
    await userEvent.type(screen.getByLabelText("Buscar nodo"), "transcribir");
    expect(screen.getByRole("button", { name: /Transcribir audio/ })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar nodo"));
    await userEvent.type(screen.getByLabelText("Buscar nodo"), "zzzz");
    expect(screen.getByText(/No hay nodos que coincidan/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar nodo"));
    await userEvent.click(screen.getByRole("button", { name: /HTTP Request/ }));
    expect(onAdd).toHaveBeenCalledWith("http");
  });
});

describe("NodeInspectorModal", () => {
  const agent = node("agent", "agent");
  const code = node("code", "code");
  const inspectionGraph = graph([node("start", "trigger"), agent, code], [
    { id: "e1", source: "start", target: "agent" },
  ]);
  const lastStep = {
    id: "step",
    nodeId: "agent",
    status: "succeeded",
    input: { topic: "ventas" },
    output: { ok: true },
    durationMs: 42,
    model: "opencode-go/fast",
    agentId: "ventas/calificador",
    startedAt: new Date().toISOString(),
  };

  function renderInspector(overrides: Partial<React.ComponentProps<typeof NodeInspectorModal>> = {}) {
    const onConnect = vi.fn();
    const onStartCanvasConnect = vi.fn();
    const onDuplicate = vi.fn();
    const onRemove = vi.fn();
    const onConfig = vi.fn();
    const onPatch = vi.fn();
    const onReplaceConfig = vi.fn();
    render(
      <NodeInspectorModal
        node={agent}
        graph={inspectionGraph}
        agents={[]}
        models={[]}
        integrations={[]}
        destinations={[]}
        lastStep={lastStep}
        code=""
        codeDirty={false}
        issues={[]}
        onClose={vi.fn()}
        onPatch={onPatch}
        onConfig={onConfig}
        onReplaceConfig={onReplaceConfig}
        onCodeChange={vi.fn()}
        onSaveCode={vi.fn()}
        onEnableDecisionCode={vi.fn()}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onConnect={onConnect}
        onStartCanvasConnect={onStartCanvasConnect}
        onChangeEdgeCondition={vi.fn()}
        onDeleteEdge={vi.fn()}
        {...overrides}
      />,
    );
    return { onConnect, onStartCanvasConnect, onDuplicate, onRemove, onConfig, onPatch, onReplaceConfig };
  }

  it("edits database node settings and validates statement JSON", async () => {
    const user = userEvent.setup();
    const database = node("db", "database", {
      config: { integrationId: "", mode: "read", statements: [{ sql: "select 1" }] },
    });
    const integration: IntegrationRecord = {
      id: "db1",
      scope: "project",
      projectSlug: "p1",
      kind: "sqlite",
      name: "CRM",
      slug: "crm",
      config: {},
      secretRefs: {},
      capabilities: ["query"],
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { onConfig } = renderInspector({
      node: database,
      graph: graph([node("start", "trigger"), database]),
      integrations: [integration],
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: db" });
    await chooseOption(user, "Integración de base de datos", /CRM · sqlite/);
    expect(onConfig).toHaveBeenCalledWith({ integrationId: "db1" });
    await chooseOption(user, "Modo", "Escritura");
    expect(onConfig).toHaveBeenCalledWith({ mode: "write" });
    const statements = within(dialog).getByLabelText("Sentencias SQL (JSON)");
    fireEvent.change(statements, { target: { value: '[{"sql":"select 2"}]' } });
    expect(onConfig).toHaveBeenCalledWith({ statements: [{ sql: "select 2" }] });
    fireEvent.change(statements, { target: { value: "not json" } });
    expect(within(dialog).getByText(/Unexpected token|JSON inválido/)).toBeInTheDocument();
  });

  it("edits notify node settings and only offers outbound channels", async () => {
    const user = userEvent.setup();
    const notify = node("notify", "notify", { config: { integrationId: "", text: "Hola" } });
    const now = new Date().toISOString();
    const telegram: IntegrationRecord = {
      id: "tg1",
      scope: "project",
      projectSlug: "p1",
      kind: "telegram",
      name: "Telegram",
      slug: "telegram",
      config: {},
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    };
    const databaseOnly: IntegrationRecord = {
      ...telegram,
      id: "db1",
      kind: "sqlite",
      name: "DB",
      slug: "db",
      capabilities: ["query"],
    };
    const { onConfig } = renderInspector({
      node: notify,
      graph: graph([node("start", "trigger"), notify]),
      integrations: [telegram, databaseOnly],
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: notify" });
    const channel = within(dialog).getByRole("combobox", { name: "Canal de salida" });
    expect(channel).toHaveValue("Selecciona una integración");
    await user.click(channel);
    expect(screen.queryByRole("option", { name: /DB/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Telegram · telegram/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await chooseOption(user, "Canal de salida", /Telegram · telegram/);
    expect(onConfig).toHaveBeenCalledWith({ integrationId: "tg1" });
    fireEvent.change(within(dialog).getByLabelText(/Destinatario/), { target: { value: "123" } });
    expect(onConfig).toHaveBeenCalledWith({ recipient: "123" });
    fireEvent.change(within(dialog).getByLabelText("Mensaje"), { target: { value: "Hola {{input.nombre}}" } });
    expect(onConfig).toHaveBeenCalledWith({ text: "Hola {{input.nombre}}" });
  });

  it("configures a transcribe node connection and media path", async () => {
    const user = userEvent.setup();
    const asr: IntegrationRecord = {
      id: "asr1",
      scope: "project",
      projectSlug: "p1",
      kind: "transcription",
      name: "ASR local",
      slug: "asr-local",
      config: { baseUrl: "http://transcription:8000/v1", model: "small", models: ["small", "base"] },
      secretRefs: {},
      capabilities: ["transcribe_audio"],
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const transcribe = node("transcribe", "transcribe", { config: { mediaPath: "attachments" } });
    const { onConfig } = renderInspector({
      node: transcribe,
      graph: graph([node("start", "trigger"), transcribe], [{ id: "e1", source: "start", target: "transcribe" }]),
      integrations: [asr],
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: transcribe" });
    await chooseOption(user, "Conexión de transcripción", /ASR local · transcription/);
    expect(onConfig).toHaveBeenCalledWith({ integrationId: "asr1" });
    fireEvent.change(within(dialog).getByLabelText("Ruta de los audios en el input"), {
      target: { value: "media" },
    });
    expect(onConfig).toHaveBeenCalledWith({ mediaPath: "media" });
  });

  it("accepts audio on an integration trigger", async () => {
    const trigger = node("start", "trigger", {
      config: { kind: "integration", integrationId: "tg1", event: "message.received", accepts: ["text"] },
    });
    const { onConfig } = renderInspector({
      node: trigger,
      graph: graph([trigger]),
      integrations: [],
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: start" });
    await userEvent.click(within(dialog).getByLabelText("Audio"));
    expect(onConfig).toHaveBeenCalledWith({ accepts: ["text", "audio"] });
  });

  it("loads and edits the node error strategy", async () => {
    const user = userEvent.setup();
    const routed = {
      ...node("code", "code"),
      onError: { strategy: "route" as const, target: "agent" },
    };
    const { onPatch } = renderInspector({
      node: routed,
      graph: inspectionGraph,
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: code" });
    const target = within(dialog).getByRole("combobox", { name: "Nodo de error" });
    expect(target).toHaveTextContent("agent");
    await user.click(target);
    expect(screen.queryByRole("option", { name: "code" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await chooseOption(user, "Si falla", "Detener el run");
    expect(onPatch).toHaveBeenCalledWith({ onError: undefined });
  });

  it("shows schedule timezone, overlap, catch-up and next run", async () => {
    const user = userEvent.setup();
    const scheduled = node("start", "trigger", {
      config: {
        kind: "schedule",
        cron: "0 9 * * *",
        timezone: "America/Mexico_City",
        enabled: true,
        overlapPolicy: "skip",
        catchUp: false,
      },
    });
    const { onConfig } = renderInspector({
      node: scheduled,
      graph: graph([scheduled]),
      lastStep: undefined,
      scheduleNextRun: "2026-11-02T15:00:00.000Z",
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: start" });
    expect(within(dialog).getByLabelText("Zona horaria (IANA)")).toHaveValue("America/Mexico_City");
    expect(within(dialog).getByText(/Próxima ejecución/)).toBeInTheDocument();
    await chooseOption(user, "Solapamiento", "Permitir solapamiento");
    expect(onConfig).toHaveBeenCalledWith({ overlapPolicy: "allow" });
  });

  it("offers the HTTP integration and secret syntax in the inspector", async () => {
    const user = userEvent.setup();
    const httpNode = node("http", "http");
    const now = new Date().toISOString();
    const httpIntegration: IntegrationRecord = {
      id: "api1",
      scope: "project",
      projectSlug: "p1",
      kind: "http",
      name: "API",
      slug: "api",
      config: { baseUrl: "https://api.example.com" },
      secretRefs: {},
      capabilities: [],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    };
    const { onConfig } = renderInspector({
      node: httpNode,
      graph: graph([node("start", "trigger"), httpNode]),
      integrations: [httpIntegration],
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: http" });
    await chooseOption(user, "Integración HTTP (opcional)", /API · http/);
    expect(onConfig).toHaveBeenCalledWith({ integrationId: "api1" });
    expect(within(dialog).getByText(/secret:alias/)).toBeInTheDocument();
  });

  it("shows one-off schedule and durable delay fields", async () => {
    const once = node("start", "trigger", {
      config: { kind: "schedule", mode: "once", runAt: "2026-11-05T15:00:00.000Z" },
    });
    const { rerender } = render(
      <NodeInspectorModal
        node={once}
        graph={graph([once])}
        agents={[]}
        models={[]}
        integrations={[]}
        destinations={[]}
        code=""
        codeDirty={false}
        issues={[]}
        onClose={vi.fn()}
        onPatch={vi.fn()}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onCodeChange={vi.fn()}
        onSaveCode={vi.fn()}
        onEnableDecisionCode={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onConnect={vi.fn()}
        onStartCanvasConnect={vi.fn()}
        onChangeEdgeCondition={vi.fn()}
        onDeleteEdge={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Fecha y hora (ISO)")).toHaveValue("2026-11-05T15:00:00.000Z");
    const delay = node("wait", "delay", { config: { waitUntil: "2026-11-05T15:00:00.000Z" } });
    rerender(
      <NodeInspectorModal
        node={delay}
        graph={graph([node("start", "trigger"), delay])}
        agents={[]}
        models={[]}
        integrations={[]}
        destinations={[]}
        code=""
        codeDirty={false}
        issues={[]}
        onClose={vi.fn()}
        onPatch={vi.fn()}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onCodeChange={vi.fn()}
        onSaveCode={vi.fn()}
        onEnableDecisionCode={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onConnect={vi.fn()}
        onStartCanvasConnect={vi.fn()}
        onChangeEdgeCondition={vi.fn()}
        onDeleteEdge={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Esperar hasta (ISO, durable)")).toHaveValue("2026-11-05T15:00:00.000Z");
  });

  it("shows settings, connections with invalid targets disabled, and execution context", async () => {
    const user = userEvent.setup();
    const { onConnect } = renderInspector();
    const dialog = screen.getByRole("dialog", { name: "Nodo: agent" });
    expect(dialog.className).toContain("max-w-5xl");

    expect(within(dialog).getByLabelText("Etiqueta")).toHaveValue("agent");
    await user.click(within(dialog).getByRole("tab", { name: "Conexiones" }));
    const target = within(dialog).getByRole("combobox", { name: "Nodo destino" });
    await user.click(target);
    expect(screen.getByRole("option", { name: /start/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /code/ })).not.toHaveAttribute("aria-disabled");
    await user.keyboard("{Escape}");
    await chooseOption(user, "Nodo destino", /code/);
    await user.click(within(dialog).getByRole("button", { name: "Conectar" }));
    expect(onConnect).toHaveBeenCalledWith("agent", "code", undefined);

    await userEvent.click(within(dialog).getByRole("tab", { name: "Ejecución" }));
    expect(within(dialog).getAllByText("Completado").length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/"ok": true/)).toBeInTheDocument();
  });

  it("shows the empty execution state and runs duplicate/delete actions", async () => {
    const { onDuplicate, onRemove } = renderInspector({ lastStep: undefined });
    const dialog = screen.getByRole("dialog", { name: "Nodo: agent" });
    await userEvent.click(within(dialog).getByRole("tab", { name: "Ejecución" }));
    expect(within(dialog).getByText(/todavía no tiene una ejecución/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Duplicar" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(onDuplicate).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it("resets incompatible trigger config after the kind change is confirmed", async () => {
    const user = userEvent.setup();
    const trigger = node("start", "trigger", {
      config: { kind: "integration", integrationId: "tg1", event: "message.received" },
    });
    const { onReplaceConfig } = renderInspector({
      node: trigger,
      graph: graph([trigger]),
      lastStep: undefined,
    });
    await chooseOption(user, "Entrada del flujo", "Manual (canvas / formulario)");
    expect(onReplaceConfig).not.toHaveBeenCalled();
    const confirmDialog = screen.getByRole("dialog", { name: "Cambiar el tipo de trigger" });
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Cambiar tipo" }));
    expect(onReplaceConfig).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "manual" }),
    );
    expect(onReplaceConfig.mock.calls[0]?.[0]).not.toHaveProperty("integrationId");
  });

  it("shows inline errors for incomplete node configuration", () => {
    const database = node("db", "database", { config: {} });
    renderInspector({
      node: database,
      graph: graph([node("start", "trigger"), database]),
      lastStep: undefined,
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: db" });
    expect(within(dialog).getAllByText(/obligatorio|Required/).length).toBeGreaterThan(0);
  });

  it("starts the canvas connection mode with the chosen decision branch", async () => {
    const decision = node("decision", "decision");
    const decisionGraph = graph(
      [node("start", "trigger"), decision, node("yes", "code"), node("no", "code")],
      [
        { id: "e1", source: "start", target: "decision" },
        { id: "e2", source: "decision", target: "yes", condition: "true" },
        { id: "e3", source: "decision", target: "no", condition: "false" },
      ],
    );
    const { onStartCanvasConnect } = renderInspector({ node: decision, graph: decisionGraph, lastStep: undefined });
    const dialog = screen.getByRole("dialog", { name: "Nodo: decision" });
    await userEvent.click(within(dialog).getByRole("tab", { name: "Conexiones" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "no" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Conectar en el canvas" }));
    expect(onStartCanvasConnect).toHaveBeenCalledWith("decision", "false");
  });
});

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

describe("ProjectTopBar", () => {
  const flowGraph = graph([node("start", "trigger")]);
  const versions = [
    {
      id: "v1",
      projectSlug: "demo",
      version: 1,
      graphHash: "h1",
      graph: flowGraph,
      codeBundle: {},
      createdBy: "admin",
      createdAt: new Date().toISOString(),
    },
  ];

  function renderTopBar(tab: ProjectTab, extra: Partial<React.ComponentProps<typeof ProjectTopBar>> = {}) {
    return render(
      <MemoryRouter initialEntries={[`/projects/demo/${tab}`]}>
        <LocationProbe />
        <ProjectTopBar
          slug="demo"
          graph={flowGraph}
          tab={tab}
          counts={{ runs: 2, agents: 1, integrations: 3 }}
          dirty={false}
          issueCount={0}
          saving={false}
          models={[{ providerID: "opencode-go", modelID: "fast", name: "Fast" }]}
          versions={versions}
          onChange={() => undefined}
          onSave={() => undefined}
          onRun={() => undefined}
          onChat={() => undefined}
          onRollbackVersion={() => undefined}
          {...extra}
        />
      </MemoryRouter>,
    );
  }

  it("renders the sections as route links, navigates on click and reports guarded targets", async () => {
    const first = renderTopBar("flow");
    for (const label of ["Resumen", "Flujo", "Ejecuciones (2)", "Agentes (1)", "Conocimiento", "Integraciones (3)", "Ajustes"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    const flowLink = screen.getByRole("link", { name: "Flujo" });
    expect(flowLink).toHaveAttribute("href", "/projects/demo/flow");
    expect(flowLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Resumen" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Guardar flujo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ejecutar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agente" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Agentes (1)" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/agents");
    first.unmount();

    const onNavigateBlocked = vi.fn();
    renderTopBar("agents", { navigationBlocked: true, onNavigateBlocked });
    await userEvent.click(screen.getByRole("link", { name: "Resumen" }));
    expect(onNavigateBlocked).toHaveBeenCalledWith("/projects/demo/overview");
    await userEvent.click(screen.getByRole("link", { name: "← Proyectos" }));
    expect(onNavigateBlocked).toHaveBeenCalledWith("/projects");
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/agents");
  });

  it("keeps the versions and flow settings actions wired", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onRun = vi.fn();
    const onChat = vi.fn();
    const onRollbackVersion = vi.fn();
    renderTopBar("flow", { dirty: true, onChange, onSave, onRun, onChat, onRollbackVersion });

    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Versiones del flujo/ }));
    const versionsDialog = screen.getByRole("dialog", { name: "Versiones del flujo" });
    await userEvent.click(within(versionsDialog).getByRole("button", { name: "Restaurar v1" }));
    const rollbackDialog = screen.getByRole("dialog", { name: "Restaurar v1" });
    expect(onRollbackVersion).not.toHaveBeenCalled();
    await userEvent.click(within(rollbackDialog).getByRole("button", { name: "Restaurar v1" }));
    expect(onRollbackVersion).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ajustes del flujo" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes del flujo" });
    await userEvent.type(within(dialog).getByLabelText("Descripción"), " nuevo");
    expect(onChange).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ejecutar" }));
    await userEvent.click(screen.getByRole("button", { name: "Agente" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));
    expect(onRun).toHaveBeenCalled();
    expect(onChat).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });

  it("labels model choices from the catalogue and emits the provider/model ref", async () => {
    const onChange = vi.fn();
    renderTopBar("flow", { onChange });
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ajustes del flujo" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes del flujo" });
    const picker = within(dialog).getByRole("combobox", { name: "Modelo por defecto" });
    expect(picker).toHaveTextContent("Heredar del flujo");

    await userEvent.click(picker);
    expect(screen.getByRole("option", { name: /^Fast opencode-go\/fast/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^opencode-go\/fast/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("option", { name: /^Fast opencode-go\/fast/ }));
    expect(onChange).toHaveBeenCalledWith({ defaultModel: "opencode-go/fast" });
  });

  it("drops the native select for the shared picker", async () => {
    renderTopBar("flow");
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ajustes del flujo" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes del flujo" });
    expect(dialog.querySelector("select")).toBeNull();
    expect(dialog.querySelector("option")).toBeNull();
    expect(within(dialog).getAllByRole("combobox")).toHaveLength(1);
  });

  it("keeps a saved default model that is absent from an empty catalogue", async () => {
    const onChange = vi.fn();
    renderTopBar("flow", { models: [], graph: { ...flowGraph, defaultModel: "opencode-go/legacy" }, onChange });
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ajustes del flujo" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes del flujo" });
    const picker = within(dialog).getByRole("combobox", { name: "Modelo por defecto" });
    expect(picker).toHaveTextContent("opencode-go/legacy");

    await userEvent.click(picker);
    const saved = screen.getByRole("option", { name: /opencode-go\/legacy/ });
    expect(saved).toHaveTextContent("no disponible");
    await userEvent.click(screen.getByRole("option", { name: /Heredar del flujo/ }));
    expect(onChange).toHaveBeenCalledWith({ defaultModel: undefined });
  });

  it("keeps every flow action in one non-scrolling cluster and collapses its labels below sm", () => {
    renderTopBar("flow", { dirty: true, issueCount: 2 });
    const bar = screen.getByTestId("project-top-bar");
    // Narrow: two rows (breadcrumb, then tabs + actions). Desktop: the unchanged single h-14 row.
    expect(bar.className).toContain("flex-col");
    expect(bar.className).toContain("sm:h-14");
    expect(bar.className).toContain("sm:flex-row");

    const actions = screen.getByTestId("top-bar-actions");
    expect(actions.className).toContain("shrink-0");
    expect(actions.className).not.toMatch(/overflow/);
    for (const name of ["Más acciones del flujo", "Guardar flujo", "Ejecutar", "Agente"]) {
      expect(within(actions).getByRole("button", { name })).toBeInTheDocument();
    }

    // Icon-only collapse keeps the accessible name, so the actions stay operable on a phone.
    for (const name of ["Guardar flujo", "Ejecutar", "Agente"]) {
      const button = within(actions).getByRole("button", { name });
      expect(button).toHaveAttribute("aria-label", name);
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.querySelector(".sm\\:hidden")).not.toBeNull();
    }

    // Only the tab strip scrolls; the actions never hide behind an overflow.
    const nav = screen.getByRole("navigation", { name: "Secciones del proyecto" });
    expect(nav.className).toContain("overflow-x-auto");
    expect(within(nav).queryByRole("button")).toBeNull();
    expect(within(actions).getByText(/^2$/)).toBeInTheDocument();
  });

  it("anchors the overflow menu inside the viewport below sm", async () => {
    renderTopBar("flow");
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    const menu = await screen.findByRole("menu", { name: "Más acciones del flujo" });
    const bar = screen.getByTestId("project-top-bar");
    const actions = screen.getByTestId("top-bar-actions");

    // The panel is 210px wide. Below `sm` its right edge is anchored to the actions
    // cluster (`right-0`), and the cluster's right edge sits on the header's 12px
    // padding, so at 320px the panel spans 98..308 - inside the viewport with >8px
    // to spare. jsdom performs no layout, so the guarantee is asserted by the
    // classes that build that anchor: static wrapper, positioned cluster, right-0.
    expect(menu.className).toContain("right-0");
    expect(menu.className).toContain("min-w-[210px]");
    expect(menu.parentElement?.className).toContain("max-sm:static");
    expect(actions.className).toContain("max-sm:relative");
    expect(bar.className).toContain("px-3");

    // Desktop anchoring is untouched: the wrapper stays `relative` for `sm` and up.
    expect(menu.parentElement?.className).toContain("relative");
  });

  it("saves with Ctrl/Cmd+S only when the draft is dirty and the graph is valid", () => {
    const onSave = vi.fn();
    const first = renderTopBar("flow", { dirty: true, onSave });
    expect(screen.getByRole("status", { name: "Cambios sin guardar" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "s", ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderTopBar("flow", { dirty: false, onSave });
    fireEvent.keyDown(document, { key: "s", metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    second.unmount();

    renderTopBar("flow", { dirty: true, issueCount: 2, onSave });
    expect(screen.getByText("2 problemas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar flujo" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "s", metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("opens the overflow menu with the keyboard and closes it with Escape", async () => {
    renderTopBar("flow");

    const trigger = screen.getByRole("button", { name: "Más acciones del flujo" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu", { name: "Más acciones del flujo" });
    const firstItem = within(menu).getByRole("menuitem", { name: /Versiones del flujo/ });
    await waitFor(() => expect(firstItem).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
