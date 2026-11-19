import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { OverflowMenu, type OverflowMenuItem } from "./OverflowMenu.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { IntegrationEditor, type SavedIntegration } from "./IntegrationEditor.tsx";
import { QrDisplay } from "./QrDisplay.tsx";
import { buttonGhost, friendlyError } from "../ui.ts";

export function ControlChannelsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: qk.controlIntegrations, queryFn: () => api.controlIntegrations().then((result) => result.data) });
  const [created, setCreated] = useState<SavedIntegration>();
  const [editingId, setEditingId] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [qrFor, setQrFor] = useState<IntegrationRecord>();
  const [confirmAction, setConfirmAction] = useState<{ kind: "delete" | "disconnect"; integration: IntegrationRecord }>();
  const [confirmError, setConfirmError] = useState<string>();
  const integrations = query.data ?? [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: qk.controlIntegrations });
    await queryClient.invalidateQueries({ queryKey: qk.controlOverview });
  }

  const test = useMutation({
    mutationFn: (integration: IntegrationRecord) =>
      api.testControlIntegration(
        integration.id,
        integration.kind === "telegram" && typeof integration.config.alertRecipient === "string"
          ? integration.config.alertRecipient
          : undefined,
      ),
    onSuccess: (result, integration) =>
      setStatus(
        `${integration.name}: ${result.ok ? "ok" : "error"}${result.detail ? ` · ${result.detail}` : ""}`,
      ),
    onError: (cause) => setError(friendlyError(cause, "No se pudo probar el canal.")),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.connectControlIntegration(id),
    onSuccess: async (result) => {
      setStatus(
        result.status === "error"
          ? `No se pudo conectar: ${result.lastError ?? "error desconocido"}`
          : `Canal ${result.name}: ${result.status}`,
      );
      await refresh();
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo conectar el canal.")),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal desconectado");
      setConfirmAction(undefined);
      setConfirmError(undefined);
      await refresh();
    },
    onError: (cause) => {
      setConfirmError(friendlyError(cause, "No se pudo desconectar el canal."));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal eliminado");
      setConfirmAction(undefined);
      setConfirmError(undefined);
      setEditingId(undefined);
      await refresh();
    },
    onError: (cause) => {
      setConfirmError(friendlyError(cause, "No se pudo eliminar el canal."));
    },
  });

  const clearWebhook = useMutation({
    mutationFn: (id: string) => api.clearControlIntegrationWebhook(id),
    onSuccess: async () => {
      setStatus("Webhook de Telegram limpiado; vuelve a conectar el bot");
      await refresh();
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo limpiar el webhook.")),
  });

  function saved(result: SavedIntegration) {
    setCreated(result);
    setStatus(`Canal ${result.integration.name} guardado`);
    setEditingId(undefined);
    setEditorKey((current) => current + 1);
    void refresh();
  }

  function askConfirm(action: { kind: "delete" | "disconnect"; integration: IntegrationRecord }) {
    setConfirmError(undefined);
    setConfirmAction(action);
  }

  function channelMenu(integration: IntegrationRecord): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [
      integration.status === "connected"
        ? { id: "disconnect", label: "Desconectar", onSelect: () => askConfirm({ kind: "disconnect", integration }) }
        : { id: "connect", label: "Conectar", onSelect: () => connect.mutate(integration.id) },
    ];
    if (integration.kind === "telegram") {
      items.push({ id: "clear-webhook", label: "Limpiar webhook", onSelect: () => clearWebhook.mutate(integration.id) });
    }
    if (integration.kind === "whatsapp") {
      items.push({ id: "qr", label: "Ver QR", onSelect: () => setQrFor(integration) });
    }
    items.push({ id: "delete", label: "Borrar", danger: true, onSelect: () => askConfirm({ kind: "delete", integration }) });
    return items;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Estos canales son exclusivos del orquestador global: sirven para preguntar por el estado de todos los proyectos y
        recibir alertas de fallos. Los canales de cada proyecto se configuran dentro del proyecto.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {status && <p className="text-sm text-ok">{status}</p>}
      <div className="flex flex-col gap-2">
        {integrations.map((integration) => (
          <article className="flex flex-col gap-2 rounded-lg border border-line bg-well p-3" key={integration.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="text-sm">{integration.name}</strong>{" "}
                <StatusBadge status={integration.status} />
                <small className="block text-xs text-muted">
                  {integration.kind} · <code>{integration.slug}</code>
                </small>
                {integration.lastError && <small className="block text-xs text-danger">{integration.lastError}</small>}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={buttonGhost} onClick={() => test.mutate(integration)}>
                  Probar
                </button>
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={() => setEditingId(integration.id)}
                  disabled={editingId === integration.id}
                >
                  Editar
                </button>
                <OverflowMenu label={`Más acciones de ${integration.name}`} items={channelMenu(integration)} />
              </span>
            </div>
            {editingId === integration.id && (
              <IntegrationEditor
                key={integration.id}
                scope="global"
                integration={integration}
                onSaved={saved}
                onCancel={() => setEditingId(undefined)}
              />
            )}
          </article>
        ))}
        {integrations.length === 0 && <p className="text-sm text-muted">Aún no hay canales del orquestador.</p>}
      </div>

      {qrFor && (
        <QrDisplay
          title="QR de WhatsApp"
          integrationName={qrFor.name}
          integrationId={qrFor.id}
          loadQr={(id) => api.controlIntegrationQr(id).then((result) => result.qr)}
          onClose={() => setQrFor(undefined)}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.kind === "delete" ? "Eliminar canal" : "Desconectar canal"}
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
              ? `Se eliminará ${confirmAction.integration.name} (${confirmAction.integration.slug}). Esta acción no se puede deshacer.`
              : `Se desconectará ${confirmAction.integration.name}. Podrás volver a conectarlo cuando lo necesites.`}
          </p>
          {confirmError && (
            <p className="text-sm text-danger" role="alert">
              {confirmError}
            </p>
          )}
        </ConfirmDialog>
      )}

      <IntegrationEditor key={editorKey} scope="global" onSaved={saved} />

      {created && (created.apiKey || created.webhookSecret) && (
        <div className="flex flex-col gap-1 rounded-lg border border-accent/35 bg-accent/10 p-3 text-sm">
          <strong className="text-slate-100">Guarda estas credenciales ahora:</strong>
          <span className="break-all">Integración: <code>{created.integration.id}</code></span>
          {created.apiKey && <span className="break-all">API key: <code>{created.apiKey}</code></span>}
          {created.webhookSecret && <span className="break-all">Webhook secret: <code>{created.webhookSecret}</code></span>}
        </div>
      )}
    </div>
  );
}
