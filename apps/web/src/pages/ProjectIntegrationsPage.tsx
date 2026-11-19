import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { INTEGRATION_KIND_LABELS } from "@platform/shared";
import type { IntegrationKind, IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { IntegrationEditor, type SavedIntegration } from "../components/IntegrationEditor.tsx";
import { NodeIcon } from "../components/nodes/node-icons.tsx";
import { OverflowMenu, type OverflowMenuItem } from "../components/OverflowMenu.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { DatabasePolicyEditor } from "../components/ProjectResourcesPanel.tsx";
import { QrDisplay } from "../components/QrDisplay.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { badge, buttonGhost, buttonPrimary, card, friendlyError, sectionTitle } from "../ui.ts";
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

const DATABASE_KINDS = new Set<IntegrationKind>(["postgres", "mysql", "mssql", "sqlite"]);

type ConfirmAction = { readonly kind: "delete" | "disconnect"; readonly integration: IntegrationRecord };

function IntegrationCard({
  slug,
  integration,
  editing,
  onTest,
  onConnect,
  onDisconnect,
  onRemove,
  onClearWebhook,
  onShowQr,
  onEdit,
  onEditCancel,
  onSaved,
  onPolicySaved,
}: {
  readonly slug: string;
  readonly integration: IntegrationRecord;
  readonly editing: boolean;
  onTest(): void;
  onConnect(): void;
  onDisconnect(): void;
  onRemove(): void;
  onClearWebhook(): void;
  onShowQr(): void;
  onEdit(): void;
  onEditCancel(): void;
  onSaved(result: SavedIntegration): void;
  onPolicySaved(): void;
}) {
  const menuActions: OverflowMenuItem[] = [
    integration.status === "connected"
      ? { id: "disconnect", label: "Desconectar", onSelect: onDisconnect }
      : { id: "connect", label: "Conectar", onSelect: onConnect },
  ];
  if (integration.kind === "telegram") {
    menuActions.push({ id: "clear-webhook", label: "Limpiar webhook", onSelect: onClearWebhook });
  }
  if (integration.kind === "whatsapp") {
    menuActions.push({ id: "qr", label: "Ver QR", onSelect: onShowQr });
  }
  menuActions.push({ id: "delete", label: "Borrar", danger: true, onSelect: onRemove });

  return (
    <article className={card} data-testid={"integration-card-" + integration.id}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-sm text-slate-100" title={integration.name}>
            {integration.name}
          </strong>
          <p className="truncate text-xs text-muted" title={integration.kind + " · " + integration.slug}>
            {INTEGRATION_KIND_LABELS[integration.kind]} · <code>{integration.slug}</code>
          </p>
          {typeof integration.config.botUsername === "string" && (
            <p className="text-xs text-muted">@{integration.config.botUsername}</p>
          )}
        </div>
        <StatusBadge status={integration.status} />
      </header>
      {integration.lastError && (
        <p className="text-xs text-danger" title={integration.lastError}>
          {integration.lastError}
        </p>
      )}
      {DATABASE_KINDS.has(integration.kind) && (
        <DatabasePolicyEditor projectSlug={slug} integration={integration} onSaved={onPolicySaved} />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={buttonGhost} onClick={onTest}>
          Probar
        </button>
        <button type="button" className={buttonGhost} onClick={onEdit} disabled={editing}>
          Editar
        </button>
        <OverflowMenu label={"Más acciones de " + integration.name} items={menuActions} />
      </div>
      {editing && (
        <IntegrationEditor
          key={integration.id}
          scope="project"
          projectSlug={slug}
          integration={integration}
          onSaved={onSaved}
          onCancel={onEditCancel}
        />
      )}
    </article>
  );
}

export function ProjectIntegrationsPage() {
  const workspace = useProjectWorkspace();
  const slug = workspace.slug;
  const queryClient = useQueryClient();

  // The workspace layout already owns this query; the page subscribes to the same
  // cache entry (same key, same fetcher) to show its own loading and error states.
  const integrationsQuery = useQuery({
    queryKey: qk.integrations(slug),
    queryFn: () => api.listIntegrations(slug).then((result) => result.data),
    enabled: Boolean(slug),
  });

  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [rawError, setRawError] = useState<string>();
  const [created, setCreated] = useState<SavedIntegration>();
  const [editingId, setEditingId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [qrFor, setQrFor] = useState<IntegrationRecord>();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>();
  const [confirmError, setConfirmError] = useState<string>();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: qk.integrations(slug) });
    await queryClient.invalidateQueries({ queryKey: qk.projectSettings(slug) });
  }

  const test = useMutation({
    mutationFn: (integration: IntegrationRecord) =>
      api.testIntegration(
        slug,
        integration.id,
        integration.kind === "telegram" && typeof integration.config.alertRecipient === "string"
          ? integration.config.alertRecipient
          : undefined,
      ),
    onSuccess: (result, integration) =>
      setStatus(
        integration.name + ": " + (result.ok ? "ok" : "error") + (result.detail ? " · " + result.detail : "") +
        (result.models && result.models.length > 0 ? " · modelos: " + result.models.slice(0, 6).join(", ") : "") +
        (result.voices && result.voices.length > 0 ? " · voces: " + result.voices.slice(0, 6).join(", ") : ""),
      ),
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setError(friendlyError(cause, "No se pudo probar la integración."));
    },
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.connectIntegration(slug, id),
    onSuccess: async (result) => {
      setStatus(
        result.status === "error"
          ? "No se pudo conectar: " + (result.lastError ?? "error desconocido")
          : "Integración " + result.name + ": " + result.status,
      );
      await refresh();
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setError(friendlyError(cause, "No se pudo conectar la integración."));
    },
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectIntegration(slug, id),
    onSuccess: async () => {
      setStatus("Integración desconectada");
      setConfirmAction(undefined);
      setConfirmError(undefined);
      await refresh();
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setConfirmError(friendlyError(cause, "No se pudo desconectar la integración."));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteIntegration(slug, id),
    onSuccess: async () => {
      setStatus("Integración eliminada");
      setConfirmAction(undefined);
      setConfirmError(undefined);
      setEditingId(undefined);
      await refresh();
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setConfirmError(friendlyError(cause, "No se pudo eliminar la integración."));
    },
  });

  const clearWebhook = useMutation({
    mutationFn: (id: string) => api.clearIntegrationWebhook(slug, id),
    onSuccess: async () => {
      setStatus("Webhook de Telegram limpiado; vuelve a conectar el bot");
      await refresh();
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setError(friendlyError(cause, "No se pudo limpiar el webhook."));
    },
  });

  function saved(result: SavedIntegration) {
    setCreated(result);
    setStatus("Integración " + result.integration.name + " guardada");
    setCreateOpen(false);
    setEditingId(undefined);
    setEditorKey((current) => current + 1);
    void refresh();
  }

  function askConfirm(action: ConfirmAction) {
    setConfirmError(undefined);
    setConfirmAction(action);
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
      {status && (
        <p className="text-sm text-ok" role="status">
          {status}
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

      {created && (created.apiKey || created.webhookSecret) && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-accent/35 bg-accent/10 p-3 text-sm">
          <strong className="text-slate-100">Guarda estas credenciales ahora (no se vuelven a mostrar):</strong>
          <span>
            Integración: <code>{created.integration.id}</code>
          </span>
          {created.apiKey && (
            <span className="break-all">
              API key: <code>{created.apiKey}</code>
            </span>
          )}
          {created.webhookSecret && (
            <span className="break-all">
              Webhook secret: <code>{created.webhookSecret}</code>
            </span>
          )}
        </div>
      )}

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
                  slug={slug}
                  integration={integration}
                  editing={editingId === integration.id}
                  onTest={() => test.mutate(integration)}
                  onConnect={() => connect.mutate(integration.id)}
                  onDisconnect={() => askConfirm({ kind: "disconnect", integration })}
                  onRemove={() => askConfirm({ kind: "delete", integration })}
                  onClearWebhook={() => clearWebhook.mutate(integration.id)}
                  onShowQr={() => setQrFor(integration)}
                  onEdit={() => setEditingId(integration.id)}
                  onEditCancel={() => setEditingId(undefined)}
                  onSaved={saved}
                  onPolicySaved={() => void queryClient.invalidateQueries({ queryKey: qk.integrations(slug) })}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {qrFor && (
        <QrDisplay
          title="QR de WhatsApp"
          integrationName={qrFor.name}
          integrationId={qrFor.id}
          loadQr={(id) => api.integrationQr(slug, id).then((result) => result.qr)}
          onClose={() => setQrFor(undefined)}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.kind === "delete" ? "Eliminar integración" : "Desconectar integración"}
          confirmLabel={confirmAction.kind === "delete" ? "Eliminar" : "Desconectar"}
          pending={confirmAction.kind === "delete" ? remove.isPending : disconnect.isPending}
          onCancel={() => {
            setConfirmAction(undefined);
            setConfirmError(undefined);
          }}
          onConfirm={() => {
            const action = confirmAction;
            if (action.kind === "delete") remove.mutate(action.integration.id);
            else disconnect.mutate(action.integration.id);
          }}
        >
          <p className="text-sm text-muted">
            {confirmAction.kind === "delete"
              ? "Se eliminará " + confirmAction.integration.name + " (" + confirmAction.integration.slug + "). Esta acción no se puede deshacer."
              : "Se desconectará " + confirmAction.integration.name + ". Podrás volver a conectarla cuando la necesites."}
          </p>
          {confirmError && (
            <p className="text-sm text-danger" role="alert" title={rawError}>
              {confirmError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </ProjectSectionBody>
  );
}
