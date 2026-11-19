import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkflowGraph } from "@platform/shared";
import { RunLaunchModal } from "../src/components/RunLaunchModal.tsx";
import { renderWithProviders } from "./render.tsx";

const graph: WorkflowGraph = {
  version: 1,
  id: "p1",
  name: "Demo",
  description: "",
  nodes: [
    {
      id: "start",
      type: "trigger",
      label: "Inicio",
      position: { x: 0, y: 0 },
      config: {
        kind: "manual",
        inputSchema: {
          fields: [{ name: "tema", label: "Tema", type: "string", required: true, example: "Otoño", description: "Tema de la campaña" }],
        },
      },
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    },
  ],
  edges: [],
  updatedAt: new Date().toISOString(),
};

describe("RunLaunchModal", () => {
  it("generates a form from the trigger input schema and submits typed values", async () => {
    const onLaunch = vi.fn();
    renderWithProviders(<RunLaunchModal graph={graph} onClose={() => undefined} onLaunch={onLaunch} />);
    expect(screen.getByText("Tema de la campaña")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Tema/), "Otoño");
    await userEvent.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(onLaunch).toHaveBeenCalledWith({ tema: "Otoño" });
  });

  it("shows a validation error when a required field is missing", async () => {
    const onLaunch = vi.fn();
    renderWithProviders(<RunLaunchModal graph={graph} onClose={() => undefined} onLaunch={onLaunch} />);
    await userEvent.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(await screen.findByText("Falta el campo Tema.")).toBeInTheDocument();
    expect(onLaunch).not.toHaveBeenCalled();
  });
});
