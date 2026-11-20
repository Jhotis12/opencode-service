import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkflowGraph } from "@platform/shared";
import { RunLaunchModal } from "../src/components/RunLaunchModal.tsx";
import { chooseOption, renderWithProviders } from "./render.tsx";

function triggerGraph(config: Record<string, unknown>): WorkflowGraph {
  return {
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
        config,
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

const graph = triggerGraph({
  kind: "manual",
  inputSchema: {
    fields: [
      { name: "tema", label: "Tema", type: "string", required: true, example: "Otoño", description: "Tema de la campaña" },
      { name: "publicar", label: "Publicar", type: "boolean" },
    ],
  },
});

const emptyGraph = triggerGraph({ kind: "manual", inputSchema: { fields: [] } });

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

  it("picks a boolean through the shared select and sends the boolean value", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    renderWithProviders(<RunLaunchModal graph={graph} onClose={() => undefined} onLaunch={onLaunch} />);
    await user.type(screen.getByLabelText(/Tema/), "Otoño");

    await chooseOption(user, "Publicar", "Sí");
    expect(screen.getByRole("combobox", { name: "Publicar" })).toHaveTextContent("Sí");

    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(onLaunch).toHaveBeenCalledWith({ tema: "Otoño", publicar: true });
  });

  it("sends false when the no branch is picked and omits an untouched boolean", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    renderWithProviders(<RunLaunchModal graph={graph} onClose={() => undefined} onLaunch={onLaunch} />);
    await user.type(screen.getByLabelText(/Tema/), "Otoño");

    await chooseOption(user, "Publicar", "No");
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(onLaunch).toHaveBeenLastCalledWith({ tema: "Otoño", publicar: false });

    await chooseOption(user, "Publicar", "Sin valor");
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(onLaunch).toHaveBeenLastCalledWith({ tema: "Otoño" });
  });

  it("falls back to the JSON entry when the trigger declares no fields", async () => {
    renderWithProviders(<RunLaunchModal graph={emptyGraph} onClose={() => undefined} onLaunch={vi.fn()} />);
    expect(screen.getByLabelText("Entrada JSON")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
