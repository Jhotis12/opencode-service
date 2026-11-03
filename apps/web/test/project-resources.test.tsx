import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "./render.tsx";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}));

const apiMock = vi.hoisted(() => ({
  listIntegrations: vi.fn().mockResolvedValue({ data: [] }),
  listProjectSecrets: vi.fn().mockResolvedValue({ data: [] }),
  createIntegration: vi.fn().mockRejectedValue(new Error("failed to fetch")),
  updateIntegration: vi.fn(),
  testIntegration: vi.fn(),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  saveProjectSecret: vi.fn(),
  deleteProjectSecret: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { ProjectResourcesPanel } from "../src/components/ProjectResourcesPanel.tsx";

describe("ProjectResourcesPanel", () => {
  it("saves the database access policy from the resource card", async () => {
    const now = new Date().toISOString();
    apiMock.listIntegrations.mockResolvedValueOnce({
      data: [
        {
          id: "db1",
          scope: "project",
          projectSlug: "demo",
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
    });
    apiMock.updateIntegration.mockResolvedValueOnce({ ok: true });
    renderWithProviders(
      <MemoryRouter>
        <ProjectResourcesPanel projectSlug="demo" />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Política de base de datos")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Acceso"), "write");
    await userEvent.click(screen.getByRole("button", { name: "Guardar política" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "demo",
        "db1",
        expect.objectContaining({ config: expect.objectContaining({ access: "write" }) }),
      ),
    );
  });

  it("maps an integration transport failure to actionable Spanish copy", async () => {
    renderWithProviders(
      <MemoryRouter>
        <ProjectResourcesPanel projectSlug="demo" />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Nueva integración" });
    await userEvent.type(screen.getByLabelText("Nombre"), "Bot de prueba");
    await userEvent.type(screen.getByLabelText("Slug"), "bot-prueba");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));

    const error = await screen.findByText(/No se pudo conectar con el servidor/);
    expect(error).toHaveAttribute("title", "failed to fetch");
    expect(error).toHaveClass("text-danger");
  });
});
