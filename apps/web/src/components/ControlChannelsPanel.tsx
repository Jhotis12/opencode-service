import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import type { IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { IntegrationEditor, type SavedIntegration } from "./IntegrationEditor.tsx";
import { buttonDanger, buttonGhost, card, friendlyError } from "../ui.ts";

export function ControlChannelsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: qk.controlIntegrations, queryFn: () => api.controlIntegrations().then((result) => result.data) });
  const [created, setCreated] = useState<SavedIntegration>();
  const [editingId, setEditingId] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [qr, setQr] = useState<{ id: string; qr: string }>();
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
      await refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal eliminado");
      await refresh();
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

  async function showQr(id: string) {
    try {
      const result = await api.controlIntegrationQr(id);
      setQr({ id, qr: await QRCode.toDataURL(result.qr, { margin: 1, width: 220 }) });
    } catch {
      setStatus("Todavía no hay un QR disponible para ese canal");
    }
  }

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
              <span className="flex flex-wrap gap-1.5">
                <button className={buttonGhost} onClick={() => test.mutate(integration)}>
                  Probar
                </button>
                <button className={buttonGhost} onClick={() => connect.mutate(integration.id)}>
                  Conectar
                </button>
                <button className={buttonGhost} onClick={() => disconnect.mutate(integration.id)}>
                  Desconectar
                </button>
                <button className={buttonGhost} onClick={() => setEditingId(integration.id)}>
                  Editar
                </button>
                {integration.kind === "telegram" && (
                  <button className={buttonGhost} onClick={() => clearWebhook.mutate(integration.id)}>
                    Limpiar webhook
                  </button>
                )}
                {integration.kind === "whatsapp" && (
                  <button className={buttonGhost} onClick={() => void showQr(integration.id)}>
                    QR
                  </button>
                )}
                <button className={buttonDanger} onClick={() => remove.mutate(integration.id)}>
                  Borrar
                </button>
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

      {qr && (
        <div className={card}>
          <strong className="text-sm">QR de WhatsApp · {qr.id}</strong>
          <img className="h-[200px] w-[200px] rounded-lg bg-white" src={qr.qr} alt="Código QR de WhatsApp" />
        </div>
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
