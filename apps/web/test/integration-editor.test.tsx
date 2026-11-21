import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntegrationRecord } from "@platform/shared";
import { chooseOption, renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  listDestinations: vi.fn().mockResolvedValue({ data: [] }),
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  createControlIntegration: vi.fn(),
  updateControlIntegration: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { IntegrationEditor } from "../src/components/IntegrationEditor.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

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

const projectDestination = {
  id: "dest-1",
  scope: "project",
  projectSlug: "ventas",
  kind: "telegram",
  label: "Soporte",
  value: "123",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function elementIds(): string[] {
  return [...document.querySelectorAll("[id]")].map((element) => element.id);
}

afterEach(() => {
  act(() => dismissAll());
});

describe("IntegrationEditor", () => {
  it("creates a guided integration from registry fields", async () => {
    const user = userEvent.setup();
    apiMock.createIntegration.mockResolvedValueOnce({ integration: baseIntegration });
    const saved = vi.fn();
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={saved} />);
    expect(screen.getByText("Configuración avanzada")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nombre"), "Bot");
    await user.type(screen.getByLabelText("Slug"), "bot");
    await user.type(screen.getByLabelText("Token del bot (@BotFather)"), "123:ABC");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));
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

  it("saves the kind chosen through the picker and resets the new kind config", async () => {
    const user = userEvent.setup();
    apiMock.createIntegration.mockResolvedValueOnce({
      integration: { ...baseIntegration, kind: "whatsapp", name: "Wa", slug: "wa" },
    });
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />);
    await chooseOption(user, "Tipo", "WhatsApp");
    await user.type(screen.getByLabelText("Nombre"), "Wa");
    await user.type(screen.getByLabelText("Slug"), "wa");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));
    await waitFor(() =>
      expect(apiMock.createIntegration).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({
          kind: "whatsapp",
          config: expect.objectContaining({ mode: "baileys" }),
        }),
      ),
    );
  });

  it("edits an integration without resending the existing secret", async () => {
    const user = userEvent.setup();
    apiMock.updateIntegration.mockResolvedValueOnce({ ...baseIntegration, name: "Bot nuevo" });
    const saved = vi.fn();
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={baseIntegration} onSaved={saved} />,
    );
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Bot nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
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
    const user = userEvent.setup();
    apiMock.updateIntegration.mockResolvedValueOnce({ ...baseIntegration, name: "Bot" });
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={baseIntegration} onSaved={vi.fn()} />,
    );
    await chooseOption(user, "Responder con audio cuando llegue audio", "Nota de voz si el mensaje trae audio");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
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

  it("creates a guided speech integration from the suggested voices", async () => {
    const user = userEvent.setup();
    apiMock.createIntegration.mockResolvedValueOnce({
      integration: { ...baseIntegration, kind: "speech", slug: "voz", name: "Voz" },
    });
    const saved = vi.fn();
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={saved} />);
    await chooseOption(user, "Tipo", "Voz (TTS)");
    await chooseOption(user, "Voz por defecto", "em_alex");
    await user.type(screen.getByLabelText("Nombre"), "Voz");
    await user.type(screen.getByLabelText("Slug"), "voz");
    await user.type(screen.getByLabelText("API key del TTS"), "sk-voz");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));
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

  it("keeps a raw voice that the provider suggested but did not list", async () => {
    const user = userEvent.setup();
    apiMock.createIntegration.mockResolvedValueOnce({
      integration: { ...baseIntegration, kind: "speech", slug: "voz", name: "Voz" },
    });
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />);
    await chooseOption(user, "Tipo", "Voz (TTS)");
    const voice = screen.getByRole("combobox", { name: "Voz por defecto" });
    await user.click(voice);
    await user.type(voice, "xx_custom");
    await user.click(screen.getByRole("option", { name: /Usar «xx_custom»/ }));
    await user.type(screen.getByLabelText("Nombre"), "Voz");
    await user.type(screen.getByLabelText("Slug"), "voz");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));
    await waitFor(() =>
      expect(apiMock.createIntegration).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({
          kind: "speech",
          config: expect.objectContaining({ voice: "xx_custom" }),
        }),
      ),
    );
  });

  it("selects a discovered voice and model when the connection exposes them", async () => {
    const user = userEvent.setup();
    const speechIntegration: IntegrationRecord = {
      ...baseIntegration,
      id: "tts1",
      kind: "speech",
      name: "Voz",
      slug: "voz",
      config: {
        baseUrl: "http://transcription:8000/v1",
        model: "speaches-ai/Kokoro-82M-v1.0-ONNX",
        models: ["speaches-ai/Kokoro-82M-v1.0-ONNX", "rhasspy/piper-voices"],
        voice: "ef_dora",
        voices: ["ef_dora", "em_alex", "em_santa"],
      },
      capabilities: ["synthesize_speech"],
    };
    apiMock.updateIntegration.mockResolvedValueOnce(speechIntegration);
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={speechIntegration} onSaved={vi.fn()} />,
    );
    await chooseOption(user, "Modelo por defecto", "rhasspy/piper-voices");
    await chooseOption(user, "Voz por defecto", "em_alex");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tts1",
        expect.objectContaining({
          config: expect.objectContaining({
            model: "rhasspy/piper-voices",
            voice: "em_alex",
          }),
        }),
      ),
    );
  });

  it("picks a destination by id and keeps a raw recipient legal", async () => {
    const user = userEvent.setup();
    apiMock.listDestinations.mockResolvedValueOnce({ data: [projectDestination] });
    apiMock.updateIntegration.mockResolvedValue({ ...baseIntegration, name: "Bot" });
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={baseIntegration} onSaved={vi.fn()} />,
    );
    await chooseOption(user, "Destinatario de alertas", "Soporte · 123");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tg1",
        expect.objectContaining({ config: expect.objectContaining({ alertRecipient: "dest-1" }) }),
      ),
    );

    const recipient = screen.getByRole("combobox", { name: "Destinatario de alertas" });
    await user.click(recipient);
    await user.type(recipient, "999");
    await user.click(screen.getByRole("option", { name: /Usar «999»/ }));
    apiMock.updateIntegration.mockClear();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tg1",
        expect.objectContaining({ config: expect.objectContaining({ alertRecipient: "999" }) }),
      ),
    );
  });

  it("adds a destination to the allowlist and still accepts raw chat ids", async () => {
    const user = userEvent.setup();
    apiMock.listDestinations.mockResolvedValueOnce({ data: [projectDestination] });
    apiMock.updateIntegration.mockResolvedValue({ ...baseIntegration, name: "Bot" });
    renderWithProviders(
      <IntegrationEditor scope="project" projectSlug="ventas" integration={baseIntegration} onSaved={vi.fn()} />,
    );
    await chooseOption(user, "Allowlist de administradores", "Soporte · 123");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tg1",
        expect.objectContaining({
          config: expect.objectContaining({
            routing: expect.objectContaining({ allowlist: ["dest-1"] }),
          }),
        }),
      ),
    );

    const allowlist = screen.getByRole("combobox", { name: "Allowlist de administradores" });
    await user.click(allowlist);
    await user.type(allowlist, "555, 666");
    await user.click(screen.getByRole("option", { name: /Usar «555, 666»/ }));
    apiMock.updateIntegration.mockClear();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "ventas",
        "tg1",
        expect.objectContaining({
          config: expect.objectContaining({
            routing: expect.objectContaining({ allowlist: ["555", "666"] }),
          }),
        }),
      ),
    );
  });

  it("points each picker label at its own control", async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />);
    const voiceLabel = screen.getByText("Responder con audio cuando llegue audio", { selector: "label" });
    const voiceControl = screen.getByRole("combobox", { name: "Responder con audio cuando llegue audio" });
    expect(voiceLabel).toHaveAttribute("for", voiceControl.id);
    await user.click(voiceLabel);
    expect(voiceControl).toHaveFocus();
  });

  it("gives every element a unique id with two editors mounted together", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />
        <IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />
      </>,
    );
    const ids = elementIds();
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of document.querySelectorAll("label[for]")) {
      const target = label.getAttribute("for");
      expect(target === null ? null : document.getElementById(target)).not.toBeNull();
    }

    const kinds = screen.getAllByRole("combobox", { name: "Tipo" });
    await user.click(kinds[1]!);
    await user.click(screen.getAllByRole("option", { name: "Voz (TTS)" })[0]!);
    const afterSwitch = elementIds();
    expect(new Set(afterSwitch).size).toBe(afterSwitch.length);
  });

  it("shows an actionable error when the transport fails", async () => {
    const user = userEvent.setup();
    apiMock.createIntegration.mockRejectedValueOnce(new Error("failed to fetch"));
    renderWithProviders(
      <>
        <IntegrationEditor scope="project" projectSlug="ventas" onSaved={vi.fn()} />
      </>,
    );
    await user.type(screen.getByLabelText("Nombre"), "Bot");
    await user.type(screen.getByLabelText("Slug"), "bot");
    await user.type(screen.getByLabelText("Token del bot (@BotFather)"), "123:ABC");
    await user.click(screen.getByRole("button", { name: "Crear integración" }));
    expect((await screen.findByText(/No se pudo conectar con el servidor/)).closest("[data-sonner-toast]")).not.toBeNull();
  });
});
