import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { INTEGRATION_KIND_LABELS } from "@platform/shared";
import type { IntegrationKind } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import {
  IntegrationCard,
  IntegrationCredentialsNotice,
  useProjectIntegrationActions,
} from "../components/IntegrationCard.tsx";
import { IntegrationEditor, type SavedIntegration } from "../components/IntegrationEditor.tsx";
import { NodeIcon } from "../components/nodes/node-icons.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { notifySuccess } from "../components/Toast.tsx";
import { badge, buttonGhost, buttonPrimary, friendlyError, sectionTitle } from "../ui.ts";
import { ProjectSectionBody, useProjectWorkspace } from "./project-workspace.tsx";

const KIND_ORDER: readonly IntegrationKind[] = [
  "telegram",
  "whatsapp",
  "external_chat",
  "email",
  "postgres",
  "mysql",
  "mssql",
  "sqlite",
  "http",
  "transcription",
  "speech",
];

export function ProjectIntegrationsPage() {
  const workspace = useProjectWorkspace();
  const slug = workspace.slug;

  // The workspace layout already owns this query; the page subscribes to the same
  // cache entry (same key, same fetcher) to show its own loading and error states.
  const integrationsQuery = useQuery({
    queryKey: qk.integrations(slug),
    queryFn: () => api.listIntegrations(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });

  const [error, setError] = useState<string>();
  const [rawError, setRawError] = useState<string>();
  const [created, setCreated] = useState<SavedIntegration>();
  const [editingId, setEditingId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const actions = useProjectIntegrationActions(slug, {
    onStatus: notifySuccess,
    onError: (message, rawMessage) => {
      setError(message);
      setRawError(rawMessage);
    },
  });

  function saved(result: SavedIntegration) {
    setCreated(result);
    notifySuccess("Integración " + result.integration.name + " guardada");
    setCreateOpen(false);
    setEditingId(undefined);
    setEditorKey((current) => current + 1);
    void actions.refresh();
  }

  const integrations = integrationsQuery.data ?? [];
  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        items: integrations.filter((integration) => integration.kind === kind),
      })).filter((group) => group.items.length > 0),
    [integrations],
  );

  return (
    <ProjectSectionBody>
      <PageHeader
        title="Integraciones"
        description="Canales, bases de datos y servicios del proyecto, agrupados por tipo y estado."
        actions={
          <button type="button" className={buttonPrimary} onClick={() => setCreateOpen(true)}>
            Nueva integración
          </button>
        }
      />

      {error && (
        <p className="text-sm text-danger" role="alert" title={rawError}>
          {error}
        </p>
      )}
      {createOpen && (
        <IntegrationEditor
          key={editorKey}
          scope="project"
          projectSlug={slug}
          defaultKind="telegram"
          onSaved={saved}
          onCancel={() => setCreateOpen(false)}
        />
      )}

      <IntegrationCredentialsNotice created={created} />

      {integrationsQuery.isLoading ? (
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando integraciones" data-testid="integrations-loading">
          {[0, 1].map((sectionIndex) => (
            <div key={sectionIndex} className="flex flex-col gap-3">
              <Skeleton shape="line" size="md" className="max-w-32" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((cardIndex) => (
                  <Skeleton key={cardIndex} shape="block" size="lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : integrationsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
          <p className="text-xs text-danger">
            {friendlyError(integrationsQuery.error, "No se pudo cargar las integraciones.")}
          </p>
          <button type="button" className={buttonGhost} onClick={() => void integrationsQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<NodeIcon type="http" />}
          title="Sin integraciones todavía"
          description="Conecta un canal, una base de datos o un servicio para que el flujo reciba o envíe datos."
          action={
            <button type="button" className={buttonPrimary} onClick={() => setCreateOpen(true)}>
              Nueva integración
            </button>
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.kind} className="flex flex-col gap-3" data-testid={"integration-group-" + group.kind}>
            <header className="flex flex-wrap items-center gap-2">
              <h2 className={sectionTitle}>{INTEGRATION_KIND_LABELS[group.kind]}</h2>
              <span className={badge}>
                {group.items.length}
                <span className="sr-only">{group.items.length === 1 ? " integración" : " integraciones"}</span>
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  scope="project"
                  projectSlug={slug}
                  noun="integración"
                  editing={editingId === integration.id}
                  confirmError={actions.confirmError}
                  actions={{
                    test: () => actions.test(integration),
                    connect: () => actions.connect(integration.id),
                    disconnect: () => actions.disconnect(integration.id),
                    remove: () => actions.remove(integration.id),
                    clearWebhook: () => actions.clearWebhook(integration.id),
                    loadQr: (id) => api.integrationQr(slug, id).then((result) => result.qr),
                    edit: () => setEditingId(integration.id),
                    cancelEdit: () => setEditingId(undefined),
                    saved,
                    policySaved: actions.policySaved,
                    confirmClosed: actions.clearConfirmError,
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </ProjectSectionBody>
  );
}
