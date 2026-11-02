import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SearchHit } from "../api.ts";
import { qk } from "../query.ts";
import { badge, button, buttonPrimary, card, pageTitle } from "../ui.ts";

export function NotebooksPage() {
  const queryClient = useQueryClient();
  const notebooksQuery = useQuery({ queryKey: qk.notebooks, queryFn: () => api.listNotebooks().then((result) => result.data) });
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<string>();

  const sourcesQuery = useQuery({
    queryKey: qk.sources(selected ?? ""),
    queryFn: () => api.listSources(selected!).then((result) => result.data),
    enabled: Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () => api.createNotebook({ slug, name }),
    onSuccess: (notebook) => {
      setSlug("");
      setName("");
      setSelected(notebook.slug);
      void queryClient.invalidateQueries({ queryKey: qk.notebooks });
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadSource(selected!, file),
    onSuccess: (result) => {
      setStatus(`Fuente indexada: ${result.chunks} fragmentos`);
      void queryClient.invalidateQueries({ queryKey: qk.sources(selected!) });
      void queryClient.invalidateQueries({ queryKey: qk.notebooks });
    },
  });

  const ingest = useMutation({
    mutationFn: () => api.ingestUrl(selected!, url),
    onSuccess: (result) => {
      setStatus(`URL indexada: ${result.chunks} fragmentos`);
      setUrl("");
      void queryClient.invalidateQueries({ queryKey: qk.sources(selected!) });
      void queryClient.invalidateQueries({ queryKey: qk.notebooks });
    },
  });

  const search = useMutation({
    mutationFn: () => api.searchNotebook(selected!, query),
    onSuccess: (result) => setHits(result.data),
  });

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  const notebooks = notebooksQuery.data ?? [];
  const sources = sourcesQuery.data ?? [];
  const error = notebooksQuery.error ?? sourcesQuery.error ?? create.error ?? upload.error ?? ingest.error ?? search.error;

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className={pageTitle}>Bancos de información</h1>
        <p className="mt-1 text-sm text-muted">
          Notebooks con búsqueda híbrida, resúmenes de fuentes y citas verificables.
        </p>
      </header>

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
      {status && <p className="text-sm text-ok">{status}</p>}
      {error && <p className="text-sm text-danger">{error instanceof Error ? error.message : "Error de notebooks"}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {notebooks.map((notebook) => (
          <button
            key={notebook.slug}
            className={`flex flex-col gap-2 rounded-xl border bg-panel p-4 text-left text-slate-200 transition hover:border-accent ${
              selected === notebook.slug ? "border-accent" : "border-line"
            }`}
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
        ))}
        {notebooksQuery.isLoading && <p className="text-sm text-muted">Cargando notebooks…</p>}
      </div>

      {selected && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className={card}>
            <h2 className="text-base font-semibold text-slate-100">Fuentes de {selected}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".md,.markdown,.txt,.csv,.pdf,.docx"
                aria-label="Subir documento"
                className="min-w-[220px] flex-1"
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
            <ul className="flex flex-col gap-2.5">
              {sources.map((source) => (
                <li key={source.id} className="border-b border-line pb-2">
                  <strong className="text-sm">{source.title}</strong> <span className={badge}>{source.kind}</span>
                  <p className="mt-1 text-xs text-muted">{source.summary || "Sin resumen"}</p>
                </li>
              ))}
              {sourcesQuery.isLoading && <p className="text-sm text-muted">Cargando fuentes…</p>}
              {!sourcesQuery.isLoading && sources.length === 0 && (
                <p className="text-sm text-muted">Aún no hay fuentes. Sube un documento o indexa una URL.</p>
              )}
            </ul>
          </section>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-100">Probar búsqueda</h2>
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
                <article key={hit.chunkId} className="rounded-lg border border-line bg-[#0a1120] p-3">
                  <strong className="text-sm text-slate-100">{hit.citation}</strong>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted">{hit.content}</p>
                  <small className="text-xs text-muted">score {hit.score.toFixed(4)}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
