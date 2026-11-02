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
        dataDir: "/data",
      },
    }),
    listSecrets: vi.fn().mockResolvedValue({ data: [{ alias: "setting:sentry_dsn", kind: "sentry_dsn", createdAt: new Date().toISOString() }] }),
    listModels: vi.fn().mockResolvedValue({
      data: [{ providerID: "opencode-go", modelID: "fast", name: "Fast" }],
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
  },
}));

import { SettingsPage } from "../src/pages/SettingsPage.tsx";
import { ProjectKnowledgePanel } from "../src/components/ProjectKnowledgePanel.tsx";
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

    await userEvent.click(screen.getByRole("button", { name: "Elegir modelo" }));
    expect(await screen.findByRole("dialog", { name: "Modelo por defecto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo")).toHaveValue("opencode-go/fast");
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
