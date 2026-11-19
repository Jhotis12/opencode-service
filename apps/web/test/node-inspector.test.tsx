import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntegrationRecord, NodeSpec } from "@platform/shared";
import { renderWithProviders } from "./render.tsx";
import { NodeConfigFields } from "../src/components/NodeConfigFields.tsx";

const now = new Date().toISOString();
const telegram: IntegrationRecord = {
  id: "tg1",
  scope: "project",
  projectSlug: "p1",
  kind: "telegram",
  name: "Telegram",
  slug: "telegram",
  config: {},
  secretRefs: {},
  capabilities: ["inbound_message", "outbound_message"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};

const speech: IntegrationRecord = {
  id: "tts1",
  scope: "project",
  projectSlug: "p1",
  kind: "speech",
  name: "Voz local",
  slug: "voz-local",
  config: { voice: "ef_dora", voices: ["ef_dora", "em_alex", "em_santa"], models: ["kokoro", "piper"] },
  secretRefs: {},
  capabilities: ["synthesize_speech"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};

function node(config: Record<string, unknown>, type: NodeSpec["type"] = "trigger"): NodeSpec {
  return {
    id: "start",
    type,
    position: { x: 0, y: 0 },
    config,
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
  };
}

describe("NodeConfigFields", () => {
  it("renders the trigger fields from the shared registry", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "manual" })}
        integrations={[telegram]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Entrada del flujo")).toBeInTheDocument();
    expect(screen.getByText("Datos de entrada")).toBeInTheDocument();
  });

  it("replaces incompatible config when the trigger kind changes", async () => {
    const onReplaceConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ kind: "integration", integrationId: "tg1", event: "message.received" })}
        integrations={[telegram]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={onReplaceConfig}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.selectOptions(screen.getByLabelText("Entrada del flujo"), "manual");
    expect(onReplaceConfig).toHaveBeenCalledWith(expect.objectContaining({ kind: "manual" }));
    expect(onReplaceConfig.mock.calls[0]?.[0]).not.toHaveProperty("integrationId");
    confirm.mockRestore();
  });

  it("selects a discovered voice for a speak node", async () => {
    const onConfig = vi.fn();
    renderWithProviders(
      <NodeConfigFields
        node={node({ integrationId: "tts1" }, "speak")}
        integrations={[speech]}
        destinations={[]}
        onConfig={onConfig}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Voz (override)");
    expect(select.tagName).toBe("SELECT");
    expect((select as HTMLSelectElement).options[0]?.textContent).toBe("Heredar de la conexión");
    const model = screen.getByLabelText("Modelo (override)");
    expect(model.tagName).toBe("SELECT");
    expect((model as HTMLSelectElement).options[0]?.textContent).toBe("Heredar de la conexión");
    await userEvent.selectOptions(model, "piper");
    expect(onConfig).toHaveBeenCalledWith({ model: "piper" });
    await userEvent.selectOptions(select, "em_alex");
    expect(onConfig).toHaveBeenCalledWith({ voice: "em_alex" });
  });

  it("shows inline validation for incomplete configurations", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "database")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/obligatorio|Required/).length).toBeGreaterThan(0);
  });

  it("associates the required URL error with its input", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "http")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("URL");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(described).toContain("node-config-url-error");
    for (const id of described) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(document.getElementById("node-config-url-error")).toHaveTextContent("Este campo es obligatorio.");
  });

  it("associates the missing database integration error with its select", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({}, "database")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Integración de base de datos");
    expect(select).toHaveAttribute("aria-invalid", "true");
    const described = (select.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(described).toContain("node-config-integrationId-error");
    for (const id of described) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("attaches no error id when the config is valid", () => {
    renderWithProviders(
      <NodeConfigFields
        node={node({ method: "GET", url: "https://api.example.com", headers: "{}", body: "" }, "http")}
        integrations={[]}
        destinations={[]}
        onConfig={vi.fn()}
        onReplaceConfig={vi.fn()}
        onEnableDecisionCode={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("URL");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input.getAttribute("aria-describedby") ?? "").not.toContain("node-config-url-error");
    expect(document.getElementById("node-config-url-error")).toBeNull();
  });
});
