import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

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

import { SettingsPage } from "../src/pages/SettingsPage.tsx";
import { ProjectKnowledgePanel } from "../src/components/ProjectKnowledgePanel.tsx";
import { ProjectSettingsPanel } from "../src/components/ProjectSettingsPanel.tsx";
import { ProjectResourcesPanel } from "../src/components/ProjectResourcesPanel.tsx";
import { api } from "../src/api.ts";
import { renderWithProviders } from "./render.tsx";

describe("SettingsPage", () => {
  it("renders platform settings and global orchestrator channels", async () => {
    renderWithProviders(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Ajustes de plataforma" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OpenCode Go" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bóveda de plataforma" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Canales del orquestador global" })).toBeInTheDocument();
    expect(await screen.findByText("Alertas admin")).toBeInTheDocument();
    expect(screen.getByText(/Datos persistentes/)).toBeInTheDocument();
    expect(await screen.findByText("Configuración efectiva")).toBeInTheDocument();
    expect(screen.getByText("http…/1")).toBeInTheDocument();
    expect(screen.getByText("solo lectura")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Elegir modelo" })[0]!);
    expect(await screen.findByRole("dialog", { name: "Modelo por defecto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo")).toHaveValue("opencode-go/fast");
  });
});

describe("ProjectSettingsPanel", () => {
  it("configures the default transcription connection", async () => {
    renderWithProviders(<ProjectSettingsPanel projectSlug="ventas" />);
    const select = await screen.findByLabelText("Conexión de transcripción por defecto");
    expect(select).toHaveValue("asr1");
    const fast = screen.getByRole("option", { name: /opencode-go\/fast/ });
    const vision = screen.getByRole("option", { name: /opencode-go\/vision/ });
    expect(fast.textContent).not.toContain("visión");
    expect(vision.textContent).toContain("visión");
    await userEvent.selectOptions(select, "");
    await userEvent.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    expect(vi.mocked(api.updateProjectSettings)).toHaveBeenCalledWith(
      "ventas",
      expect.objectContaining({ transcriptionIntegrationId: null }),
    );
  });
});

describe("ProjectResourcesPanel", () => {
  it("creates a transcription connection from guided fields", async () => {
    renderWithProviders(<ProjectResourcesPanel projectSlug="ventas" />);
    await screen.findByText("ASR local");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "transcription");
    expect(screen.getByLabelText("URL base del proveedor")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo por defecto")).toBeInTheDocument();
    expect(screen.getByText("Configuración avanzada")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre"), "ASR local 2");
    await userEvent.type(screen.getByLabelText("Slug"), "asr-local-2");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));
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
    renderWithProviders(<ProjectResourcesPanel projectSlug="ventas" />);
    await screen.findByText("ASR local");
    await userEvent.click(screen.getAllByRole("button", { name: "Probar" })[0]!);
    expect(await screen.findByText(/modelos: small, base/)).toBeInTheDocument();
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
