import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntegrationRecord } from "@platform/shared";
import { renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  listDestinations: vi.fn().mockResolvedValue({ data: [] }),
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  createControlIntegration: vi.fn(),
  updateControlIntegration: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { IntegrationEditor } from "../src/components/IntegrationEditor.tsx";

const baseIntegration: IntegrationRecord = {
  id: "tg1",
  scope: "project",
  projectSlug: "ventas",
  kind: "telegram",
  name: "Bot",
  slug: "bot",
  config: { routing: { mode: "hybrid", allowlist: [], public: false } },
  secretRefs: { token: "integration:tg1:token" },
  capabilities: ["inbound_message", "outbound_message"],
  status: "connected",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("IntegrationEditor", () => {
  it("creates a guided integration from registry fields", async () => {
    apiMock.createIntegration.mockResolvedValueOnce({ integration: baseIntegration });
    const saved = vi.fn();
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={saved} />);
    expect(screen.getByText("Configuración avanzada")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre"), "Bot");
    await userEvent.type(screen.getByLabelText("Slug"), "bot");
    await userEvent.type(screen.getByLabelText("Token del bot (@BotFather)"), "123:ABC");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));
    await waitFor(() =>
      expect(apiMock.createIntegration).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({
          kind: "telegram",
          name: "Bot",
          slug: "bot",
          config: expect.objectContaining({
            routing: { mode: "hybrid", allowlist: [], public: false, voiceReplies: "never" },
          }),
          secrets: { token: "123:ABC" },
        }),
      ),
    );
    expect(saved).toHaveBeenCalled();
  });

  it("edits an integration without resending the existing secret", async () => {
    apiMock.updateIntegration.mockResolvedValueOnce({ ...baseIntegration, name: "Bot nuevo" });
    const saved = vi.fn();
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={baseIntegration} onSaved={saved} />,
    );
    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "Bot nuevo");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tg1",
        expect.objectContaining({ name: "Bot nuevo", secrets: {} }),
      ),
    );
    expect(apiMock.updateIntegration.mock.calls[0]?.[2]).not.toHaveProperty("secrets.token");
  });

  it("saves the telegram voice reply preference inside routing", async () => {
    apiMock.updateIntegration.mockResolvedValueOnce({ ...baseIntegration, name: "Bot" });
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={baseIntegration} onSaved={vi.fn()} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Responder con audio cuando llegue audio"), "auto");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tg1",
        expect.objectContaining({
          config: expect.objectContaining({ routing: expect.objectContaining({ voiceReplies: "auto" }) }),
        }),
      ),
    );
  });

  it("creates a guided speech integration with voice suggestions", async () => {
    apiMock.createIntegration.mockResolvedValueOnce({
      integration: { ...baseIntegration, kind: "speech", slug: "voz", name: "Voz" },
    });
    const saved = vi.fn();
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={saved} />);
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "speech");
    expect(screen.getByLabelText("Voz por defecto")).toHaveAttribute("list", "integration-suggestions-voice");
    expect(
      document.getElementById("integration-suggestions-voice")?.querySelector('option[value="ef_dora"]'),
    ).not.toBeNull();
    await userEvent.type(screen.getByLabelText("Nombre"), "Voz");
    await userEvent.type(screen.getByLabelText("Slug"), "voz");
    await userEvent.clear(screen.getByLabelText("Voz por defecto"));
    await userEvent.type(screen.getByLabelText("Voz por defecto"), "em_alex");
    await userEvent.type(screen.getByLabelText("API key del TTS"), "sk-voz");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));
    await waitFor(() =>
      expect(apiMock.createIntegration).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({
          kind: "speech",
          name: "Voz",
          slug: "voz",
          config: expect.objectContaining({
            baseUrl: "http://transcription:8000/v1",
            model: "speaches-ai/Kokoro-82M-v1.0-ONNX",
            voice: "em_alex",
          }),
          secrets: { apiKey: "sk-voz" },
        }),
      ),
    );
    expect(saved).toHaveBeenCalled();
  });

  it("shows an actionable error when the transport fails", async () => {
    apiMock.createIntegration.mockRejectedValueOnce(new Error("failed to fetch"));
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Bot");
    await userEvent.type(screen.getByLabelText("Slug"), "bot");
    await userEvent.type(screen.getByLabelText("Token del bot (@BotFather)"), "123:ABC");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toHaveAttribute("title", "failed to fetch");
  });
});
