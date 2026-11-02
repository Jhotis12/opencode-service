import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { badge, buttonPrimary, card, pageTitle } from "../ui.ts";

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({ queryKey: qk.projects, queryFn: () => api.listProjects().then((result) => result.data) });
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => api.createProject({ slug, name }),
    onSuccess: () => {
      setSlug("");
      setName("");
      void queryClient.invalidateQueries({ queryKey: qk.projects });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  const projects = projectsQuery.data ?? [];
  const error = projectsQuery.error ?? create.error;

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className={pageTitle}>Proyectos y automatizaciones</h1>
        <p className="mt-1 text-sm text-muted">
          Cada proyecto vive en disco con su workflow.json, nodos y sub-agentes.
        </p>
      </header>

      <form className={`${card} !flex-row flex-wrap items-end gap-3`} onSubmit={submit} aria-label="Crear proyecto">
        <label className="min-w-[200px] flex-1">
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="ventas-bot" />
        </label>
        <label className="min-w-[200px] flex-1">
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bot de ventas" />
        </label>
        <button className={buttonPrimary} disabled={create.isPending || !slug || !name}>
          Crear proyecto
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error instanceof Error ? error.message : "Error de proyectos"}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Link
            className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4 text-slate-200 transition hover:border-accent"
            key={project.slug}
            to={`/projects/${project.slug}`}
          >
            <strong className="text-sm">{project.name}</strong>
            <span className="text-xs text-muted">{project.slug}</span>
            <p className="text-sm text-muted">{project.description || "Sin descripción"}</p>
            <span className={badge}>Abrir canvas →</span>
          </Link>
        ))}
        {projectsQuery.isLoading && <p className="text-sm text-muted">Cargando proyectos…</p>}
        {!projectsQuery.isLoading && projects.length === 0 && (
          <p className="text-sm text-muted">Aún no hay proyectos. Crea el primero arriba.</p>
        )}
      </div>
    </section>
  );
}
