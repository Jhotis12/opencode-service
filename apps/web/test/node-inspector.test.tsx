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
});
