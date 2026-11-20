import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { IntegrationCard, IntegrationCredentialsNotice } from "./IntegrationCard.tsx";
import { IntegrationEditor, type SavedIntegration } from "./IntegrationEditor.tsx";
import { friendlyError } from "../ui.ts";

export function ControlChannelsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: qk.controlIntegrations, queryFn: () => api.controlIntegrations().then((result) => result.data) });
  const [created, setCreated] = useState<SavedIntegration>();
  const [editingId, setEditingId] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
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
      setConfirmError(undefined);
      await refresh();
    },
    onError: (cause) => setConfirmError(friendlyError(cause, "No se pudo desconectar el canal.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal eliminado");
      setConfirmError(undefined);
      setEditingId(undefined);
      await refresh();
    },
    onError: (cause) => setConfirmError(friendlyError(cause, "No se pudo eliminar el canal.")),
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

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Estos canales son exclusivos del orquestador global: sirven para preguntar por el estado de todos los proyectos y
        recibir alertas de fallos. Los canales de cada proyecto se configuran dentro del proyecto.
      </p>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="text-sm text-ok" role="status">
          {status}
        </p>
      )}
      {integrations.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay canales del orquestador.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              scope="global"
              noun="canal"
              editing={editingId === integration.id}
              confirmError={confirmError}
              actions={{
                test: () => test.mutate(integration),
                connect: () => connect.mutate(integration.id),
                disconnect: async () => {
                  await disconnect.mutateAsync(integration.id);
                },
                remove: async () => {
                  await remove.mutateAsync(integration.id);
                },
                clearWebhook: () => clearWebhook.mutate(integration.id),
                loadQr: (id) => api.controlIntegrationQr(id).then((result) => result.qr),
                edit: () => setEditingId(integration.id),
                cancelEdit: () => setEditingId(undefined),
                saved,
                confirmClosed: () => setConfirmError(undefined),
              }}
            />
          ))}
        </div>
      )}

      <IntegrationEditor key={editorKey} scope="global" onSaved={saved} />

      <IntegrationCredentialsNotice created={created} />
    </div>
  );
}
