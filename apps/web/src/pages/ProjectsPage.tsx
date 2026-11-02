import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ProjectSummary } from "../api.ts";
import { qk } from "../query.ts";
import { Modal } from "../components/Modal.tsx";
import { badge, button, buttonDanger, buttonGhost, buttonPrimary, card, pageTitle } from "../ui.ts";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const projectsQuery = useQuery({ queryKey: qk.projects, queryFn: () => api.listProjects().then((result) => result.data) });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<"blank" | "triaje-operativo">("blank");
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [status, setStatus] = useState<string>();

  const projects = projectsQuery.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) =>
      [project.name, project.slug, project.description].some((value) => value.toLowerCase().includes(term)),
    );
  }, [projects, search]);

  function resetCreate() {
    setName("");
    setSlug("");
    setDescription("");
    setTemplate("blank");
    setSlugTouched(false);
    setFormError(undefined);
  }

  const create = useMutation({
    mutationFn: () =>
      api.createProject({
        slug,
        name,
        description: description.trim() || undefined,
        ...(template === "blank" ? {} : { template }),
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: qk.projects });
      setStatus(`Proyecto ${result.project.name} creado`);
      setCreateOpen(false);
      resetCreate();
      navigate(`/projects/${result.project.slug}`);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "No se pudo crear el proyecto"),
  });

  const remove = useMutation({
    mutationFn: (project: ProjectSummary) => api.deleteProject(project.slug),
    onSuccess: async (_result, project) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.projects }),
        queryClient.invalidateQueries({ queryKey: qk.controlOverview }),
      ]);
      setDeleteTarget(undefined);
      setDeleteConfirm("");
      setStatus(`Proyecto ${project.name} eliminado`);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "No se pudo eliminar el proyecto"),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (!name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) {
      setFormError("El slug debe tener entre 2 y 61 caracteres: minúsculas, números y guiones.");
      return;
    }
    create.mutate();
  }

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Proyectos y automatizaciones</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Cada proyecto es un caso de uso con su trigger, flujo, agentes, integraciones, secretos y conocimiento.
          </p>
        </div>
        <button className={buttonPrimary} onClick={() => setCreateOpen(true)}>
          Nuevo proyecto
        </button>
      </header>

      {status && (
        <p className="text-sm text-ok" aria-live="polite">
          {status}
        </p>
      )}
      {(projectsQuery.error || formError) && !createOpen && !deleteTarget && (
        <p className="text-sm text-danger">
          {formError ?? (projectsQuery.error instanceof Error ? projectsQuery.error.message : "Error de proyectos")}
        </p>
      )}

      {projects.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, slug o descripción…"
            aria-label="Buscar proyectos"
            className="max-w-md"
          />
          <span className={badge}>
            {filtered.length} de {projects.length} proyectos
          </span>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <article className={`${card} justify-between`} key={project.slug}>
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link className="block truncate text-base font-semibold text-slate-100 hover:text-accent" to={`/projects/${project.slug}`}>
                      {project.name}
                    </Link>
                    <code className="text-[11px] text-muted">{project.slug}</code>
                  </div>
                  <span className={badge}>{formatDate(project.createdAt)}</span>
                </div>
                <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted">
                  {project.description || "Sin descripción. Puedes agregarla en los ajustes del proyecto."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className={badge}>Agente: {project.primaryAgent ?? "sin definir"}</span>
                  <span className={badge}>Modelo: {project.defaultModel ?? "global"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                <Link className={button} to={`/projects/${project.slug}`}>
                  Abrir canvas
                </Link>
                <button
                  className={buttonDanger}
                  onClick={() => {
                    setDeleteTarget(project);
                    setDeleteConfirm("");
                    setFormError(undefined);
                  }}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !projectsQuery.isLoading && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-panel/60 px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-2xl text-accent">+</span>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                {projects.length === 0 ? "Todavía no hay proyectos" : "No encontramos proyectos"}
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                {projects.length === 0
                  ? "Crea tu primer caso de uso y configúralo desde el canvas: trigger, agentes, canales y conocimiento."
                  : "Prueba con otro nombre, slug o descripción."}
              </p>
            </div>
            {projects.length === 0 && (
              <button className={buttonPrimary} onClick={() => setCreateOpen(true)}>
                Crear primer proyecto
              </button>
            )}
          </div>
        )
      )}

      {projectsQuery.isLoading && <p className="text-sm text-muted">Cargando proyectos…</p>}

      {createOpen && (
        <Modal
          title="Nuevo proyecto"
          onClose={() => {
            setCreateOpen(false);
            setFormError(undefined);
          }}
          size="md"
        >
          <p className="text-xs text-muted">
            Un proyecto es un caso de uso autocontenido. Al crearlo se preparan el canvas, el agente principal y la carpeta de conocimiento.
          </p>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <label>
              Nombre del proyecto
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Bot de ventas"
                autoFocus
                required
              />
              <small className="text-[11px] text-muted">Es el nombre que verás en el canvas y en los reportes.</small>
            </label>
            <label>
              Slug
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="bot-ventas"
                required
              />
              <small className="text-[11px] text-muted">
                Identificador estable de la carpeta. Solo minúsculas, números y guiones.
              </small>
            </label>
            <label>
              Descripción
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Atiende consultas de ventas y califica leads por Telegram."
                maxLength={500}
              />
              <small className="text-[11px] text-muted">Opcional. Ayuda a recordar el objetivo del caso de uso.</small>
            </label>
            <label>
              Plantilla inicial
              <select
                value={template}
                onChange={(event) => setTemplate(event.target.value as "blank" | "triaje-operativo")}
              >
                <option value="blank">En blanco (inicio manual)</option>
                <option value="triaje-operativo">Triaje operativo (vertical de referencia)</option>
              </select>
            </label>
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={buttonGhost}
                onClick={() => {
                  setCreateOpen(false);
                  setFormError(undefined);
                }}
              >
                Cancelar
              </button>
              <button className={buttonPrimary} disabled={create.isPending || !name.trim() || !slug}>
                {create.isPending ? "Creando…" : "Crear proyecto"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Eliminar proyecto" onClose={() => setDeleteTarget(undefined)} size="sm">
          <p className="text-sm text-slate-200">
            Vas a eliminar <strong>{deleteTarget.name}</strong>.
          </p>
          <p className="text-sm text-muted">
            Se borrarán del disco y de la base: workflow, nodos, agentes, conocimiento, integraciones, secretos, chats y ejecuciones.
            Esta acción no se puede deshacer.
          </p>
          <label>
            Escribe <code>{deleteTarget.slug}</code> para confirmar
            <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} autoFocus />
          </label>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button className={buttonGhost} onClick={() => setDeleteTarget(undefined)}>
              Cancelar
            </button>
            <button
              className={buttonDanger}
              disabled={remove.isPending || deleteConfirm !== deleteTarget.slug}
              onClick={() => remove.mutate(deleteTarget)}
            >
              {remove.isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
