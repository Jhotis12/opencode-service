import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { api } from "../src/api.ts";
import { PlatformSettingsPage as SettingsPage } from "../src/pages/PlatformSettingsPage.tsx";
import { chooseOption, renderWithProviders } from "./render.tsx";

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

const MODEL_FORMAT_ERROR = "Usa el formato proveedor/modelo#variante. La variante es opcional.";

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

  it("offers the catalogue grouped by provider plus the DeepSeek suggestion", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    const picker = within(panel).getByRole("combobox", { name: "Modelo" });
    expect(picker).toHaveValue("Fast");

    await user.click(picker);
    expect(screen.getByRole("group", { name: "opencode-go" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Fast\b/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /DeepSeek V4\.1 Flash/ })).toBeInTheDocument();

    fireEvent.keyDown(picker, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("saves the model ref chosen in the picker", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");

    await chooseOption(user, "Modelo", /DeepSeek V4\.1 Flash/);
    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(api.saveSettings).toHaveBeenCalledWith({ defaultModel: "opencode/deepseek-v4.1-flash-free" });
  });

  it("saves an unlisted provider/model#variant typed into the picker", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    const picker = within(panel).getByRole("combobox", { name: "Modelo" });

    await user.click(picker);
    await user.type(picker, "proveedor/modelo#v1");
    await user.click(screen.getByRole("option", { name: "Usar «proveedor/modelo#v1»" }));
    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(api.saveSettings).toHaveBeenCalledWith({ defaultModel: "proveedor/modelo#v1" });
  });

  it("rejects a model without a provider inline without saving", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    const picker = within(panel).getByRole("combobox", { name: "Modelo" });

    await user.click(picker);
    await user.type(picker, "modelo-sin-proveedor");
    await user.click(screen.getByRole("option", { name: "Usar «modelo-sin-proveedor»" }));
    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(within(panel).getByText(MODEL_FORMAT_ERROR)).toBeInTheDocument();
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it("reports a typed model reference only once the field is left", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    const picker = within(panel).getByRole("combobox", { name: "Modelo" });

    await user.click(picker);
    await user.type(picker, "proveedor/");
    expect(within(panel).queryByText(MODEL_FORMAT_ERROR)).toBeNull();

    await user.keyboard("{Enter}");
    expect(picker).toHaveValue("proveedor/");
    expect(within(panel).queryByText(MODEL_FORMAT_ERROR)).toBeNull();

    await user.tab();

    expect(within(panel).getByText(MODEL_FORMAT_ERROR)).toBeInTheDocument();
    expect(picker).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the model error as soon as the empty choice is picked", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    const picker = within(panel).getByRole("combobox", { name: "Modelo" });

    await user.click(picker);
    await user.type(picker, "modelo-sin-proveedor");
    await user.keyboard("{Enter}");
    await user.tab();
    expect(within(panel).getByText(MODEL_FORMAT_ERROR)).toBeInTheDocument();

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: /^Sin modelo/ }));

    expect(within(panel).queryByText(MODEL_FORMAT_ERROR)).toBeNull();

    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));
    expect(api.saveSettings).toHaveBeenCalledWith({ defaultModel: null });
  });

  it("saves null when the empty choice is picked", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");

    await chooseOption(user, "Modelo", /^Sin modelo/);
    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(api.saveSettings).toHaveBeenCalledWith({ defaultModel: null });
  });

  it("saves null when the orchestrator choice is cleared", async () => {
    const user = userEvent.setup();
    renderSettings("/settings#orquestador");
    const panel = await screen.findByRole("tabpanel");

    await chooseOption(user, "Modelo", /^Heredar el modelo por defecto/);
    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(api.saveSettings).toHaveBeenCalledWith({ orchestratorModel: null });
  });

  it("keeps a saved model the catalogue no longer offers and saves it unchanged", async () => {
    vi.mocked(api.getSettings).mockResolvedValueOnce({
      data: {
        opencodeMode: "fake",
        sentryConfigured: false,
        providerConnected: true,
        defaultModel: "legacy/model#v2",
        orchestratorModel: "opencode-go/fast",
        dataDir: "/data",
      },
    });
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    const picker = within(panel).getByRole("combobox", { name: "Modelo" });
    expect(picker).toHaveValue("legacy/model#v2");

    await user.click(picker);
    expect(screen.getByRole("option", { name: /legacy\/model#v2/ })).toHaveTextContent("(no disponible)");
    fireEvent.keyDown(picker, { key: "Escape" });

    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));
    expect(api.saveSettings).toHaveBeenCalledWith({ defaultModel: "legacy/model#v2" });
  });

  it("stays usable when the catalogue is empty", async () => {
    vi.mocked(api.listModels).mockResolvedValueOnce({ data: [] });
    const user = userEvent.setup();
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByRole("combobox", { name: "Modelo" })).toHaveValue("opencode-go/fast");

    await chooseOption(user, "Modelo", /DeepSeek V4\.1 Flash/);
    await user.click(within(panel).getByRole("button", { name: "Guardar cambios" }));

    expect(api.saveSettings).toHaveBeenCalledWith({ defaultModel: "opencode/deepseek-v4.1-flash-free" });
  });

  it("keeps a seeded default visible when the catalogue fails to load", async () => {
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
    vi.mocked(api.listModels).mockRejectedValueOnce(new Error(""));
    renderSettings("/settings#modelo");
    const panel = await screen.findByRole("tabpanel");

    expect(within(panel).getByRole("combobox", { name: "Modelo" })).toHaveValue("DeepSeek V4.1 Flash");
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las sugerencias. Puedes escribir el modelo manualmente.",
    );
    expect(within(panel).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
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
    expect(within(panel).getByRole("combobox", { name: "Modelo" })).toHaveValue("DeepSeek V4.1 Flash");
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

// The pixel proof for this layout lives in the browser probe; these assertions exist so the class
// contract regresses loudly in jsdom, where no layout is computed at all.
describe("PlatformSettingsSection layout contract", () => {
  const classes = (element: Element) => element.className.split(/\s+/).filter(Boolean);

  it("renders the two-column grid on lg and neutralises any form width cap", async () => {
    renderSettings("/settings#modelo");
    const section = await screen.findByRole("region", { name: "Modelo por defecto" });

    const sectionClasses = classes(section);
    expect(sectionClasses).toContain("lg:grid");
    expect(sectionClasses.some((token) => token.startsWith("lg:grid-cols-["))).toBe(true);
    // A cap on the section itself would collapse the grid before the lg breakpoint applies.
    expect(sectionClasses.filter((token) => token.startsWith("max-w-"))).toEqual([]);

    // The body column must be allowed to shrink, and it must strip the internal cap each form carries.
    const body = Array.from(section.children).find((child) => classes(child).includes("min-w-0"));
    expect(body).toBeDefined();
    expect(classes(body!)).toContain("[&>form]:max-w-none");

    const forms = Array.from(section.querySelectorAll("form"));
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      // Direct children are the ones the parent's arbitrary variant reaches.
      expect(body!.contains(form)).toBe(true);
    }
  });
});
