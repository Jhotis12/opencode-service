import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { api } from "../src/api.ts";
import { PlatformSettingsPage as SettingsPage } from "../src/pages/PlatformSettingsPage.tsx";
import { renderWithProviders } from "./render.tsx";

vi.mock("../src/api.ts", () => ({
  api: {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getEffectiveConfig: vi.fn(),
    listModels: vi.fn(),
    listSecrets: vi.fn(),
    saveSecret: vi.fn(),
    deleteSecret: vi.fn(),
    connectProvider: vi.fn(),
    controlIntegrations: vi.fn(),
    testControlIntegration: vi.fn(),
    connectControlIntegration: vi.fn(),
    disconnectControlIntegration: vi.fn(),
    deleteControlIntegration: vi.fn(),
    clearControlIntegrationWebhook: vi.fn(),
    controlIntegrationQr: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getSettings).mockResolvedValue({
    data: {
      opencodeMode: "fake",
      sentryConfigured: false,
      providerConnected: true,
      defaultModel: "opencode-go/fast",
      orchestratorModel: "opencode-go/fast",
      dataDir: "/data",
    },
  });
  vi.mocked(api.getEffectiveConfig).mockResolvedValue({
    platform: [
      {
        key: "defaultModel",
        label: "Modelo por defecto",
        value: "opencode-go/fast",
        source: "platform",
        secret: false,
        editable: true,
        restartRequired: false,
      },
      {
        key: "sentryDsn",
        label: "Sentry DSN",
        value: "configured",
        source: "platform",
        secret: true,
        editable: true,
        restartRequired: true,
      },
    ],
  });
  vi.mocked(api.listModels).mockResolvedValue({
    data: [{ providerID: "opencode-go", modelID: "fast", name: "Fast" }],
  });
  vi.mocked(api.listSecrets).mockResolvedValue({
    data: [{ alias: "provider:token", kind: "generic", createdAt: new Date().toISOString() }],
  });
  vi.mocked(api.saveSettings).mockResolvedValue({ ok: true, requiresRestart: false });
  vi.mocked(api.deleteSecret).mockResolvedValue({ ok: true });
  vi.mocked(api.controlIntegrations).mockResolvedValue({ data: [] });
});

function renderSettings(entry: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

function HashProbe() {
  const location = useLocation();
  return <output data-testid="hash">{location.hash}</output>;
}

describe("PlatformSettingsPage", () => {
  it("deep-links to the vault and keeps the secret when deletion is cancelled", async () => {
    renderSettings("/settings#boveda");
    expect(await screen.findByRole("heading", { name: "Bóveda" })).toBeInTheDocument();
    expect(await screen.findByText("provider:token")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar provider:token" }));
    const dialog = await screen.findByRole("dialog", { name: "Eliminar secreto" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(api.deleteSecret).not.toHaveBeenCalled();
    expect(screen.getByText("provider:token")).toBeInTheDocument();
  });

  it("deletes a vault secret only after confirmation", async () => {
    renderSettings("/settings#boveda");
    await screen.findByText("provider:token");

    await userEvent.click(screen.getByRole("button", { name: "Eliminar provider:token" }));
    const dialog = await screen.findByRole("dialog", { name: "Eliminar secreto" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar secreto" }));

    expect(api.deleteSecret).toHaveBeenCalledWith("provider:token");
  });

  it("validates an invalid Sentry DSN inline in Spanish without saving", async () => {
    renderSettings("/settings#telemetria");
    const dsnInput = await screen.findByLabelText("DSN de Sentry o GlitchTip");
    await userEvent.type(dsnInput, "no-es-url");
    await userEvent.click(screen.getByRole("button", { name: "Guardar DSN" }));

    expect(
      screen.getByText("Introduce una URL válida, por ejemplo https://clave@sentry.io/proyecto."),
    ).toBeInTheDocument();
    expect(dsnInput).toHaveAttribute("aria-invalid", "true");
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it("offers the DeepSeek model id and rejects a model without a provider inline", async () => {
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    expect(document.querySelector('datalist option[value="opencode/deepseek-v4.1-flash-free"]')).not.toBeNull();
    expect(document.querySelector('datalist option[value="opencode-go/fast"]')).not.toBeNull();

    const modelInput = within(panel).getByLabelText("Modelo");
    expect(modelInput).toHaveValue("opencode-go/fast");
    await userEvent.clear(modelInput);
    await userEvent.type(modelInput, "modelo-sin-proveedor");
    await userEvent.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(
      within(panel).getByText("Usa el formato proveedor/modelo#variante. La variante es opcional."),
    ).toBeInTheDocument();
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it("preselects DeepSeek V4.1 Flash when no platform override is stored", async () => {
    vi.mocked(api.getSettings).mockResolvedValueOnce({
      data: {
        opencodeMode: "fake",
        sentryConfigured: false,
        providerConnected: true,
        defaultModel: undefined,
        orchestratorModel: undefined,
        dataDir: "/data",
      },
    });
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByLabelText("Modelo")).toHaveValue("opencode/deepseek-v4.1-flash-free");
  });

  it("updates the URL hash when a section is selected", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsPage />
        <HashProbe />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Modelo por defecto" })).toBeInTheDocument();
    expect(screen.getByTestId("hash").textContent).toBe("");

    await userEvent.click(screen.getByRole("tab", { name: "Bóveda" }));

    expect(screen.getByTestId("hash").textContent).toBe("#boveda");
    expect(screen.getByRole("heading", { name: "Bóveda" })).toBeInTheDocument();
  });

  it("shows a scoped error with retry when settings fail to load", async () => {
    vi.mocked(api.getSettings).mockRejectedValueOnce(new Error(""));
    renderSettings("/settings");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudieron cargar los ajustes de plataforma.");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
