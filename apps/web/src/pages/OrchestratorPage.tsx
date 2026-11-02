import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { badge, card, pageTitle, statusBadge } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";

export function OrchestratorPage() {
  useDocumentTitle("Orchestrator global");
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
    mutationFn: (message: string) => api.controlChat(message),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.controlChat }),
        queryClient.invalidateQueries({ queryKey: qk.controlOverview }),
      ]);
    },
  });
  const overview = overviewQuery.data;
  const failedRuns = (overview?.recentRuns ?? []).filter((run) => run.status === "failed" || run.status === "timed_out");
  const downIntegrations = (overview?.integrations ?? []).filter(
    (integration) => integration.status === "error" || integration.status === "needs_config",
  );

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className={pageTitle}>Orquestador global</h1>
        <p className="mt-1 text-sm text-muted">
          Agente separado de los proyectos, con contexto transversal de solo lectura. Consulta fallos, estado y conocimiento.
        </p>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-4">
          <div className={`${card} !flex-row flex-wrap gap-6`}>
            {[
              { label: "Proyectos", value: String(overview?.projects.length ?? 0) },
              { label: "Fallos recientes", value: String(failedRuns.length) },
              { label: "Errores", value: String(overview?.recentErrors.length ?? 0) },
              { label: "Integraciones caídas", value: String(downIntegrations.length) },
            ].map((item) => (
              <div className="flex min-w-[120px] flex-col gap-1" key={item.label}>
                <small className="text-xs text-muted">{item.label}</small>
                <strong className="text-lg tabular-nums text-slate-100">{item.value}</strong>
              </div>
            ))}
          </div>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-100">Proyectos</h2>
            <div className="flex flex-wrap gap-2">
              {(overview?.projects ?? []).map((project) => (
                <Link key={project.slug} className={badge} to={`/projects/${project.slug}`}>
                  {project.name} · {project.slug}
                </Link>
              ))}
              {overview?.projects.length === 0 && <p className="text-sm text-muted">Aún no hay proyectos.</p>}
            </div>
          </section>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-100">Fallos recientes</h2>
            <div className="flex flex-col gap-2">
              {failedRuns.map((run) => (
                <article className="rounded-lg border border-line bg-well p-3" key={run.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">
                      {run.projectSlug} · {run.workflowId}
                    </strong>
                    <span className={statusBadge(run.status)}>{run.status}</span>
                  </div>
                  <small className="text-xs text-muted">
                    {new Date(run.startedAt).toLocaleString()} · run {run.id.slice(0, 8)}
                  </small>
                  {run.error && <p className="mt-1 text-sm text-danger">{run.error}</p>}
                </article>
              ))}
              {failedRuns.length === 0 && <p className="text-sm text-muted">Sin fallos recientes.</p>}
            </div>
          </section>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-100">Estado de integraciones</h2>
            <div className="flex flex-wrap gap-2">
              {(overview?.integrations ?? []).map((integration) => (
                <span className={statusBadge(integration.status)} key={integration.id}>
                  {integration.name} · {integration.kind} · {integration.scope}
                  {integration.projectSlug ? ` · ${integration.projectSlug}` : ""}
                </span>
              ))}
              {overview?.integrations.length === 0 && <p className="text-sm text-muted">Sin integraciones configuradas.</p>}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:overflow-auto">
          <ChatPanel
            onSend={(message) => chat.mutateAsync(message).then((result) => result.reply)}
            hint="Pregunta por fallos, estado de proyectos o conocimiento. El orquestador consulta datos reales y no edita proyectos."
            initialMessages={chatQuery.data ?? []}
            title="Orquestador global"
            welcome="Hola. Soy el orquestador global. Puedo reportar fallos, estado de proyectos y conocimiento de toda la plataforma. No modifico proyectos sin confirmación."
            storageKey="global"
          />
        </aside>
      </div>
    </section>
  );
}
