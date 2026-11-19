import { useId, useState } from "react";
import type { WorkflowGraph } from "@platform/shared";
import { button, buttonGhost, notify, smallMuted } from "../ui.ts";
import {
  buildWorkflowDefinition,
  downloadWorkflowDefinition,
  isSameGraph,
  parseWorkflowDefinition,
  workflowFileName,
} from "../workflow-transfer.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Field } from "./Field.tsx";
import { Modal } from "./Modal.tsx";

type PendingImport = { graph: WorkflowGraph; fileName: string; updatedAt: string };

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsText(file);
  });
}

export function WorkflowLibraryPanel({
  graph,
  onImport,
  onClose,
}: {
  graph: WorkflowGraph;
  onImport(graph: WorkflowGraph): void;
  onClose(): void;
}) {
  const fileId = useId();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingImport>();

  function exportFlow() {
    setErrors([]);
    const fileName = workflowFileName(graph);
    downloadWorkflowDefinition(buildWorkflowDefinition(graph), fileName);
    notify.success(`Descargado ${fileName} con ${graph.nodes.length} nodo${graph.nodes.length === 1 ? "" : "s"}.`);
  }

  function applyImport(next: WorkflowGraph, fileName: string) {
    onImport(next);
    setPending(undefined);
    notify.success(`"${fileName}" importado como borrador. Revisa el flujo y usa Guardar flujo para conservarlo.`);
  }

  async function importFlow(file: File | undefined) {
    if (!file) return;
    setErrors([]);
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setErrors(["No se pudo leer el archivo seleccionado."]);
      return;
    }
    const result = parseWorkflowDefinition(text, graph);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (isSameGraph(result.graph, graph)) {
      notify.info(`"${file.name}" ya coincide con el flujo actual. No hay cambios que aplicar.`);
      return;
    }
    if (result.stale) {
      setPending({ graph: result.graph, fileName: file.name, updatedAt: result.graph.updatedAt });
      return;
    }
    applyImport(result.graph, file.name);
  }

  if (pending) {
    return (
      <ConfirmDialog
        title="Reemplazar el borrador"
        confirmLabel="Importar de todas formas"
        onCancel={() => setPending(undefined)}
        onConfirm={() => applyImport(pending.graph, pending.fileName)}
      >
        <p className="text-sm text-muted">
          <strong className="text-slate-200">{pending.fileName}</strong> contiene una versión del flujo del{" "}
          {new Date(pending.updatedAt).toLocaleString()} y el borrador actual es del{" "}
          {new Date(graph.updatedAt).toLocaleString()}. Es más antiguo que lo que tienes abierto.
        </p>
        <p className="text-sm text-muted">
          Si lo importas, el borrador actual se reemplaza y los cambios sin guardar se pierden. Usa Guardar flujo
          después de importar para conservar el resultado.
        </p>
      </ConfirmDialog>
    );
  }

  return (
    <Modal
      title="Biblioteca del flujo"
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end">
          <button type="button" className={buttonGhost} onClick={onClose}>
            Cerrar
          </button>
        </div>
      }
    >
      <p className={smallMuted}>
        Descarga el flujo como JSON para respaldarlo o moverlo entre proyectos, o importa un archivo validado. La
        importación reemplaza el borrador y no se guarda sola.
      </p>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-well p-4">
        <h3 className="text-sm font-semibold text-slate-100">Exportar</h3>
        <p className={smallMuted}>Incluye los nodos, las conexiones, el modelo por defecto y la versión del formato.</p>
        <div>
          <button type="button" className={button} onClick={exportFlow}>
            Descargar JSON
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-well p-4">
        <h3 className="text-sm font-semibold text-slate-100">Importar</h3>
        <Field
          id={fileId}
          label="Archivo JSON"
          hint="Solo se aceptan definiciones exportadas desde Agentic Platform."
        >
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void importFlow(file);
            }}
          />
        </Field>
      </section>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3">
          <p className="text-xs font-semibold text-danger">No se pudo importar el flujo:</p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-xs text-danger">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
