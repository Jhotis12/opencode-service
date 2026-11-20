import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}));

vi.mock("../src/api.ts", () => ({
  api: {
    getSettings: vi.fn().mockResolvedValue({
      data: {
        opencodeMode: "fake",
        sentryConfigured: false,
        providerConnected: true,
        defaultModel: "opencode-go/fast",
        orchestratorModel: "opencode-go/fast",
        dataDir: "/data",
      },
    }),
    getEffectiveConfig: vi.fn().mockResolvedValue({
      platform: [
        {
          key: "defaultModel",
          label: "Modelo por defecto",
          value: "opencode-go/fast",
          source: "plataforma",
          secret: false,
          editable: true,
          restartRequired: false,
        },
        {
          key: "sentryDsn",
          label: "Sentry DSN",
          value: "configured",
          source: "plataforma",
          secret: true,
          masked: "http…/1",
          editable: true,
          restartRequired: true,
        },
        {
          key: "opencodeMode",
          label: "Modo OpenCode",
          value: "fake",
          source: "entorno",
          secret: false,
          editable: false,
          restartRequired: false,
        },
      ],
    }),
    listSecrets: vi.fn().mockResolvedValue({ data: [{ alias: "setting:sentry_dsn", kind: "sentry_dsn", createdAt: new Date().toISOString() }] }),
    listModels: vi.fn().mockResolvedValue({
      data: [
        { providerID: "opencode-go", modelID: "fast", name: "Fast" },
        { providerID: "opencode-go", modelID: "vision", name: "Vision", input: ["text", "image"] },
      ],
    }),
    getWorkflow: vi.fn().mockResolvedValue({
      version: 1,
      id: "p1",
      name: "Ventas",
      description: "",
      nodes: [
        { id: "start", type: "trigger", label: "Inicio", position: { x: 0, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
      ],
      edges: [],
      updatedAt: new Date().toISOString(),
    }),
    listSchedules: vi.fn().mockResolvedValue({ data: [] }),
    listRuns: vi.fn().mockResolvedValue({ data: [] }),
    listAgents: vi.fn().mockResolvedValue({ data: [] }),
    chatHistory: vi.fn().mockResolvedValue({ data: [] }),
    listWorkflowVersions: vi.fn().mockResolvedValue({ data: [] }),
    controlIntegrations: vi.fn().mockResolvedValue({
      data: [
        {
          id: "i1",
          scope: "global",
          kind: "telegram",
          name: "Alertas admin",
          slug: "alertas-admin",
          config: { routing: { mode: "agent", allowlist: [], public: false }, alerts: ["run.failed"] },
          secretRefs: {},
          capabilities: ["inbound_message", "outbound_message"],
          status: "connected",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    createControlIntegration: vi.fn(),
    updateControlIntegration: vi.fn(),
    deleteControlIntegration: vi.fn(),
    testControlIntegration: vi.fn().mockResolvedValue({ ok: true }),
    connectControlIntegration: vi.fn(),
    disconnectControlIntegration: vi.fn(),
    clearControlIntegrationWebhook: vi.fn(),
    controlIntegrationQr: vi.fn(),
    saveSettings: vi.fn(),
    saveSecret: vi.fn(),
    connectProvider: vi.fn(),
    listNotebooks: vi.fn().mockResolvedValue({
      data: [
        {
          id: "n1",
          projectSlug: "ventas",
          slug: "manual-ventas",
          name: "Manual de ventas",
          description: "Políticas comerciales",
          sources: 1,
          createdAt: new Date().toISOString(),
        },
      ],
    }),
    listSources: vi.fn().mockResolvedValue({
      data: [
        {
          id: "s1",
          title: "descuentos.md",
          kind: "markdown",
          summary: "El descuento máximo es del 15%.",
          createdAt: new Date().toISOString(),
        },
      ],
    }),
    searchNotebook: vi.fn().mockResolvedValue({
      data: [
        {
          chunkId: "c1",
          sourceId: "s1",
          documentTitle: "descuentos.md",
          section: "Descuentos",
          content: "El descuento máximo es del 15%.",
          citation: "[Fuente: descuentos.md, Descuentos]",
          score: 0.9,
        },
      ],
    }),
    createNotebook: vi.fn(),
    uploadSource: vi.fn(),
    ingestUrl: vi.fn(),
    getProjectSettings: vi.fn().mockResolvedValue({
      project: {
        id: "p1",
        slug: "ventas",
        name: "Ventas",
        description: "",
        primaryAgent: "principal/agente",
        transcriptionIntegrationId: "asr1",
        speechIntegrationId: "tts1",
        createdAt: new Date().toISOString(),
      },
      integrations: [
        {
          id: "asr1",
          scope: "project",
          projectSlug: "ventas",
          kind: "transcription",
          name: "ASR local",
          slug: "asr-local",
          config: { baseUrl: "http://transcription:8000/v1", model: "Systran/faster-whisper-small" },
          secretRefs: {},
          capabilities: ["transcribe_audio"],
          status: "connected",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "tts1",
          scope: "project",
          projectSlug: "ventas",
          kind: "speech",
          name: "Voz local",
          slug: "voz-local",
          config: {
            baseUrl: "http://transcription:8000/v1",
            model: "speaches-ai/Kokoro-82M-v1.0-ONNX",
            voice: "ef_dora",
          },
          secretRefs: {},
          capabilities: ["synthesize_speech"],
          status: "connected",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      notebooks: [],
      readiness: [],
    }),
    updateProjectSettings: vi.fn().mockResolvedValue({}),
    listIntegrations: vi.fn().mockResolvedValue({
      data: [
        {
          id: "asr1",
          scope: "project",
          projectSlug: "ventas",
          kind: "transcription",
          name: "ASR local",
          slug: "asr-local",
          config: { baseUrl: "http://transcription:8000/v1", model: "Systran/faster-whisper-small" },
          secretRefs: {},
          capabilities: ["transcribe_audio"],
          status: "connected",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "tts1",
          scope: "project",
          projectSlug: "ventas",
          kind: "speech",
          name: "Voz local",
          slug: "voz-local",
          config: {
            baseUrl: "http://transcription:8000/v1",
            model: "speaches-ai/Kokoro-82M-v1.0-ONNX",
            voice: "ef_dora",
          },
          secretRefs: {},
          capabilities: ["synthesize_speech"],
          status: "connected",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    createIntegration: vi.fn().mockResolvedValue({ integration: { id: "asr2", name: "ASR" } }),
    updateIntegration: vi.fn(),
    deleteIntegration: vi.fn(),
    clearIntegrationWebhook: vi.fn(),
    listDestinations: vi.fn().mockResolvedValue({ data: [] }),
    testIntegration: vi.fn().mockResolvedValue({ ok: true, detail: "2 modelos", models: ["small", "base"] }),
    connectIntegration: vi.fn(),
    disconnectIntegration: vi.fn(),
    listProjectSecrets: vi.fn().mockResolvedValue({ data: [] }),
    saveProjectSecret: vi.fn(),
  },
}));

import { PlatformSettingsPage as SettingsPage } from "../src/pages/PlatformSettingsPage.tsx";
import { ProjectLayout } from "../src/pages/ProjectLayout.tsx";
import { ProjectIntegrationsPage } from "../src/pages/ProjectIntegrationsPage.tsx";
import { ProjectKnowledgePanel } from "../src/components/ProjectKnowledgePanel.tsx";
import { ProjectSettingsPanel } from "../src/components/ProjectSettingsPanel.tsx";
import { api } from "../src/api.ts";
import { chooseOption, renderWithProviders } from "./render.tsx";

/** Renders the shipped integrations screen the way the router does, inside the project shell. */
function renderIntegrationsPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/projects/ventas/integrations"]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectLayout />}>
          <Route path="integrations" element={<ProjectIntegrationsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  it("renders the addressable platform settings sections and global orchestrator channels", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings#boveda"]}>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Ajustes de plataforma" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Bóveda" })).toBeInTheDocument();
    expect(await screen.findByText("setting:sentry_dsn")).toBeInTheDocument();
    expect(screen.getByText(/Datos persistentes/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Canales globales" }));
    expect(screen.getByRole("heading", { name: "Canales globales" })).toBeInTheDocument();
    expect(await screen.findByText("Alertas admin")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Configuración efectiva" }));
    expect(screen.getByRole("heading", { name: "Configuración efectiva" })).toBeInTheDocument();
    expect(await screen.findByText("Configurado")).toBeInTheDocument();
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
  });
});

describe("ProjectSettingsPanel", () => {
  it("configures the default transcription connection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectSettingsPanel projectSlug="ventas" />);
    expect(await screen.findByRole("combobox", { name: "Conexión de transcripción por defecto" })).toHaveTextContent(
      "ASR local · Systran/faster-whisper-small",
    );
    await user.click(screen.getByRole("combobox", { name: "Modelo por defecto del proyecto" }));
    const fast = screen.getByRole("option", { name: /opencode-go\/fast/ });
    const vision = screen.getByRole("option", { name: /opencode-go\/vision/ });
    expect(fast.textContent).not.toContain("visión");
    expect(vision.textContent).toContain("visión");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      if (screen.queryByRole("listbox") !== null) throw new Error("El popup del Select sigue abierto.");
    });
    await chooseOption(user, "Conexión de transcripción por defecto", "ASR local · Systran/faster-whisper-small");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    expect(vi.mocked(api.updateProjectSettings)).toHaveBeenCalledWith(
      "ventas",
      expect.objectContaining({ transcriptionIntegrationId: "asr1" }),
    );
    await chooseOption(user, "Conexión de transcripción por defecto", "Sin conexión por defecto");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    expect(vi.mocked(api.updateProjectSettings)).toHaveBeenCalledWith(
      "ventas",
      expect.objectContaining({ transcriptionIntegrationId: null }),
    );
  });

  it("configures the default speech connection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectSettingsPanel projectSlug="ventas" />);
    expect(await screen.findByRole("combobox", { name: "Conexión de voz por defecto" })).toHaveTextContent(
      "Voz local · ef_dora",
    );
    await chooseOption(user, "Conexión de voz por defecto", "Voz local · ef_dora");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    expect(vi.mocked(api.updateProjectSettings)).toHaveBeenCalledWith(
      "ventas",
      expect.objectContaining({ speechIntegrationId: "tts1" }),
    );
    await chooseOption(user, "Conexión de voz por defecto", "Sin conexión por defecto");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    expect(vi.mocked(api.updateProjectSettings)).toHaveBeenCalledWith(
      "ventas",
      expect.objectContaining({ speechIntegrationId: null }),
    );
  });
});

describe("ProjectIntegrationsPage", () => {
  it("creates a transcription connection from guided fields", async () => {
    const user = userEvent.setup();
    renderIntegrationsPage();
    await screen.findByText("ASR local");
    await user.click(screen.getByRole("button", { name: "Nueva integración" }));
    expect(await screen.findByRole("heading", { name: "Nueva integración" })).toBeInTheDocument();
    await chooseOption(user, "Tipo", "Transcripción (ASR)");
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveTextContent("Transcripción (ASR)");
    expect(screen.getByLabelText("URL base del proveedor")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo por defecto")).toBeInTheDocument();
    expect(screen.getByText("Configuración avanzada")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nombre"), "ASR local 2");
    await user.type(screen.getByLabelText("Slug"), "asr-local-2");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));
    expect(vi.mocked(api.createIntegration)).toHaveBeenCalledWith(
      "ventas",
      expect.objectContaining({
        kind: "transcription",
        config: expect.objectContaining({
          baseUrl: "http://transcription:8000/v1",
          model: "Systran/faster-whisper-small",
        }),
      }),
    );
  });

  it("shows discovered models after testing a transcription connection", async () => {
    renderIntegrationsPage();
    const card = await screen.findByTestId("integration-card-asr1");
    await userEvent.click(within(card).getByRole("button", { name: "Probar" }));
    expect(await screen.findByText(/modelos: small, base/)).toBeInTheDocument();
  });

  it("renders the shared integration card with the localized kind label and the database policy", async () => {
    const now = new Date().toISOString();
    vi.mocked(api.listIntegrations).mockResolvedValueOnce({
      data: [
        {
          id: "db1",
          scope: "project",
          projectSlug: "ventas",
          kind: "sqlite",
          name: "CRM",
          slug: "crm",
          config: { kind: "sqlite", filename: "/tmp/crm.sqlite", access: "read", maxRows: 1000, allowDdl: false },
          secretRefs: {},
          capabilities: ["query"],
          status: "connected",
          createdAt: now,
          updatedAt: now,
        },
      ],
    } as never);
    renderIntegrationsPage();
    const card = await screen.findByTestId("integration-card-db1");
    expect(within(card).getByText("CRM")).toBeInTheDocument();
    expect(card).toHaveTextContent("SQLite · crm");
    expect(within(card).getByText("Política de base de datos")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Más acciones de CRM" })).toBeInTheDocument();
  });

  it("maps an integration transport failure to actionable Spanish copy", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createIntegration).mockRejectedValueOnce(new Error("failed to fetch"));
    renderIntegrationsPage();
    await screen.findByText("ASR local");
    await user.click(screen.getByRole("button", { name: "Nueva integración" }));
    await screen.findByRole("heading", { name: "Nueva integración" });

    await user.type(screen.getByLabelText("Nombre"), "Bot de prueba");
    await user.type(screen.getByLabelText("Slug"), "bot-prueba");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));

    const error = await screen.findByText(/No se pudo conectar con el servidor/);
    expect(error).toHaveAttribute("title", "failed to fetch");
    expect(error).toHaveClass("text-danger");
  });
});

describe("ProjectKnowledgePanel", () => {
  it("lists project notebooks, sources and searches with citations", async () => {
    renderWithProviders(<ProjectKnowledgePanel projectSlug="ventas" />);
    expect(await screen.findByText("Manual de ventas")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Manual de ventas"));
    expect(await screen.findByText("descuentos.md")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("¿Cuál es el descuento máximo?"), "descuento");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("[Fuente: descuentos.md, Descuentos]")).toBeInTheDocument();
  });
});
