import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ChatTurnEvent } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { RunsNavIcon } from "../components/Layout.tsx";
import { NavIcon } from "../components/NavIcon.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { badge, button, buttonGhost, card, friendlyError, sectionTitle } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

const ORIGIN_LABELS: Record<string, string> = {
  global_orchestrator: "Orquestador global",
  web_ui: "Interfaz web",
  webhook: "Webhook",
};

function originLabel(entryPoint: string): string {
  return ORIGIN_LABELS[entryPoint] ?? entryPoint;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

function OverviewSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Cargando el resumen del orquestador…
      </p>
      <div className={`${card} !flex-row flex-wrap gap-6`} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex min-w-[120px] flex-col gap-2" key={index}>
            <div className="w-24">
              <Skeleton shape="line" size="sm" />
            </div>
            <div className="w-10">
              <Skeleton shape="line" size="lg" />
            </div>
          </div>
        ))}
      </div>
      <div className={card} aria-hidden="true">
        <div className="w-28">
          <Skeleton shape="line" size="md" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="w-32" key={index}>
              <Skeleton shape="line" size="sm" />
            </div>
          ))}
        </div>
      </div>
      <div className={card} aria-hidden="true">
        <div className="w-40">
          <Skeleton shape="line" size="md" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton shape="block" size="sm" key={index} />
          ))}
        </div>
      </div>
      <div className={card} aria-hidden="true">
        <div className="w-36">
          <Skeleton shape="line" size="md" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div className="w-48" key={index}>
              <Skeleton shape="line" size="sm" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function OrchestratorPage() {
  useDocumentTitle("Orquestador global");
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: qk.controlOverview,
    queryFn: () => api.controlOverview(),
  });
  const chatQuery = useQuery({
    queryKey: qk.controlChat,
    queryFn: () => api.controlChatHistory().then((result) => result.data),
  });
  const chat = useMutation({
    mutationFn: ({ message, onEvent }: { message: string; onEvent?: (event: ChatTurnEvent) => void }) =>
      api.controlChat(message, onEvent),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.controlChat }),
        queryClient.invalidateQueries({ queryKey: qk.controlOverview }),
      ]);
    },
  });
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("chat.turn.updated", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { scope?: string; status: string };
      if (data.scope !== "global") return;
      if (["succeeded", "failed", "timed_out", "cancelled", "unknown"].includes(data.status)) {
        void queryClient.invalidateQueries({ queryKey: qk.controlChat });
        void queryClient.invalidateQueries({ queryKey: qk.controlOverview });
      }
    });
    return () => source.close();
  }, [queryClient]);

  const overview = overviewQuery.data;
  const failedRuns = (overview?.recentRuns ?? []).filter((run) => run.status === "failed" || run.status === "timed_out");
  const downIntegrations = (overview?.integrations ?? []).filter(
    (integration) => integration.status === "error" || integration.status === "needs_config",
  );

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        title="Orquestador global"
        description="Agente separado de los proyectos, con contexto transversal de solo lectura. Consulta fallos, estado y conocimiento."
        actions={
          <button
            type="button"
            className={button}
            onClick={() => void overviewQuery.refetch()}
            disabled={overviewQuery.isFetching}
          >
            {overviewQuery.isFetching ? "Actualizando…" : "Actualizar"}
          </button>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-4">
          {overviewQuery.isPending ? (
            <OverviewSkeleton />
          ) : overviewQuery.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3" role="alert">
              <p className="text-sm text-danger">
                {friendlyError(overviewQuery.error, "No se pudo cargar el resumen del orquestador.")}
              </p>
              <button type="button" className={buttonGhost} onClick={() => void overviewQuery.refetch()}>
                Reintentar
              </button>
            </div>
          ) : overview ? (
            <>
              <div className={`${card} !flex-row flex-wrap gap-6`}>
                {[
                  { label: "Proyectos", value: String(overview.projects.length) },
                  { label: "Fallos recientes", value: String(failedRuns.length) },
                  { label: "Errores", value: String(overview.recentErrors.length) },
                  { label: "Integraciones caídas", value: String(downIntegrations.length) },
                ].map((item) => (
                  <div className="flex min-w-[120px] flex-col gap-1" key={item.label}>
                    <small className="text-xs text-muted">{item.label}</small>
                    <strong className="text-base tabular-nums text-slate-100">{item.value}</strong>
                  </div>
                ))}
              </div>

              <section className={card} aria-labelledby="orchestrator-projects">
                <h2 className={sectionTitle} id="orchestrator-projects">
                  Proyectos
                </h2>
                {overview.projects.length === 0 ? (
                  <EmptyState
                    icon={<NavIcon name="projects" />}
                    title="Todavía no hay proyectos"
                    description="Crea un proyecto y aparecerá aquí para que el orquestador pueda reportar su estado."
                    action={
                      <Link className={button} to="/projects">
                        Ir a proyectos
                      </Link>
                    }
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {overview.projects.map((project) => (
                      <Link key={project.slug} className={badge} to={`/projects/${project.slug}`}>
                        {project.name} · {project.slug}
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className={card} aria-labelledby="orchestrator-recent-runs">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={sectionTitle} id="orchestrator-recent-runs">
                    Ejecuciones recientes
                  </h2>
                  <Link className={buttonGhost} to="/runs">
                    Ver todas
                  </Link>
                </header>
                {overview.recentRuns.length === 0 ? (
                  <EmptyState
                    icon={<RunsNavIcon />}
                    title="Sin ejecuciones todavía"
                    description="Cuando un flujo se ejecute en cualquier proyecto, aparecerá aquí con su estado y podrás seguirlo en Ejecuciones."
                    action={
                      <Link className={button} to="/projects">
                        Ir a proyectos
                      </Link>
                    }
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {overview.recentRuns.map((run) => (
                      <li key={run.id}>
                        <Link
                          to="/runs"
                          className="flex flex-col gap-1 rounded-lg border border-line bg-well p-3 transition hover:border-line-strong"
                        >
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="truncate text-sm text-slate-200" title={`${run.projectSlug} · ${run.workflowId}`}>
                              {run.projectSlug} · {run.workflowId}
                            </strong>
                            <StatusBadge status={run.status} />
                          </span>
                          <small className="text-xs text-muted">
                            {formatWhen(run.startedAt)} · run {run.id.slice(0, 8)}
                          </small>
                          {run.error && (
                            <small className="truncate text-xs text-danger" title={run.error}>
                              {run.error}
                            </small>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={card} aria-labelledby="orchestrator-recent-errors">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={sectionTitle} id="orchestrator-recent-errors">
                    Errores recientes
                  </h2>
                  <Link className={buttonGhost} to="/runs">
                    Ver ejecuciones
                  </Link>
                </header>
                {overview.recentErrors.length === 0 ? (
                  <EmptyState
                    icon={<NavIcon name="health" />}
                    title="Sin errores recientes"
                    description="No hay errores registrados en la plataforma. Si aparece uno, lo verás aquí con su origen y hora."
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {overview.recentErrors.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          to="/runs"
                          className="flex flex-col gap-1 rounded-lg border border-line bg-well p-3 transition hover:border-line-strong"
                        >
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="truncate text-sm text-slate-200" title={entry.message}>
                              {entry.message}
                            </strong>
                            <small className="text-xs text-muted" title={entry.entryPoint}>
                              {originLabel(entry.entryPoint)}
                            </small>
                          </span>
                          <small className="text-xs text-muted">{formatWhen(entry.createdAt)}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={card} aria-labelledby="orchestrator-integrations">
                <h2 className={sectionTitle} id="orchestrator-integrations">
                  Estado de integraciones
                </h2>
                {overview.integrations.length === 0 ? (
                  <EmptyState
                    icon={<NavIcon name="settings" />}
                    title="Sin integraciones configuradas"
                    description="Conecta canales como Telegram o transcripción desde Ajustes para que los flujos puedan usarlos."
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {overview.integrations.map((integration) => (
                      <span key={integration.id} className="inline-flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={integration.status} />
                        <span>
                          {integration.name} · {integration.kind} · {integration.scope}
                          {integration.projectSlug ? ` · ${integration.projectSlug}` : ""}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>

        <aside
          className="flex flex-col gap-3 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:overflow-auto"
          aria-label="Chat del orquestador global"
        >
          <ChatPanel
            onSend={(message, onEvent) => chat.mutateAsync({ message, onEvent })}
            onAttachTurn={(turnId, onEvent) => api.attachControlChatTurn(turnId, onEvent)}
            onCancelTurn={(turnId) => api.cancelControlChatTurn(turnId)}
            onRetryTurn={(turnId) => api.retryControlChatTurn(turnId)}
            hint="Pregunta por fallos, estado de proyectos o conocimiento. El orquestador consulta datos reales y no edita proyectos."
            initialMessages={chatQuery.data ?? []}
            historyStatus={chatQuery.isPending ? "loading" : chatQuery.isError ? "error" : "ready"}
            historyError={
              chatQuery.isError
                ? friendlyError(chatQuery.error, "No se pudo cargar el historial del chat.")
                : undefined
            }
            onRetryHistory={() => void chatQuery.refetch()}
            title="Orquestador global"
            welcome="Hola. Soy el orquestador global. Puedo reportar fallos, estado de proyectos y conocimiento de toda la plataforma. No modifico proyectos sin confirmación."
            storageKey="global"
          />
        </aside>
      </div>
    </section>
  );
}
