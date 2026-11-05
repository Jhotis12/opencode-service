import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render.tsx";

const now = new Date().toISOString();
const integration = {
  id: "i1",
  scope: "project" as const,
  projectSlug: "ventas",
  kind: "telegram" as const,
  name: "Bot de ventas",
  slug: "bot-ventas",
  config: { routing: { mode: "hybrid", allowlist: [], public: false } },
  secretRefs: { token: "alias" },
  capabilities: ["inbound_message", "outbound_message"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};
const database = {
  ...integration,
  id: "db1",
  kind: "sqlite" as const,
  name: "CRM",
  slug: "crm",
  config: { kind: "sqlite", filename: "/tmp/crm.sqlite", access: "read", maxRows: 1000, allowDdl: false },
  capabilities: ["query"],
};
const destination = {
  id: "d1",
  projectSlug: "ventas",
  kind: "telegram_chat" as const,
  label: "Admin",
  value: "123456",
  createdAt: now,
  updatedAt: now,
};

const apiMock = vi.hoisted(() => ({
  getProjectSettings: vi.fn(),
  listModels: vi.fn(),
  listIntegrations: vi.fn(),
  listProjectSecrets: vi.fn(),
  listDestinations: vi.fn(),
  createDestination: vi.fn(),
  updateDestination: vi.fn(),
  deleteDestination: vi.fn(),
  updateProjectSettings: vi.fn(),
  updateIntegration: vi.fn(),
  testIntegration: vi.fn(),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  clearIntegrationWebhook: vi.fn(),
  integrationQr: vi.fn(),
  saveProjectSecret: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { ProjectConfigurationPanel } from "../src/components/ProjectConfigurationPanel.tsx";

function mockQueries() {
  apiMock.getProjectSettings.mockResolvedValue({
    project: {
      id: "p1",
      slug: "ventas",
      name: "Ventas",
      description: "",
      primaryAgent: "principal/agente",
      createdAt: now,
      updatedAt: now,
    },
    integrations: [integration, database],
    notebooks: [],
    readiness: [{ id: "primary-agent", label: "Agente principal configurado", ready: true }],
  });
  apiMock.listModels.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: [integration, database] });
  apiMock.listProjectSecrets.mockResolvedValue({ data: [] });
  apiMock.listDestinations.mockResolvedValue({ data: [destination] });
  apiMock.createDestination.mockResolvedValue({ ...destination, id: "d2", label: "Soporte", value: "456" });
}

describe("ProjectConfigurationPanel", () => {
  it("reaches every configuration section from one surface", async () => {
    mockQueries();
    renderWithProviders(<ProjectConfigurationPanel projectSlug="ventas" />);
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Conexiones" }));
    expect(await screen.findByText("CRM")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Canales" }));
    expect(await screen.findByText("Bot de ventas")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Destinos" }));
    expect(await screen.findByText("Admin")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Secretos" }));
    expect(await screen.findByText("Secretos del proyecto")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Preparación" }));
    expect(await screen.findByText("Preparación del proyecto")).toBeInTheDocument();
  });

  it("creates a labeled destination without changing existing references", async () => {
    mockQueries();
    renderWithProviders(<ProjectConfigurationPanel projectSlug="ventas" />);
    await userEvent.click(await screen.findByRole("tab", { name: "Destinos" }));
    await userEvent.type(screen.getByLabelText("Etiqueta"), "Soporte");
    await userEvent.type(screen.getByLabelText("Valor"), "456");
    await userEvent.click(screen.getByRole("button", { name: "Crear destino" }));
    await waitFor(() =>
      expect(apiMock.createDestination).toHaveBeenCalledWith("ventas", {
        kind: "telegram_chat",
        label: "Soporte",
        value: "456",
      }),
    );
    expect(apiMock.updateIntegration).not.toHaveBeenCalled();
  });

  it("offers destinations in the approval recipient picker", async () => {
    mockQueries();
    renderWithProviders(<ProjectConfigurationPanel projectSlug="ventas" />);
    await screen.findByText("Identidad y modelo");
    const input = screen.getByLabelText("Destinatario de aprobación");
    expect(input).toHaveAttribute("list", "project-approval-destinations");
    expect(document.querySelector("#project-approval-destinations option")?.getAttribute("value")).toBe("d1");
  });
});
