import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type NotebookSummary, type SearchHit, type SourceSummary } from "../api.ts";
import { qk } from "../query.ts";
import {
  badge,
  button,
  buttonDanger,
  buttonGhost,
  buttonPrimary,
  card,
  friendlyError,
  sectionTitle,
} from "../ui.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { Modal } from "./Modal.tsx";
import { NodeIcon } from "./nodes/node-icons.tsx";
import { Skeleton } from "./Skeleton.tsx";
import { notifyError, notifySuccess } from "./Toast.tsx";

function PendingNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" strokeDasharray="32 18" />
      </svg>
      {children}
    </p>
  );
}

export function ProjectKnowledgePanel({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const notebooksQuery = useQuery({
    queryKey: qk.notebooks(projectSlug),
    queryFn: () => api.listNotebooks(projectSlug).then((result) => result.data),
  });
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [uploadName, setUploadName] = useState<string>();
  const [preview, setPreview] = useState<SourceSummary>();
  const [confirmSource, setConfirmSource] = useState<SourceSummary>();
  const [confirmNotebook, setConfirmNotebook] = useState<NotebookSummary>();

  const sourcesQuery = useQuery({
    queryKey: qk.sources(projectSlug, selected ?? ""),
    queryFn: () => api.listSources(projectSlug, selected!).then((result) => result.data),
    enabled: Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () => api.createNotebook(projectSlug, { slug, name }),
    onSuccess: (notebook) => {
      setSlug("");
      setName("");
      notifySuccess("Notebook creado.");
      setSelected(notebook.slug);
      void queryClient.invalidateQueries({ queryKey: qk.notebooks(projectSlug) });
    },
    onError: (cause) => notifyError(friendlyError(cause, "No se pudo crear el notebook.")),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadSource(projectSlug, selected!, file),
    onMutate: (file) => {
      setUploadName(file.name);
    },
    onSuccess: (result) => {
      setUploadName(undefined);
      notifySuccess(`Fuente indexada: ${result.source.title} (${result.chunks} fragmentos)`);
      void queryClient.invalidateQueries({ queryKey: qk.sources(projectSlug, selected!) });
      void queryClient.invalidateQueries({ queryKey: qk.notebooks(projectSlug) });
    },
    onError: (cause) => {
      setUploadName(undefined);
      notifyError(friendlyError(cause, "No se pudo indexar el documento."));
    },
  });

  const ingest = useMutation({
    mutationFn: () => api.ingestUrl(projectSlug, selected!, url),
    onSuccess: (result) => {
      notifySuccess(`URL indexada: ${result.source.title} (${result.chunks} fragmentos)`);
      setUrl("");
      void queryClient.invalidateQueries({ queryKey: qk.sources(projectSlug, selected!) });
      void queryClient.invalidateQueries({ queryKey: qk.notebooks(projectSlug) });
    },
    onError: (cause) => notifyError(friendlyError(cause, "No se pudo indexar la URL.")),
  });

  const search = useMutation({
    mutationFn: () => api.searchNotebook(projectSlug, selected!, query),
    onSuccess: (result) => setHits(result.data),
    onError: (cause) => notifyError(friendlyError(cause, "No se pudo buscar en el notebook.")),
  });

  const removeSource = useMutation({
    mutationFn: (input: { notebookSlug: string; source: SourceSummary }) =>
      api.deleteSource(projectSlug, input.notebookSlug, input.source.id),
    onSuccess: (_result, input) => {
      setConfirmSource(undefined);
      notifySuccess(`Fuente eliminada: ${input.source.title}`);
      void queryClient.invalidateQueries({ queryKey: qk.sources(projectSlug, input.notebookSlug) });
      void queryClient.invalidateQueries({ queryKey: qk.notebooks(projectSlug) });
    },
    onError: (cause) => {
      setConfirmSource(undefined);
      notifyError(friendlyError(cause, "No se pudo eliminar la fuente."));
    },
  });

  const removeNotebook = useMutation({
    mutationFn: (notebook: NotebookSummary) => api.deleteNotebook(projectSlug, notebook.slug),
    onSuccess: (_result, notebook) => {
      setConfirmNotebook(undefined);
      notifySuccess(`Notebook eliminado: ${notebook.name}`);
      if (selected === notebook.slug) {
        setSelected(undefined);
        setHits([]);
      }
      void queryClient.invalidateQueries({ queryKey: qk.notebooks(projectSlug) });
    },
    onError: (cause) => {
      setConfirmNotebook(undefined);
      notifyError(friendlyError(cause, "No se pudo eliminar el notebook."));
    },
  });

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  const notebooks = notebooksQuery.data ?? [];
  const sources = sourcesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <form className={`${card} !flex-row flex-wrap items-end gap-3`} onSubmit={submitCreate} aria-label="Crear notebook">
        <label className="min-w-[200px] flex-1">
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="manual-facturacion" />
        </label>
        <label className="min-w-[200px] flex-1">
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Manual de facturación" />
        </label>
        <button className={buttonPrimary} disabled={create.isPending || !slug || !name}>
          Crear notebook
        </button>
      </form>

      {notebooksQuery.isError ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-danger">
            {friendlyError(notebooksQuery.error, "No se pudieron cargar los notebooks.")}
          </p>
          <button type="button" className={`${buttonGhost} self-start`} onClick={() => void notebooksQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : notebooksQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton shape="block" className="h-32" />
          <Skeleton shape="block" className="h-32" />
          <Skeleton shape="block" className="h-32" />
        </div>
      ) : notebooks.length === 0 ? (
        <EmptyState
          icon={<NodeIcon type="database" />}
          title="Aún no hay notebooks"
          description="Crea el primero con el formulario de arriba para subir documentos o indexar URLs que los agentes y el flujo puedan consultar."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notebooks.map((notebook) => (
            <article
              key={notebook.slug}
              className={`flex flex-col gap-3 rounded-xl border bg-panel p-4 transition ${
                selected === notebook.slug ? "border-accent" : "border-line hover:border-accent"
              }`}
            >
              <button
                type="button"
                className="flex flex-1 flex-col gap-2 text-left"
                aria-pressed={selected === notebook.slug}
                onClick={() => {
                  setSelected(notebook.slug);
                  setHits([]);
                }}
              >
                <strong className="text-sm">{notebook.name}</strong>
                <span className="text-xs text-muted">{notebook.slug}</span>
                <p className="text-sm text-muted">{notebook.description || "Sin descripción"}</p>
                <span className={badge}>{notebook.sources} fuentes</span>
              </button>
              <button type="button" className={`${buttonDanger} self-start`} onClick={() => setConfirmNotebook(notebook)}>
                Eliminar
              </button>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className={card}>
            <h2 className={sectionTitle}>Fuentes de {selected}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".md,.markdown,.txt,.csv,.pdf,.docx"
                aria-label="Subir documento"
                className="min-w-[220px] flex-1"
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate(file);
                  event.target.value = "";
                }}
              />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://ejemplo.com/politica"
                aria-label="URL para indexar"
                className="min-w-[220px] flex-1"
              />
              <button className={button} disabled={ingest.isPending || !url} onClick={() => ingest.mutate()}>
                Indexar URL
              </button>
            </div>
            {upload.isPending && uploadName && <PendingNote>Subiendo {uploadName}…</PendingNote>}
            {ingest.isPending && <PendingNote>Indexando {url}…</PendingNote>}
            {sourcesQuery.isError ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-danger">
                  {friendlyError(sourcesQuery.error, "No se pudieron cargar las fuentes.")}
                </p>
                <button type="button" className={`${buttonGhost} self-start`} onClick={() => void sourcesQuery.refetch()}>
                  Reintentar
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {sources.map((source) => (
                  <li key={source.id} className="flex flex-col gap-2 border-b border-line pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="min-w-0 flex-1 truncate text-sm" title={source.title}>
                        {source.title}
                      </strong>
                      <span className={badge}>{source.kind}</span>
                    </div>
                    <p className="text-xs text-muted">{source.summary || "Sin resumen"}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={buttonGhost} onClick={() => setPreview(source)}>
                        Vista previa
                      </button>
                      <button type="button" className={buttonDanger} onClick={() => setConfirmSource(source)}>
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
                {sourcesQuery.isLoading && (
                  <div className="flex flex-col gap-2">
                    <Skeleton shape="line" />
                    <Skeleton shape="line" />
                    <Skeleton shape="line" />
                  </div>
                )}
                {!sourcesQuery.isLoading && sources.length === 0 && (
                  <p className="text-sm text-muted">Aún no hay fuentes. Sube un documento o indexa una URL.</p>
                )}
              </ul>
            )}
          </section>

          <section className={card}>
            <h2 className={sectionTitle}>Probar búsqueda</h2>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                search.mutate();
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="¿Cuál es el descuento máximo?"
                className="min-w-[220px] flex-1"
              />
              <button className={buttonPrimary} disabled={search.isPending || !query}>
                Buscar
              </button>
            </form>
            <div className="flex flex-col gap-2.5">
              {hits.map((hit) => (
                <article key={hit.chunkId} className="rounded-lg border border-line bg-well p-3">
                  <strong className="text-sm text-slate-100">{hit.citation}</strong>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted">{hit.content}</p>
                  <small className="text-xs text-muted">score {hit.score.toFixed(4)}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(undefined)} size="md">
          <div className="flex flex-wrap items-center gap-2">
            <span className={badge}>{preview.kind}</span>
            <small className="text-xs text-muted">{new Date(preview.createdAt).toLocaleString()}</small>
          </div>
          <p className="text-sm text-slate-200">{preview.summary || "Sin resumen"}</p>
          {preview.uri && (
            <p className="min-w-0 break-all text-xs text-muted">
              Origen:{" "}
              <a className="text-accent hover:underline" href={preview.uri} target="_blank" rel="noreferrer noopener">
                {preview.uri}
              </a>
            </p>
          )}
        </Modal>
      )}

      {confirmSource && selected && (
        <ConfirmDialog
          title="Eliminar fuente"
          confirmLabel="Eliminar fuente"
          pending={removeSource.isPending}
          onCancel={() => setConfirmSource(undefined)}
          onConfirm={() => removeSource.mutate({ notebookSlug: selected, source: confirmSource })}
        >
          <p className="text-sm text-slate-200">
            Se eliminará <strong>{confirmSource.title}</strong> con todos sus fragmentos indexados. Esta acción no se puede
            deshacer.
          </p>
        </ConfirmDialog>
      )}

      {confirmNotebook && (
        <ConfirmDialog
          title="Eliminar notebook"
          confirmLabel="Eliminar notebook"
          pending={removeNotebook.isPending}
          onCancel={() => setConfirmNotebook(undefined)}
          onConfirm={() => removeNotebook.mutate(confirmNotebook)}
        >
          <p className="text-sm text-slate-200">
            Se eliminará <strong>{confirmNotebook.name}</strong> ({confirmNotebook.slug}) con sus {confirmNotebook.sources}{" "}
            fuente(s) y sus archivos del espacio de trabajo. Esta acción no se puede deshacer.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
