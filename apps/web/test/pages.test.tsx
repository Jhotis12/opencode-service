import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}));

vi.mock("../src/api.ts", () => ({
  api: {
    listSecrets: vi.fn().mockResolvedValue({ data: [{ alias: "crm_api_key", kind: "generic" }] }),
    listDatabases: vi.fn().mockResolvedValue({ data: [{ alias: "crm_prod", driver: "postgres" }] }),
    listChannels: vi.fn().mockResolvedValue({
      data: [{ slug: "mi-app", type: "external_chat", name: "Mi app", status: "connected", adminAllowlist: [], isPublic: true }],
    }),
    getSettings: vi.fn().mockResolvedValue({
      data: {
        opencodeMode: "fake",
        sentryConfigured: false,
        providerConnected: true,
        defaultModel: "opencode-go/fast",
        dataDir: "/data",
      },
    }),
    listModels: vi.fn().mockResolvedValue({
      data: [{ providerID: "opencode-go", modelID: "fast", name: "Fast" }],
    }),
    listProjects: vi.fn().mockResolvedValue({ data: [] }),
    connectProvider: vi.fn(),
    saveSecret: vi.fn(),
    saveDatabase: vi.fn(),
    createChannel: vi.fn(),
    startChannel: vi.fn().mockResolvedValue({ ok: true }),
    saveSettings: vi.fn(),
    listNotebooks: vi.fn().mockResolvedValue({
      data: [
        {
          id: "n1",
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
import { NotebooksPage } from "../src/pages/NotebooksPage.tsx";
import { renderWithProviders } from "./render.tsx";

describe("SettingsPage", () => {
  it("renders provider, vault, database and channel sections", async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByRole("heading", { name: "OpenCode Go" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bóveda de secretos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bases de datos externas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Canales" })).toBeInTheDocument();
    expect(await screen.findByText("crm_api_key")).toBeInTheDocument();
    expect(await screen.findByText("crm_prod")).toBeInTheDocument();
    expect(await screen.findByText("mi-app")).toBeInTheDocument();
    expect(screen.getByText(/Datos persistentes/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Elegir modelo" }));
    expect(await screen.findByRole("dialog", { name: "Modelo por defecto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo")).toHaveValue("opencode-go/fast");
  });
});

describe("NotebooksPage", () => {
  it("lists notebooks, sources and searches with citations", async () => {
    renderWithProviders(<NotebooksPage />);
    expect(await screen.findByText("Manual de ventas")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Manual de ventas"));
    expect(await screen.findByText("descuentos.md")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("¿Cuál es el descuento máximo?"), "descuento");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("[Fuente: descuentos.md, Descuentos]")).toBeInTheDocument();
  });
});
