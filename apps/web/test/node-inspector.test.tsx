import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type {
  IntegrationRecord,
  NodeSpec,
  ProjectDestination,
  SubagentProfile,
  WorkflowGraph,
  WorkflowVersion,
} from "@platform/shared";
import type { ModelInfo, NotebookSummary, StepRun } from "../src/api.ts";
import { chooseOption, renderWithProviders } from "./render.tsx";
import { NodeConfigFields } from "../src/components/NodeConfigFields.tsx";
import { NodeInspector } from "../src/components/NodeInspector.tsx";
import { NodeInspectorModal } from "../src/components/NodeInspectorModal.tsx";
import { ProjectFlowPage } from "../src/pages/ProjectFlowPage.tsx";
import { ProjectWorkspaceProvider } from "../src/pages/project-workspace.tsx";

const apiMock = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  listSchedules: vi.fn(),
  listRuns: vi.fn(),
  listAgents: vi.fn(),
  listModels: vi.fn(),
  chatHistory: vi.fn(),
  listIntegrations: vi.fn(),
  getProjectSettings: vi.fn(),
  listDestinations: vi.fn(),
  listWorkflowVersions: vi.fn(),
  listNotebooks: vi.fn(),
  readNode: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

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

const speech: IntegrationRecord = {
  id: "tts1",
  scope: "project",
  projectSlug: "p1",
  kind: "speech",
  name: "Voz local",
  slug: "voz-local",
  config: { voice: "ef_dora", voices: ["ef_dora", "em_alex", "em_santa"], models: ["kokoro", "piper"] },
  secretRefs: {},
  capabilities: ["synthesize_speech"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};

const destinations: ProjectDestination[] = [
  {
    id: "dst-telegram",
    projectSlug: "p1",
    kind: "telegram_chat",
    label: "Familia",
    value: "123456",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "dst-whatsapp",
    projectSlug: "p1",
    kind: "whatsapp",
    label: "Soporte",
    value: "+34600000000",
    createdAt: now,
    updatedAt: now,
  },
];

const graph: WorkflowGraph = {
  version: 1,
  id: "wf1",
  name: "Flujo",
  description: "",
  nodes: [node({ kind: "manual" })],
  edges: [],
  updatedAt: now,
};

const versions: WorkflowVersion[] = [1, 2].map((version) => ({
  id: `wv-${version}`,
  projectSlug: "p1",
  version,
  graphHash: `hash-${version}`,
  graph,
  codeBundle: {},
  createdAt: now,
}));

function node(config: Record<string, unknown>, type: NodeSpec["type"] = "trigger"): NodeSpec {
  return {
    id: "start",
    type,
    position: { x: 0, y: 0 },
    config,
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
  };
}

describe("NodeConfigFields", () => {
  it("renders the trigger fields from the shared registry", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "manual" })}
        integrations={[telegram]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Entrada del flujo")).toBeInTheDocument();
    expect(screen.getByText("Datos de entrada")).toBeInTheDocument();
  });

  it("asks for confirmation before replacing incompatible trigger config", async () => {
    const user = userEvent.setup();
    const onReplaceConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "integration", integrationId: "tg1", event: "message.received" })}
        integrations={[telegram]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={onReplaceConfig}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    await chooseOption(user, "Entrada del flujo", "Manual (canvas / formulario)");
    const dialog = await screen.findByRole("dialog", { name: "Cambiar el tipo de trigger" });
    expect(onReplaceConfig).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cambiar tipo" }));
    expect(onReplaceConfig).toHaveBeenCalledWith(expect.objectContaining({ kind: "manual" }));
    expect(onReplaceConfig.mock.calls[0]?.[0]).not.toHaveProperty("integrationId");
  });

  it("selects a discovered voice for a speak node", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ integrationId: "tts1" }, "speak")}
        integrations={[speech]}
        destinations={[]}
        onConfig={onConfig}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const voice = screen.getByRole("combobox", { name: "Voz (override)" });
    expect(voice).toHaveValue("Heredar de la conexión");
    const model = screen.getByRole("combobox", { name: "Modelo (override)" });
    expect(model).toHaveValue("Heredar de la conexión");
    await chooseOption(user, "Modelo (override)", "piper");
    expect(onConfig).toHaveBeenCalledWith({ model: "piper" });
    await chooseOption(user, "Voz (override)", "em_alex");
    expect(onConfig).toHaveBeenCalledWith({ voice: "em_alex" });
  });

  it("picks a voice and a model outside the connection catalogue by mouse and by keyboard", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    function Harness() {
      const [config, setConfig] = useState<Record<string, unknown>>({ integrationId: "tts-bare" });
      return (
        <NodeConfigFields
          node={node(config, "speak")}
          integrations={[{ ...speech, id: "tts-bare", config: {} }]}
          destinations={[]}
          versions={[]}
          onConfig={(patch) => {
            onConfig(patch);
            setConfig((current) => ({ ...current, ...patch }));
          }}
          onReplaceConfig={vi.fn()}
          onEnableDecisionCode={vi.fn()}
        />
      );
    }
    renderWithProviders(<Harness />);

    const model = screen.getByRole("combobox", { name: "Modelo (override)" });
    await user.click(model);
    await user.type(model, "voz-custom");
    await user.click(screen.getByRole("option", { name: "Usar «voz-custom»" }));
    expect(onConfig).toHaveBeenCalledWith({ model: "voz-custom" });
    expect(model).toHaveValue("voz-custom");

    const voice = screen.getByRole("combobox", { name: "Voz (override)" });
    await user.click(voice);
    await user.type(voice, "em_santa");
    await user.keyboard("{Enter}");
    expect(onConfig).toHaveBeenCalledWith({ voice: "em_santa" });
    expect(voice).toHaveValue("em_santa");
  });

  it("picks a notify destination from the catalogue by mouse and by keyboard", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    function Harness() {
      const [config, setConfig] = useState<Record<string, unknown>>({ integrationId: "tg1", text: "Hola" });
      return (
        <NodeConfigFields
          node={node(config, "notify")}
          integrations={[telegram]}
          destinations={destinations}
          versions={versions}
          onConfig={(patch) => {
            onConfig(patch);
            setConfig((current) => ({ ...current, ...patch }));
          }}
          onReplaceConfig={vi.fn()}
          onEnableDecisionCode={vi.fn()}
        />
      );
    }
    renderWithProviders(<Harness />);

    await chooseOption(user, "Destinatario", "Familia · 123456");
    expect(onConfig).toHaveBeenCalledWith({ recipient: "dst-telegram" });
    expect(screen.getByRole("combobox", { name: "Destinatario" })).toHaveValue("Familia · 123456");

    const recipient = screen.getByRole("combobox", { name: "Destinatario" });
    await user.click(recipient);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onConfig).toHaveBeenCalledWith({ recipient: "dst-whatsapp" });
    expect(recipient).toHaveValue("Soporte · +34600000000");
  });

  it("picks a subflow version from the catalogue by mouse and by keyboard", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    function Harness() {
      const [config, setConfig] = useState<Record<string, unknown>>({ versionId: "wv-1" });
      return (
        <NodeConfigFields
          node={node(config, "subworkflow")}
          integrations={[]}
          destinations={[]}
          versions={versions}
          onConfig={(patch) => {
            onConfig(patch);
            setConfig((current) => ({ ...current, ...patch }));
          }}
          onReplaceConfig={vi.fn()}
          onEnableDecisionCode={vi.fn()}
        />
      );
    }
    renderWithProviders(<Harness />);

    await chooseOption(user, "Versión del subflujo", /^v2/);
    expect(onConfig).toHaveBeenCalledWith({ versionId: "wv-2" });
    expect(screen.getByRole("combobox", { name: "Versión del subflujo" })).toHaveValue("v2");

    const version = screen.getByRole("combobox", { name: "Versión del subflujo" });
    await user.click(version);
    await user.type(version, "v1");
    await user.keyboard("{Enter}");
    expect(onConfig).toHaveBeenCalledWith({ versionId: "wv-1" });
    expect(version).toHaveValue("v1");
  });

  it("keeps a saved destination the catalogue no longer offers and re-emits it unchanged", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ integrationId: "tg1", text: "Hola", recipient: "legacy-dest" }, "notify")}
        integrations={[telegram]}
        destinations={destinations}
        versions={versions}
        onConfig={onConfig}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const recipient = screen.getByRole("combobox", { name: "Destinatario" });
    expect(recipient).toHaveValue("legacy-dest");
    await user.click(recipient);
    await user.click(screen.getByRole("option", { name: /legacy-dest.*no disponible/ }));
    expect(onConfig).toHaveBeenCalledWith({ recipient: "legacy-dest" });
  });

  it("clears the speech model back to the inherited one with undefined", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    function Harness() {
      const [config, setConfig] = useState<Record<string, unknown>>({ integrationId: "tts1", model: "piper" });
      return (
        <NodeConfigFields
          node={node(config, "speak")}
          integrations={[speech]}
          destinations={[]}
          onConfig={(patch) => {
            onConfig(patch);
            setConfig((current) => ({ ...current, ...patch }));
          }}
          onReplaceConfig={vi.fn()}
          onEnableDecisionCode={vi.fn()}
        />
      );
    }
    renderWithProviders(<Harness />);
    expect(screen.getByRole("combobox", { name: "Modelo (override)" })).toHaveValue("piper");
    await chooseOption(user, "Modelo (override)", "Heredar de la conexión");
    expect(onConfig).toHaveBeenCalledWith({ model: undefined });
    expect(screen.getByRole("combobox", { name: "Modelo (override)" })).toHaveValue("Heredar de la conexión");
  });

  it("changes an input-schema field type and emits the whole schema", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "manual", inputSchema: { fields: [{ name: "tema", type: "string", required: true }] } })}
        integrations={[]}
        destinations={[]}
        onConfig={onConfig}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    await chooseOption(user, "Tipo 1", "número");
    expect(onConfig).toHaveBeenCalledWith({
      inputSchema: { fields: [{ name: "tema", type: "number", required: true }] },
    });
  });

  it("changes a validate rule type and emits the rules array", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ rules: [{ name: "tema", type: "string", required: true }] }, "validate")}
        integrations={[]}
        destinations={[]}
        onConfig={onConfig}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    await chooseOption(user, "Tipo de regla 1", "booleano");
    expect(onConfig).toHaveBeenCalledWith({ rules: [{ name: "tema", type: "boolean", required: true }] });
  });

  it("renders no picker for a field whose schema has no enum", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "manual" })}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const timezone = screen.getByLabelText("Zona horaria (IANA)");
    expect(timezone.tagName).toBe("INPUT");
    expect(screen.queryByRole("combobox", { name: "Zona horaria (IANA)" })).not.toBeInTheDocument();
  });

  it("keeps a saved enum value the catalogue no longer offers visible", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "schedule", overlapPolicy: "legacy-rule" })}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const overlap = screen.getByRole("combobox", { name: "Solapamiento" });
    expect(overlap).toHaveTextContent("legacy-rule");
    await user.click(overlap);
    expect(screen.getByRole("option", { name: /legacy-rule/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("shows inline validation for incomplete configurations", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "database")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/obligatorio|Required/).length).toBeGreaterThan(0);
  });

  it("associates the required URL error with its input", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "http")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("URL");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(described).toContain("node-config-url-error");
    for (const id of described) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(document.getElementById("node-config-url-error")).toHaveTextContent("Este campo es obligatorio.");
  });

  it("associates the missing database integration error with its picker", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "database")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Integración de base de datos");
    expect(select).toHaveAttribute("aria-invalid", "true");
    const described = (select.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(described).toContain("node-config-integrationId-error");
    for (const id of described) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("keeps the integration picker and its error usable without a catalogue", async () => {
    const user = userEvent.setup();
    const onConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "database")}
        integrations={[]}
        destinations={[]}
        onConfig={onConfig}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const picker = screen.getByRole("combobox", { name: "Integración de base de datos" });
    expect(picker).toHaveValue("Selecciona una integración");
    await user.click(picker);
    const empty = screen.getByRole("option", { name: "Selecciona una integración" });
    await user.click(empty);
    expect(onConfig).toHaveBeenCalledWith({ integrationId: undefined });
  });

  it("attaches no error id when the config is valid", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({ method: "GET", url: "https://api.example.com", headers: "{}", body: "" }, "http")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("URL");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input.getAttribute("aria-describedby") ?? "").not.toContain("node-config-url-error");
    expect(document.getElementById("node-config-url-error")).toBeNull();
  });
});

const agents: SubagentProfile[] = [
  {
    category: "ventas",
    role: "calificador",
    frontmatter: { description: "Califica leads", mode: "subagent", permissions: [], notebooks: [] },
    body: "Eres un especialista.",
  },
  {
    category: "soporte",
    role: "triaje",
    frontmatter: { description: "Triaje de soporte", mode: "subagent", permissions: [], notebooks: [] },
    body: "Eres un especialista.",
  },
];

const models: ModelInfo[] = [
  { providerID: "opencode", modelID: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", input: ["text", "image"] },
  { providerID: "local", modelID: "texto-plano", name: "Texto plano", input: ["text"] },
];

const catalogue: NotebookSummary[] = [
  { id: "n1", projectSlug: "p1", slug: "politicas", name: "Políticas", description: "", sources: 0, createdAt: now },
  { id: "n2", projectSlug: "p1", slug: "onboarding", name: "Onboarding", description: "", sources: 0, createdAt: now },
];

function inspectorNode(extra: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: "calificar",
    type: "agent",
    label: "Calificar",
    position: { x: 0, y: 0 },
    config: {},
    agentId: "ventas/calificador",
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
    ...extra,
  };
}

/**
 * `onPatch` echoes back into state exactly like the canvas does, so a controlled
 * picker sees the value it just emitted on the next render.
 */
function renderInspector({
  initial = inspectorNode(),
  nodes = [initial],
  models: modelCatalogue = models,
  notebooks = catalogue,
}: {
  readonly initial?: NodeSpec;
  readonly nodes?: NodeSpec[];
  readonly models?: ModelInfo[];
  readonly notebooks?: NotebookSummary[];
} = {}) {
  const onPatch = vi.fn();
  function Harness() {
    const [current, setCurrent] = useState<NodeSpec>(initial);
    return (
      <NodeInspector
        node={current}
        nodes={nodes}
        agents={agents}
        models={modelCatalogue}
        notebooks={notebooks}
        integrations={[]}
        destinations={[]}
        code=""
        codeDirty={false}
        onPatch={(patch) => {
          onPatch(patch);
          setCurrent((previous) => ({ ...previous, ...patch }));
        }}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onCodeChange={vi.fn()}
        onSaveCode={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />
    );
  }
  renderWithProviders(<Harness />);
  return { onPatch };
}

describe("NodeInspector pickers", () => {
  it("picks the node model from the catalogue and emits its reference", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderInspector();
    expect(screen.getByRole("combobox", { name: "Modelo del nodo" })).toHaveValue("Heredar del flujo");

    await chooseOption(user, "Modelo del nodo", /Texto plano/);

    expect(onPatch).toHaveBeenCalledWith({ modelOverride: "local/texto-plano" });
    expect(screen.getByRole("combobox", { name: "Modelo del nodo" })).toHaveValue("Texto plano");
  });

  it("writes undefined when the node inherits the flow model", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderInspector({ initial: inspectorNode({ modelOverride: "local/texto-plano" }) });

    await chooseOption(user, "Modelo del nodo", "Heredar del flujo");

    expect(onPatch).toHaveBeenCalledWith({ modelOverride: undefined });
    expect(screen.getByRole("combobox", { name: "Modelo del nodo" })).toHaveValue("Heredar del flujo");
  });

  it("keeps a saved model absent from the catalogue visible", async () => {
    const user = userEvent.setup();
    renderInspector({ initial: inspectorNode({ modelOverride: "proveedor/retirado" }) });
    const trigger = screen.getByRole("combobox", { name: "Modelo del nodo" });
    expect(trigger).toHaveValue("proveedor/retirado");

    await user.click(trigger);

    expect(screen.getByRole("option", { name: /proveedor\/retirado/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("keeps the model picker usable when the catalogue is empty", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderInspector({ models: [] });

    await chooseOption(user, "Modelo del nodo", "Heredar del flujo");

    expect(onPatch).toHaveBeenCalledWith({ modelOverride: undefined });
  });

  it("chooses the agent and clears it back to undefined", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderInspector();

    await chooseOption(user, "Agente", "soporte/triaje");
    expect(onPatch).toHaveBeenCalledWith({ agentId: "soporte/triaje" });
    expect(screen.getByRole("combobox", { name: "Agente" })).toHaveTextContent("soporte/triaje");

    await chooseOption(user, "Agente", "Selecciona un agente");
    expect(onPatch).toHaveBeenCalledWith({ agentId: undefined });
  });

  it("selects two notebooks and emits their slugs", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderInspector();

    await user.click(screen.getByRole("button", { name: "Añadir Notebooks" }));
    await user.click(await screen.findByRole("option", { name: /Políticas/ }));
    await user.click(screen.getByRole("option", { name: /Onboarding/ }));
    await user.keyboard("{Escape}");

    expect(onPatch).toHaveBeenNthCalledWith(1, { notebookIds: ["politicas"] });
    expect(onPatch).toHaveBeenNthCalledWith(2, { notebookIds: ["politicas", "onboarding"] });
    expect(screen.getByRole("button", { name: "Quitar Políticas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar Onboarding" })).toBeInTheDocument();
  });

  it("keeps a saved notebook absent from the catalogue as a removable chip", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderInspector({
      initial: inspectorNode({ notebookIds: ["manual-ventas"] }),
      notebooks: [],
    });
    const remove = screen.getByRole("button", { name: "Quitar manual-ventas" });

    await user.click(remove);

    expect(onPatch).toHaveBeenCalledWith({ notebookIds: [] });
    expect(screen.queryByRole("button", { name: "Quitar manual-ventas" })).not.toBeInTheDocument();
  });

  it("routes failures to another node and replaces the target when the strategy changes", async () => {
    const user = userEvent.setup();
    const routing = [
      inspectorNode({ id: "esperar", type: "delay", label: "Esperar", agentId: undefined, config: { ms: 1000 } }),
      inspectorNode({ id: "fin", type: "delay", label: "Fin", agentId: undefined, config: { ms: 1000 } }),
      inspectorNode({ id: "inicio", type: "trigger", label: "Inicio", agentId: undefined }),
    ];
    const { onPatch } = renderInspector({ initial: routing[0], nodes: routing });

    await chooseOption(user, "Si falla", "Derivar a otro nodo");
    expect(onPatch).toHaveBeenCalledWith({ onError: { strategy: "route", target: undefined } });
    expect(screen.getByText("Selecciona el nodo que recibirá el error.")).toBeInTheDocument();

    await chooseOption(user, "Nodo de error", "Fin");
    expect(onPatch).toHaveBeenCalledWith({ onError: { strategy: "route", target: "fin" } });
    expect(screen.queryByText("Selecciona el nodo que recibirá el error.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Nodo de error" }));
    expect(screen.queryByRole("option", { name: "Esperar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Inicio" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await chooseOption(user, "Si falla", "Continuar con el error");
    expect(onPatch).toHaveBeenCalledWith({ onError: { strategy: "continue" } });

    await chooseOption(user, "Si falla", "Detener el run");
    expect(onPatch).toHaveBeenCalledWith({ onError: undefined });
  });

  it("keeps the image-capability warning for a model without image input", () => {
    renderInspector({ initial: inspectorNode({ modelOverride: "local/texto-plano" }) });
    expect(screen.getByText(/no reporta entrada de imagen/)).toBeInTheDocument();
  });
});

/**
 * Regression: the page used to render the modal without the notebook catalogue, so the
 * picker could only show already-saved ids. This drives the real modal instead of
 * injecting the catalogue straight into `NodeInspector`.
 */
describe("NodeInspectorModal notebooks", () => {
  const saved = inspectorNode({ notebookIds: ["manual-ventas"] });
  const modalGraph: WorkflowGraph = {
    version: 1,
    id: "p1",
    name: "Demo",
    description: "",
    nodes: [saved, node({ kind: "manual" })],
    edges: [],
    updatedAt: now,
  };

  function renderModal(notebooks: readonly NotebookSummary[], lastStep?: StepRun) {
    const onPatch = vi.fn();
    renderWithProviders(
      <NodeInspectorModal
        node={saved}
        graph={modalGraph}
        agents={agents}
        models={models}
        notebooks={notebooks}
        lastStep={lastStep}
        integrations={[]}
        destinations={[]}
        code=""
        codeDirty={false}
        issues={[]}
        onClose={vi.fn()}
        onPatch={onPatch}
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
    return { onPatch };
  }

  it("keeps the execution preview in the body scroll instead of a nested one", async () => {
    const user = userEvent.setup();
    renderModal(catalogue, {
      id: "step-1",
      nodeId: saved.id,
      status: "succeeded",
      durationMs: 12,
      startedAt: now,
      input: { consulta: "hola" },
      output: { salida: "texto ".repeat(400) },
    });
    const dialog = screen.getByRole("dialog", { name: "Nodo: Calificar" });

    await user.click(within(dialog).getByRole("tab", { name: "Ejecución" }));

    const panel = within(dialog).getByRole("tabpanel");
    const scrollers = dialog.querySelectorAll(".overflow-auto");
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0]).toHaveAttribute("data-modal-body");
    for (const preview of panel.querySelectorAll("pre")) {
      expect(preview.className).not.toMatch(/max-h-|overflow/);
    }
  });

  it("adds a catalogue notebook the saved node config does not have", async () => {
    const user = userEvent.setup();
    const { onPatch } = renderModal(catalogue);
    const dialog = screen.getByRole("dialog", { name: "Nodo: Calificar" });

    await user.click(within(dialog).getByRole("button", { name: "Añadir Notebooks" }));
    await user.click(await screen.findByRole("option", { name: /Políticas/ }));

    expect(onPatch).toHaveBeenCalledWith({ notebookIds: ["manual-ventas", "politicas"] });
  });
});

/**
 * The regression lived in the caller: the flow page never loaded `qk.notebooks`, so the
 * modal received no catalogue. This renders the page the user actually opens.
 */
describe("ProjectFlowPage notebooks", () => {
  const baseGraph: WorkflowGraph = {
    version: 1,
    id: "p1",
    name: "Demo",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        label: "Inicio",
        position: { x: 0, y: 0 },
        config: { kind: "manual" },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [],
    updatedAt: now,
  };

  beforeEach(() => {
    for (const mock of Object.values(apiMock)) mock.mockReset();
    apiMock.getWorkflow.mockResolvedValue(baseGraph);
    apiMock.listSchedules.mockResolvedValue({ data: [] });
    apiMock.listRuns.mockResolvedValue({ data: [] });
    apiMock.listAgents.mockResolvedValue({ data: [] });
    apiMock.listModels.mockResolvedValue({ data: [] });
    apiMock.chatHistory.mockResolvedValue({ data: [] });
    apiMock.listIntegrations.mockResolvedValue({ data: [] });
    apiMock.listDestinations.mockResolvedValue({ data: [] });
    apiMock.listWorkflowVersions.mockResolvedValue({ data: [] });
    apiMock.readNode.mockResolvedValue({ code: "export default async function run() { return {}; }" });
    apiMock.getProjectSettings.mockResolvedValue({
      project: { id: "p1", slug: "p1", name: "Demo", description: "", createdAt: now },
      integrations: [],
      notebooks: [],
      readiness: [],
    });
    apiMock.listNotebooks.mockResolvedValue({ data: catalogue });
  });

  it("loads the catalogue for the flow page and adds a notebook to a new agent node", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ProjectWorkspaceProvider slug="p1">
          <ProjectFlowPage />
        </ProjectWorkspaceProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "+ Nodo" }));
    const palette = screen.getByRole("dialog", { name: "Agregar nodo" });
    await user.click(within(palette).getByRole("button", { name: /^Agente/ }));

    const dialog = await screen.findByRole("dialog", { name: "Nodo: Agente" });
    await user.click(within(dialog).getByRole("button", { name: "Añadir Notebooks" }));
    await user.click(await screen.findByRole("option", { name: /Onboarding/ }));

    expect(screen.getByRole("button", { name: "Quitar Onboarding" })).toBeInTheDocument();
    expect(apiMock.listNotebooks).toHaveBeenCalledWith("p1");
  });
});
