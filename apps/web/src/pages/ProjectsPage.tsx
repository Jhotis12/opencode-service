import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ProjectSummary } from "../api.ts";
import { qk } from "../query.ts";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { Field } from "../components/Field.tsx";
import { Modal } from "../components/Modal.tsx";
import { NavIcon } from "../components/NavIcon.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { notifyError, notifySuccess } from "../components/Toast.tsx";
import {
  badge,
  button,
  buttonDanger,
  buttonGhost,
  buttonPrimary,
  card,
  friendlyError,
  muted,
  sectionTitle,
  smallMuted,
} from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

type ProjectTemplateId = "blank" | "triaje-operativo";

const ONBOARDING_KEY = "platform.onboarding.dismissed";

const ONBOARDING_STEPS: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "Proyecto",
    description: "Agrupa tu caso de uso: agentes, integraciones, conocimiento y secretos.",
  },
  {
    title: "Flujo",
    description: "Describe en el canvas los pasos, las decisiones y las herramientas de cada etapa.",
  },
  {
    title: "Ejecución",
    description: "OpenCode corre el flujo y deja cada corrida registrada con su resultado.",
  },
];

function onboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    // Storage can be unavailable (private browsing, blocked cookies); the guide stays visible.
    return false;
  }
}

function persistOnboardingDismissed() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Storage can be unavailable; the guide then only hides for the current session.
  }
}

const TEMPLATES: ReadonlyArray<{ id: ProjectTemplateId; name: string; description: string }> = [
  {
    id: "blank",
    name: "En blanco",
    description: "Empieza con un canvas vacío y arma el flujo a mano.",
  },
  {
    id: "triaje-operativo",
    name: "Triaje operativo",
    description: "Vertical de referencia con entrada, agentes de triaje y salidas operativas.",
  },
];

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
  useDocumentTitle("Proyectos");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const projectsQuery = useQuery({ queryKey: qk.projects, queryFn: () => api.listProjects().then((result) => result.data) });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary>();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<ProjectTemplateId>("blank");
  const [slugTouched, setSlugTouched] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [slugError, setSlugError] = useState<string>();
  const [showOnboarding, setShowOnboarding] = useState(() => !onboardingDismissed());

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
    setNameError(undefined);
    setSlugError(undefined);
  }

  function closeCreate() {
    setCreateOpen(false);
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
      notifySuccess(`Proyecto ${result.project.name} creado`);
      setCreateOpen(false);
      resetCreate();
      navigate(`/projects/${result.project.slug}`);
    },
    onError: (error) => notifyError(friendlyError(error, "No se pudo crear el proyecto.")),
  });

  const remove = useMutation({
    mutationFn: (project: ProjectSummary) => api.deleteProject(project.slug),
    onSuccess: async (_result, project) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.projects }),
        queryClient.invalidateQueries({ queryKey: qk.controlOverview }),
      ]);
      setDeleteTarget(undefined);
      notifySuccess(`Proyecto ${project.name} eliminado`);
    },
    onError: (error) => {
      setDeleteTarget(undefined);
      notifyError(friendlyError(error, "No se pudo eliminar el proyecto."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextNameError = name.trim() ? undefined : "El nombre es obligatorio.";
    const nextSlugError = /^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)
      ? undefined
      : "El slug debe tener entre 2 y 61 caracteres: minúsculas, números y guiones.";
    setNameError(nextNameError);
    setSlugError(nextSlugError);
    if (nextNameError) {
      document.getElementById("new-project-name")?.focus();
      return;
    }
    if (nextSlugError) {
      document.getElementById("new-project-slug")?.focus();
      return;
    }
    create.mutate();
  }

  function onNameChange(value: string) {
    setName(value);
    setNameError(undefined);
    if (!slugTouched) setSlug(slugify(value));
  }

  function onSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(slugify(value));
    setSlugError(undefined);
  }

  function dismissOnboarding() {
    setShowOnboarding(false);
    persistOnboardingDismissed();
  }

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        title="Automatizaciones agénticas sobre OpenCode"
        description="Cada proyecto es un caso de uso: define un flujo en el canvas, dale agentes, integraciones y conocimiento, y ejecútalo con OpenCode como motor."
        actions={
          <button type="button" className={buttonPrimary} onClick={() => setCreateOpen(true)}>
            Nuevo proyecto
          </button>
        }
      />

      {showOnboarding && (
        <section
          aria-labelledby="onboarding-title"
          className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-panel/90 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="onboarding-title" className={sectionTitle}>
                Cómo funciona
              </h2>
              <p className={`max-w-3xl ${muted}`}>
                Todo caso de uso recorre tres niveles: un proyecto que agrupa todo, un flujo que describes en el canvas y una
                ejecución que dispara OpenCode.
              </p>
            </div>
            <button
              type="button"
              className={buttonGhost}
              aria-label="Descartar la guía de cómo funciona"
              onClick={dismissOnboarding}
            >
              Descartar
            </button>
          </div>

          <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {ONBOARDING_STEPS.map((step, index) => (
              <li className="flex flex-1 items-center gap-2" key={step.title}>
                <div className="flex flex-1 flex-col gap-1 rounded-xl border border-line bg-well px-3.5 py-3">
                  <span className="text-sm font-medium text-slate-200">{step.title}</span>
                  <span className={smallMuted}>{step.description}</span>
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <svg
                    aria-hidden="true"
                    className="hidden h-4 w-4 shrink-0 text-muted sm:block"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                )}
              </li>
            ))}
          </ol>

          {projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={buttonPrimary} onClick={() => setCreateOpen(true)}>
                Crear un proyecto
              </button>
              <p className={smallMuted}>O abre un proyecto existente y configúralo paso a paso.</p>
            </div>
          )}
        </section>
      )}

      {projectsQuery.isLoading && (
        <p className="sr-only" role="status">
          Cargando proyectos…
        </p>
      )}

      {projectsQuery.isLoading ? (
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div className={card} key={index}>
              <div className="w-2/3">
                <Skeleton shape="line" size="md" />
              </div>
              <div className="w-1/3">
                <Skeleton shape="line" size="sm" />
              </div>
              <Skeleton shape="block" size="sm" />
              <div className="w-24">
                <Skeleton shape="line" size="sm" />
              </div>
            </div>
          ))}
        </div>
      ) : projectsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-sm text-danger">
            {projectsQuery.error instanceof Error ? projectsQuery.error.message : "No se pudieron cargar los proyectos."}
          </p>
          <button type="button" className={buttonGhost} onClick={() => void projectsQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<NavIcon name="projects" />}
          title="Todavía no hay proyectos"
          description="Crea tu primer caso de uso y configúralo desde el canvas: trigger, agentes, canales y conocimiento."
          action={
            <button type="button" className={buttonPrimary} onClick={() => setCreateOpen(true)}>
              Crear primer proyecto
            </button>
          }
        />
      ) : (
        <>
          <search className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full max-w-md items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, slug o descripción…"
                aria-label="Buscar proyectos"
                autoCapitalize="none"
                spellCheck={false}
              />
              {search.trim() !== "" && (
                <button type="button" className={buttonGhost} onClick={() => setSearch("")}>
                  Limpiar
                </button>
              )}
            </div>
            <span className={`${badge} tabular-nums`}>
              {filtered.length} de {projects.length} proyectos
            </span>
          </search>
          {filtered.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <article className={`${card} justify-between`} key={project.slug}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-100">
                          <Link className="block truncate hover:text-accent" to={`/projects/${project.slug}`}>
                            {project.name}
                          </Link>
                        </h2>
                        <code className="text-[11px] text-muted">{project.slug}</code>
                      </div>
                      <span className={`${badge} shrink-0`}>{formatDate(project.createdAt)}</span>
                    </div>
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted">
                      {project.description || "Sin descripción. Puedes agregarla en los ajustes del proyecto."}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`${badge} max-w-full`} title={project.primaryAgent ?? "sin definir"}>
                        <span className="truncate">Agente: {project.primaryAgent ?? "sin definir"}</span>
                      </span>
                      <span className={`${badge} max-w-full`} title={project.defaultModel ?? "global"}>
                        <span className="truncate">Modelo: {project.defaultModel ?? "global"}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                    <Link className={button} to={`/projects/${project.slug}`}>
                      Abrir proyecto
                    </Link>
                    <button
                      type="button"
                      className={buttonDanger}
                      onClick={() => {
                        setDeleteTarget(project);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<NavIcon name="projects" />}
              title="No encontramos proyectos"
              description="Ningún proyecto coincide con la búsqueda. Prueba con otro nombre, slug o descripción."
              action={
                <button type="button" className={buttonGhost} onClick={() => setSearch("")}>
                  Limpiar búsqueda
                </button>
              }
            />
          )}
        </>
      )}

      {createOpen && (
        <Modal title="Nuevo proyecto" onClose={closeCreate} size="md">
          <p className="text-xs text-muted">
            Un proyecto es un caso de uso autocontenido. Al crearlo se preparan el canvas, el agente principal y la carpeta de conocimiento.
          </p>
          <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
            <Field
              id="new-project-name"
              label="Nombre del proyecto"
              hint="Es el nombre que verás en el canvas y en los reportes."
              error={nameError}
            >
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Bot de ventas"
                autoFocus
                required
                autoComplete="off"
              />
            </Field>
            <Field
              id="new-project-slug"
              label="Slug"
              hint="Identificador estable de la carpeta. Solo minúsculas, números y guiones."
              error={slugError}
            >
              <input
                value={slug}
                onChange={(event) => onSlugChange(event.target.value)}
                placeholder="bot-ventas"
                required
                autoComplete="off"
              />
            </Field>
            <Field
              id="new-project-description"
              label="Descripción"
              hint="Opcional. Ayuda a recordar el objetivo del caso de uso."
            >
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Atiende consultas de ventas y califica leads por Telegram."
                maxLength={500}
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-slate-300">Plantilla inicial</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATES.map((item) => (
                  <label className="cursor-pointer" key={item.id}>
                    <input
                      type="radio"
                      name="template"
                      value={item.id}
                      checked={template === item.id}
                      onChange={() => setTemplate(item.id)}
                      className="peer sr-only"
                    />
                    <span className="flex h-full flex-col gap-1 rounded-xl border border-line bg-well px-3.5 py-3 transition-colors peer-checked:border-accent peer-checked:bg-panel-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-200">{item.name}</span>
                        {template === item.id && (
                          <span aria-hidden="true" className="text-accent">
                            ✓
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonGhost} onClick={closeCreate}>
                Cancelar
              </button>
              <button type="submit" className={buttonPrimary} disabled={create.isPending}>
                {create.isPending ? "Creando…" : "Crear proyecto"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar proyecto"
          confirmLabel="Eliminar definitivamente"
          confirmationText={deleteTarget.slug}
          pending={remove.isPending}
          onCancel={() => setDeleteTarget(undefined)}
          onConfirm={() => remove.mutate(deleteTarget)}
        >
          <p className="text-sm text-slate-200">
            Vas a eliminar <strong>{deleteTarget.name}</strong>.
          </p>
          <p className="text-sm text-muted">
            Se borrarán del disco y de la base: workflow, nodos, agentes, conocimiento, integraciones, secretos, chats y ejecuciones.
            Esta acción no se puede deshacer.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
