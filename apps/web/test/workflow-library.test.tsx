import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { WorkflowGraph } from "@platform/shared";
import { buildWorkflowDefinition, serializeWorkflowDefinition } from "../src/workflow-transfer.ts";
import { WorkflowLibraryPanel } from "../src/components/WorkflowLibraryPanel.tsx";
import { findToast, renderWithProviders } from "./render.tsx";

function makeGraph(overrides: Partial<WorkflowGraph> = {}): WorkflowGraph {
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
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "code",
        type: "code",
        label: "Consultar",
        codeFile: "nodes/code.ts",
        position: { x: 220, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [{ id: "e1", source: "start", target: "code" }],
    updatedAt: "2026-11-19T00:00:00.000Z",
    ...overrides,
  };
}

function envelope(graph: WorkflowGraph, exportedAt = "2026-11-19T10:00:00.000Z"): string {
  return serializeWorkflowDefinition(buildWorkflowDefinition(graph, new Date(exportedAt)));
}

function jsonFile(text: string, name = "demo.workflow.json"): File {
  return new File([text], name, { type: "application/json" });
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el blob."));
    reader.readAsText(blob);
  });
}

function setup(graph = makeGraph()) {
  const onImport = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(<WorkflowLibraryPanel graph={graph} onImport={onImport} onClose={onClose} />);
  return { onImport, onClose };
}

function chooseFile(content: File) {
  fireEvent.change(screen.getByLabelText("Archivo JSON"), { target: { files: [content] } });
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:workflow"), configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
});

describe("WorkflowLibraryPanel", () => {
  it("downloads the current flow as a versioned JSON envelope", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Descargar JSON" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(await findToast(/Descargado demo\.workflow\.json con 2 nodos\./)).toBeVisible();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    const parsed = JSON.parse(await blobText(blob)) as { version: number; graph: WorkflowGraph };
    expect(parsed.version).toBe(1);
    expect(parsed.graph.nodes).toHaveLength(2);
    expect(parsed.graph.name).toBe("Demo");
  });

  it("imports a valid file as a draft", async () => {
    const { onImport } = setup();
    const incoming = makeGraph({ name: "Importado", description: "desde archivo" });

    chooseFile(jsonFile(envelope(incoming)));

    expect(await findToast(/importado como borrador/)).toBeVisible();
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0]![0]).toMatchObject({ name: "Importado", description: "desde archivo" });
  });

  it("does not touch the draft when the file already matches it", async () => {
    const graph = makeGraph();
    const { onImport } = setup(graph);

    chooseFile(jsonFile(envelope(graph)));

    expect(await findToast(/ya coincide/)).toBeVisible();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("asks before replacing the draft with an older file", async () => {
    const current = makeGraph({ updatedAt: "2026-11-19T12:00:00.000Z" });
    const { onImport } = setup(current);

    chooseFile(jsonFile(envelope(makeGraph({ name: "Viejo", updatedAt: "2026-11-01T00:00:00.000Z" }))));

    expect(await screen.findByRole("dialog", { name: "Reemplazar el borrador" })).toBeVisible();
    expect(onImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Importar de todas formas" }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0]![0]).toMatchObject({ name: "Viejo" });
  });

  it("keeps the draft when the stale import is cancelled", async () => {
    const current = makeGraph({ updatedAt: "2026-11-19T12:00:00.000Z" });
    const { onImport } = setup(current);

    chooseFile(jsonFile(envelope(makeGraph({ name: "Viejo", updatedAt: "2026-11-01T00:00:00.000Z" }))));
    await screen.findByRole("dialog", { name: "Reemplazar el borrador" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Reemplazar el borrador" })).not.toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Descargar JSON" })).toBeVisible();
  });

  it("lists the validation error for malformed JSON without changing state", async () => {
    const { onImport } = setup();

    chooseFile(jsonFile("{oops", "roto.json"));

    expect(await screen.findByRole("alert")).toHaveTextContent("El archivo no contiene JSON válido.");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("rejects an unsupported future version", async () => {
    const { onImport } = setup();
    const parsed = JSON.parse(envelope(makeGraph())) as Record<string, unknown>;
    parsed.version = 2;

    chooseFile(jsonFile(JSON.stringify(parsed), "futuro.json"));

    expect(await screen.findByRole("alert")).toHaveTextContent("versión más reciente del formato (v2)");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("lists every cross-field problem of an invalid graph", async () => {
    const { onImport } = setup();
    const botched = makeGraph({ edges: [{ id: "e1", source: "start", target: "missing" }] });

    chooseFile(jsonFile(envelope(botched), "invalido.json"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Conexión e1: La conexión e1 apunta a un nodo inexistente.");
    expect(alert).toHaveTextContent("no es alcanzable");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("closes from the footer", () => {
    const { onClose } = setup();

    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar" })[1]!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
