import { Suspense, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { ProjectTopBar, activeProjectTab } from "../components/ProjectTopBar.tsx";
import { RunDetailModal } from "../components/RunDetailModal.tsx";
import { RunLaunchModal } from "../components/RunLaunchModal.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { qk } from "../query.ts";
import { buttonGhost, card, friendlyError } from "../ui.ts";
import { useDocumentTitle } from "../useDocumentTitle.ts";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "./project-workspace.tsx";

export function ProjectLayout() {
  const { slug = "" } = useParams();
  return (
    <ProjectWorkspaceProvider slug={slug}>
      <ProjectWorkspaceShell />
    </ProjectWorkspaceProvider>
  );
}

function SectionFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6" aria-busy="true" aria-label="Cargando sección">
      <Skeleton shape="line" size="lg" className="max-w-md" />
      <Skeleton shape="block" size="md" />
      <Skeleton shape="block" size="md" />
    </div>
  );
}

function ProjectWorkspaceShell() {
  const workspace = useProjectWorkspace();
  const queryClient = useQueryClient();
  const location = useLocation();
  const active = activeProjectTab(location.pathname);
  // The workspace provider already owns this query; subscribing with the same key and
  // fetcher surfaces its loading/error state to the chat drawer without a second request.
  const chatHistoryQuery = useQuery({
    queryKey: qk.chat(workspace.slug),
    queryFn: () => api.chatHistory(workspace.slug).then((result) => result.data),
    enabled: Boolean(workspace.slug),
  });
  useDocumentTitle(workspace.graph?.name ?? "Proyecto");

  useEffect(() => {
    if (!workspace.dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [workspace.dirty]);

  if (!workspace.graph) {
    if (workspace.displayError) {
      return (
        <section className={`${card} m-4 items-start`} role="alert">
          <p className="text-sm text-danger">{workspace.displayError}</p>
          <button
            type="button"
            className={buttonGhost}
            onClick={() => void queryClient.refetchQueries({ queryKey: qk.workflow(workspace.slug) })}
          >
            Reintentar
          </button>
        </section>
      );
    }
    return (
      <section>
        <p className="text-sm text-muted">Cargando proyecto…</p>
      </section>
    );
  }

  const graph = workspace.graph;
  const detailRun = workspace.detailRun;
  // The pill is the page's only always-on bottom-right affordance; pages that render their own
  // bottom-centre notices (the flow canvas) reserve its band so the two cannot overlap.
  const chatPillVisible = !workspace.chatOpen && (workspace.chatBusy || workspace.chatUnread);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ProjectTopBar
        slug={workspace.slug}
        graph={graph}
        tab={active}
        counts={{ runs: workspace.runs.length, agents: workspace.agents.length, integrations: workspace.integrations.length }}
        dirty={workspace.dirty}
        issueCount={workspace.graphIssues.length}
        saving={workspace.saving}
        models={workspace.models}
        chatBusy={workspace.chatBusy}
        chatUnread={workspace.chatUnread}
        versions={workspace.versions}
        navigationBlocked={workspace.dirty}
        onNavigateBlocked={(target) => workspace.requestNavigate(target)}
        onChange={(patch) => workspace.changeGraph({ ...graph, ...patch })}
        onSave={() => workspace.saveWorkflow(graph)}
        onRun={() => workspace.setLaunchOpen(true)}
        onChat={() => {
          workspace.setChatOpen(true);
          workspace.setChatUnread(false);
        }}
        onRollbackVersion={(version) => workspace.rollbackVersion(version)}
      />

      {(workspace.status || workspace.displayError) && (
        <div className="flex flex-col gap-1 border-b border-line px-3 py-2 lg:px-4">
          {workspace.status && <p className="text-xs text-ok">{workspace.status}</p>}
          {workspace.displayError && <p className="text-xs text-danger">{workspace.displayError}</p>}
        </div>
      )}

      {workspace.saveIssues.length > 0 && (
        <div className="border-b border-danger/30 bg-danger/5 px-3 py-2 lg:px-4" role="alert">
          <div className="flex items-start justify-between gap-3">
            <ul className="flex flex-col gap-1 text-xs text-danger">
              {workspace.saveIssues.map((issue) => {
                const label = issue.nodeId
                  ? graph.nodes.find((node) => node.id === issue.nodeId)?.label
                  : issue.edgeId
                    ? `Conexión ${issue.edgeId}`
                    : undefined;
                return (
                  <li key={issue.id}>
                    {label ? `${label}: ` : ""}
                    {issue.message}
                  </li>
                );
              })}
            </ul>
            <button type="button" className={buttonGhost} onClick={workspace.clearSaveIssues}>
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<SectionFallback />}>
          <Outlet context={{ chatPillVisible }} />
        </Suspense>
      </div>

      <div
        className={`fixed inset-0 z-50 ${workspace.chatOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!workspace.chatOpen}
        inert={!workspace.chatOpen}
      >
        <div
          className={`chat-backdrop absolute inset-0 bg-ink/55 ${workspace.chatOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => workspace.setChatOpen(false)}
        />
        <div
          className={`chat-drawer absolute inset-y-0 right-0 flex w-full max-w-[500px] flex-col overflow-hidden border-l border-line bg-ink p-3 shadow-2xl ${
            workspace.chatOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <ChatPanel
            fill
            onMinimize={() => workspace.setChatOpen(false)}
            onBusyChange={workspace.setChatBusy}
            onActivityChange={workspace.setChatActivity}
            onSend={(message, onProgress) => workspace.sendChat(message, onProgress)}
            onAttachTurn={(turnId, onEvent) => api.attachChatTurn(workspace.slug, turnId, onEvent)}
            onCancelTurn={(turnId) => api.cancelChatTurn(workspace.slug, turnId)}
            onRetryTurn={(turnId) => api.retryChatTurn(workspace.slug, turnId)}
            hint="El canvas se sincroniza en vivo cuando el agente edita archivos. Puede tardar varios minutos."
            initialMessages={workspace.chatHistory}
            storageKey={workspace.slug}
            historyStatus={
              chatHistoryQuery.isPending ? "loading" : chatHistoryQuery.isError ? "error" : "ready"
            }
            historyError={
              chatHistoryQuery.isError
                ? friendlyError(chatHistoryQuery.error, "No se pudo cargar el historial del chat.")
                : undefined
            }
            onRetryHistory={() => void chatHistoryQuery.refetch()}
          />
        </div>
      </div>

      {chatPillVisible && (
        <button
          type="button"
          className="agent-status-pill fixed bottom-32 right-4 z-40 flex max-w-[280px] items-center gap-2.5 rounded-full border border-accent/40 bg-well/95 px-3.5 py-2 text-left text-xs text-slate-100 shadow-2xl"
          data-chat-pill
          onClick={() => {
            workspace.setChatOpen(true);
            workspace.setChatUnread(false);
          }}
          aria-label={workspace.chatBusy ? "Abrir chat, el agente está trabajando" : "Abrir chat, hay una respuesta nueva"}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              workspace.chatBusy ? "animate-pulse bg-accent motion-reduce:animate-none" : "bg-ok"
            }`}
          />
          <span className="min-w-0">
            <strong className="block text-[11px]">{workspace.chatBusy ? "Agente trabajando" : "Respuesta lista"}</strong>
            <span className="block truncate text-[11px] text-muted">
              {workspace.chatBusy ? (workspace.chatActivity ?? "Preparando respuesta…") : "Abre el chat para verla"}
            </span>
          </span>
        </button>
      )}

      {workspace.launchOpen && (
        <RunLaunchModal
          graph={graph}
          onClose={() => workspace.setLaunchOpen(false)}
          onLaunch={(payload) => workspace.runWorkflow(payload)}
        />
      )}

      {detailRun && (
        <RunDetailModal
          run={detailRun}
          nodeLabels={Object.fromEntries(graph.nodes.map((node) => [node.id, node.label ?? node.id]))}
          onClose={() => workspace.setDetailRun(undefined)}
          onReplay={(fromNodeId) => workspace.replayRun(detailRun.id, fromNodeId)}
        />
      )}

      {workspace.pendingPath !== undefined && (
        <ConfirmDialog
          title="Cambios sin guardar"
          confirmLabel="Descartar y continuar"
          onCancel={workspace.cancelPendingNavigation}
          onConfirm={workspace.discardAndContinue}
        >
          <p className="text-sm text-muted">
            El flujo tiene cambios sin guardar. Si sales ahora, esas ediciones se pierden.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
