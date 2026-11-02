import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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
