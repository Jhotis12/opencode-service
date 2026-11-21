import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  listNotebooks: vi.fn(),
  createNotebook: vi.fn(),
  deleteNotebook: vi.fn(),
  listSources: vi.fn(),
  uploadSource: vi.fn(),
  ingestUrl: vi.fn(),
  searchNotebook: vi.fn(),
  deleteSource: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { ProjectKnowledgePanel } from "../src/components/ProjectKnowledgePanel.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

// Outcomes are announced by sonner: mount the real host so the assertions below
// prove the copy reaches a toast and not an inline paragraph.
function renderKnowledge() {
  return renderWithProviders(
    <>
      <ProjectKnowledgePanel projectSlug="demo" />
    </>,
  );
}

afterEach(() => {
  act(() => dismissAll());
});

const notebook = {
  id: "nb-1",
  projectSlug: "demo",
  slug: "manual-ventas",
  name: "Manual de ventas",
  description: "",
  sources: 2,
  createdAt: "2026-11-01T10:00:00.000Z",
};

const fileSource = {
  id: "source-a",
  title: "devoluciones.md",
  kind: "file",
  summary: "Las devoluciones tardan 5 días.",
  createdAt: "2026-11-01T10:05:00.000Z",
};

const urlSource = {
  id: "source-b",
  title: "Política de envíos",
  kind: "url",
  summary: "Los envíos salen cada martes.",
  uri: "https://example.com/envios",
  createdAt: "2026-11-01T10:06:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  apiMock.listNotebooks.mockResolvedValue({ data: [] });
  apiMock.listSources.mockResolvedValue({ data: [] });
});

function mockNotebook(sources: Array<typeof fileSource | typeof urlSource>) {
  apiMock.listNotebooks.mockResolvedValue({ data: [{ ...notebook, sources: sources.length }] });
  apiMock.listSources.mockResolvedValue({ data: sources });
}

async function selectNotebook() {
  await userEvent.click(await screen.findByRole("button", { name: /Manual de ventas/ }));
  await screen.findByText("Fuentes de manual-ventas");
}

describe("ProjectKnowledgePanel", () => {
  it("shows upload progress with the file name until the mutation settles", async () => {
    mockNotebook([fileSource, urlSource]);
    renderKnowledge();
    await selectNotebook();

    let resolveUpload!: (value: { source: { title: string }; chunks: number }) => void;
    apiMock.uploadSource.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const file = new File(["# Garantías"], "garantias.md", { type: "text/markdown" });
    await userEvent.upload(screen.getByLabelText("Subir documento"), file);

    expect(await screen.findByText(/Subiendo garantias\.md…/)).toBeInTheDocument();
    expect(apiMock.uploadSource).toHaveBeenCalledWith("demo", "manual-ventas", file);

    resolveUpload({ source: { title: "garantias.md" }, chunks: 7 });
    const indexed = await screen.findByText(/Fuente indexada: garantias\.md \(7 fragmentos\)/);
    expect(indexed.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() => expect(screen.queryByText(/Subiendo garantias\.md…/)).not.toBeInTheDocument());
  });

  it("gives URL ingest feedback and previews a source", async () => {
    mockNotebook([fileSource, urlSource]);
    renderKnowledge();
    await selectNotebook();

    let resolveIngest!: (value: { source: { title: string }; chunks: number }) => void;
    apiMock.ingestUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveIngest = resolve;
        }),
    );

    await userEvent.type(screen.getByLabelText("URL para indexar"), "https://example.com/politica");
    await userEvent.click(screen.getByRole("button", { name: "Indexar URL" }));

    expect(await screen.findByText(/Indexando https:\/\/example\.com\/politica…/)).toBeInTheDocument();
    resolveIngest({ source: { title: "Política de garantías" }, chunks: 4 });
    const ingested = await screen.findByText(/URL indexada: Política de garantías \(4 fragmentos\)/);
    expect(ingested.closest("[data-sonner-toast]")).not.toBeNull();

    await userEvent.click(screen.getAllByRole("button", { name: "Vista previa" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("devoluciones.md")).toBeInTheDocument();
    expect(within(dialog).getByText("Las devoluciones tardan 5 días.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("deletes a source only after confirmation", async () => {
    mockNotebook([fileSource, urlSource]);
    renderKnowledge();
    await selectNotebook();
    await screen.findByText("devoluciones.md");

    apiMock.deleteSource.mockResolvedValue({ ok: true });
    apiMock.listSources.mockResolvedValueOnce({ data: [urlSource] });

    const row = screen.getByText("devoluciones.md").closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Eliminar" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiMock.deleteSource).not.toHaveBeenCalled();

    await userEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar fuente" }));
    await waitFor(() => expect(apiMock.deleteSource).toHaveBeenCalledWith("demo", "manual-ventas", "source-a"));
    await waitFor(() => expect(screen.queryByText("devoluciones.md")).not.toBeInTheDocument());
    const removed = await screen.findByText(/Fuente eliminada: devoluciones\.md/);
    expect(removed.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("closes the source confirmation and toasts when deletion fails", async () => {
    mockNotebook([fileSource]);
    renderKnowledge();
    await selectNotebook();
    await screen.findByText("devoluciones.md");

    apiMock.deleteSource.mockRejectedValueOnce(new Error("failed to fetch"));
    const row = screen.getByText("devoluciones.md").closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar fuente" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar fuente" }));

    const toast = await screen.findByText(
      "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.",
    );
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Eliminar fuente" })).not.toBeInTheDocument(),
    );
  });

  it("deletes a notebook after confirmation and clears the selection", async () => {
    mockNotebook([]);
    renderKnowledge();
    await selectNotebook();

    apiMock.deleteNotebook.mockResolvedValue({ ok: true });
    apiMock.listNotebooks.mockResolvedValueOnce({ data: [] });

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText(/Se eliminará/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiMock.deleteNotebook).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar notebook" }));
    await waitFor(() => expect(apiMock.deleteNotebook).toHaveBeenCalledWith("demo", "manual-ventas"));
    await waitFor(() => expect(screen.queryByText("Fuentes de manual-ventas")).not.toBeInTheDocument());
    const removedNotebook = await screen.findByText(/Notebook eliminado: Manual de ventas/);
    expect(removedNotebook.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() => expect(screen.getByText(/Aún no hay notebooks/)).toBeInTheDocument());
  });

  it("closes the notebook confirmation and toasts when deletion fails", async () => {
    mockNotebook([]);
    renderKnowledge();
    await selectNotebook();

    apiMock.deleteNotebook.mockRejectedValueOnce(new Error("failed to fetch"));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar notebook" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar notebook" }));

    const toast = await screen.findByText(
      "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.",
    );
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Eliminar notebook" })).not.toBeInTheDocument(),
    );
  });

  it("maps an upload failure to actionable Spanish copy", async () => {
    mockNotebook([fileSource]);
    renderKnowledge();
    await selectNotebook();

    apiMock.uploadSource.mockRejectedValueOnce(new Error("failed to fetch"));
    const file = new File(["# Roto"], "error.md", { type: "text/markdown" });
    await userEvent.upload(screen.getByLabelText("Subir documento"), file);

    expect((await screen.findByText(/No se pudo conectar con el servidor/)).closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() => expect(screen.queryByText(/Subiendo error\.md…/)).not.toBeInTheDocument());
  });
});
