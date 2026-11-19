import type { MouseEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, type ApprovalRecord, type RunRecord } from "../api.ts";
import { qk } from "../query.ts";
import { badge, buttonGhost, buttonPrimary, card, friendlyError, muted, sectionTitle, smallMuted, statusBadge } from "../ui.ts";
import { EmptyState } from "./EmptyState.tsx";
import { ProjectDestinationsPanel } from "./ProjectDestinationsPanel.tsx";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel.tsx";
import { Tabs, type TabItem } from "./Tabs.tsx";

const SECTIONS = [
  ["general", "General"],
  ["approvals", "Aprobaciones"],
  ["schedules", "Programaciones"],
  ["destinations", "Destinos"],
  ["secrets", "Secretos"],
  ["readiness", "Preparación"],
] as const;

type ConfigurationSection = (typeof SECTIONS)[number][0];

const DEFAULT_SECTION: ConfigurationSection = "general";

function isSection(value: string | null): value is ConfigurationSection {
  return SECTIONS.some(([key]) => key === value);
}

export function ProjectConfigurationPanel({
  projectSlug,
  navigationBlocked = false,
  onNavigateBlocked,
}: {
  projectSlug: string;
  navigationBlocked?: boolean;
  onNavigateBlocked?(target: string): void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section: ConfigurationSection = isSection(requested) ? requested : DEFAULT_SECTION;
  const integrationsPath = `/projects/${projectSlug}/integrations`;

  function selectSection(next: ConfigurationSection) {
    const params = new URLSearchParams(searchParams);
    if (next === DEFAULT_SECTION) params.delete("section");
    else params.set("section", next);
    setSearchParams(params, { replace: true });
  }

  function guardNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (!navigationBlocked) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigateBlocked?.(integrationsPath);
  }

  function renderSection(key: ConfigurationSection): ReactNode {
    switch (key) {
      case "general":
        return <ProjectSettingsPanel projectSlug={projectSlug} section="general" />;
      case "approvals":
        return <ProjectApprovalsSection projectSlug={projectSlug} />;
      case "schedules":
        return <ProjectSchedulesSection projectSlug={projectSlug} />;
      case "destinations":
        return <ProjectDestinationsPanel projectSlug={projectSlug} />;
      case "secrets":
        return <ProjectSettingsPanel projectSlug={projectSlug} section="secrets" />;
      case "readiness":
        return <ProjectSettingsPanel projectSlug={projectSlug} section="readiness" />;
    }
  }

  const items: TabItem[] = SECTIONS.map(([key, label]) => ({
    id: key,
    label,
    content: key === section ? renderSection(key) : null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Tabs
          items={items}
          value={section}
          onValueChange={(next) => {
            if (isSection(next)) selectSection(next);
          }}
          aria-label="Secciones de configuración"
        />
        <p className={smallMuted}>
          Las conexiones, canales y bases de datos se gestionan en{" "}
          <Link className="text-accent hover:underline" to={integrationsPath} onClick={guardNavigation}>
            Integraciones
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

interface PendingApproval {
  run: RunRecord;
  approval: ApprovalRecord;
}

function ProjectApprovalsSection({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const pendingKey = ["project-approvals", projectSlug] as const;
  const settingsQuery = useQuery({
    queryKey: qk.projectSettings(projectSlug),
    queryFn: () => api.getProjectSettings(projectSlug),
  });
  const pendingQuery = useQuery({
    queryKey: pendingKey,
    queryFn: async (): Promise<PendingApproval[]> => {
      const runs = (await api.listRuns(projectSlug)).data.filter((run) => run.status === "paused");
      const groups = await Promise.all(
        runs.map(async (run) => ({
          run,
          approvals: (await api.listApprovals(projectSlug, run.id)).data,
        })),
      );
      return groups.flatMap(({ run, approvals }) =>
        approvals.filter((approval) => approval.status === "pending").map((approval) => ({ run, approval })),
      );
    },
  });
  const decide = useMutation({
    mutationFn: (input: { run: RunRecord; approval: ApprovalRecord; decision: "approve" | "reject" }) =>
      api.decideApproval(projectSlug, input.run.id, input.approval.nodeId, input.decision),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pendingKey });
      await queryClient.invalidateQueries({ queryKey: qk.runs(projectSlug) });
    },
  });

  const settings = settingsQuery.data;
  const integration = settings?.project.approvalIntegrationId
    ? settings.integrations.find((item) => item.id === settings.project.approvalIntegrationId)
    : undefined;
  const recipient = settings?.project.approvalRecipient;
  const pending = pendingQuery.data ?? [];
  const loadError = pendingQuery.error ?? settingsQuery.error;

  return (
    <div className="flex flex-col gap-4">
      <section className={card} aria-label="Canal de aprobación">
        <h2 className={sectionTitle}>Canal de aprobación</h2>
        <p className={muted}>
          Las aprobaciones pausan la ejecución hasta que alguien decide. El canal se configura en la sección General del
          proyecto.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className={badge}>
            Canal: {integration ? `${integration.name} · ${integration.kind}` : "solo interfaz web"}
          </span>
          <span className={badge}>Destinatario: {recipient || "sin destinatario"}</span>
        </div>
      </section>

      {loadError ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-danger">{friendlyError(loadError, "No se pudieron cargar las aprobaciones.")}</p>
          <button
            type="button"
            className={buttonGhost}
            onClick={() => {
              void pendingQuery.refetch();
              if (settingsQuery.error) void settingsQuery.refetch();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : pendingQuery.isLoading ? (
        <p className={smallMuted}>Cargando aprobaciones pendientes…</p>
      ) : (
        <>
          {decide.error && (
            <div className={`${card} flex-row flex-wrap items-center justify-between gap-3`} role="alert">
              <p className="text-sm text-danger">{friendlyError(decide.error, "No se pudo registrar la decisión.")}</p>
              <button
                type="button"
                className={buttonGhost}
                onClick={() => {
                  decide.reset();
                  void pendingQuery.refetch();
                }}
              >
                Descartar
              </button>
            </div>
          )}
          {pending.length === 0 ? (
            <EmptyState
              icon={<ApprovalsIcon />}
              title="Sin aprobaciones pendientes"
              description="Las ejecuciones pausadas esperando una decisión aparecerán aquí. Para pedir aprobación, añade un nodo Aprobación al flujo."
            />
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Aprobaciones pendientes">
              {pending.map(({ run, approval }) => (
                <li key={approval.id} className={`${card} flex-row flex-wrap items-center justify-between gap-3`}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm text-slate-200">Nodo {approval.nodeId}</p>
                    <p className={smallMuted}>
                      Ejecución {run.id} · solicitada {new Date(approval.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={statusBadge(approval.status)}>{approval.status}</span>
                    <button
                      type="button"
                      className={buttonPrimary}
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ run, approval, decision: "approve" })}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className={buttonGhost}
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ run, approval, decision: "reject" })}
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ProjectSchedulesSection({ projectSlug }: { projectSlug: string }) {
  const schedulesQuery = useQuery({
    queryKey: qk.schedules(projectSlug),
    queryFn: () => api.listSchedules(projectSlug).then((result) => result.data),
  });
  const schedules = schedulesQuery.data ?? [];

  if (schedulesQuery.error) {
    return (
      <div className={`${card} items-start`} role="alert">
        <p className="text-sm text-danger">{friendlyError(schedulesQuery.error, "No se pudieron cargar las programaciones.")}</p>
        <button type="button" className={buttonGhost} onClick={() => void schedulesQuery.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (schedulesQuery.isLoading) return <p className={smallMuted}>Cargando programaciones…</p>;

  if (schedules.length === 0) {
    return (
      <EmptyState
        icon={<SchedulesIcon />}
        title="Sin programaciones"
        description="Ningún disparador del flujo está configurado con programación. Añade un nodo Disparador con tipo Programación en el editor para ejecutarlo por cron."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Programaciones del flujo">
      {schedules.map((schedule) => (
        <li key={`${schedule.workflowId}-${schedule.nodeId}`} className={`${card} flex-row flex-wrap items-start justify-between gap-3`}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm text-slate-200">Nodo {schedule.nodeId}</p>
            <p className={smallMuted}>Zona horaria {schedule.timezone}</p>
            <p className={smallMuted}>
              Próxima: {schedule.nextWindowAt ? new Date(schedule.nextWindowAt).toLocaleString() : "sin próxima ventana"}
              {" · "}
              Última: {schedule.lastWindowAt ? new Date(schedule.lastWindowAt).toLocaleString() : "nunca"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={statusBadge(schedule.enabled ? "ok" : "paused")}>
              {schedule.enabled ? "Activa" : "Pausada"}
            </span>
            <span className={badge}>Solapamiento: {schedule.overlapPolicy === "allow" ? "permitido" : "omitir"}</span>
            {schedule.catchUp && <span className={badge}>Recupera ventanas ({schedule.catchUpWindowMinutes} min)</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ApprovalsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

function SchedulesIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6M12 5V2" />
    </svg>
  );
}
