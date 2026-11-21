import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { INTEGRATION_KIND_LABELS } from "@platform/shared";
import type { IntegrationKind, IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { DatabasePolicyEditor } from "./DatabasePolicyEditor.tsx";
import { IntegrationEditor, type SavedIntegration } from "./IntegrationEditor.tsx";
import { OverflowMenu, type OverflowMenuItem } from "./OverflowMenu.tsx";
import { QrDisplay } from "./QrDisplay.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { notifyWarning } from "./Toast.tsx";
import { buttonGhost, card, friendlyError, statusLabel, statusTone } from "../ui.ts";

const DATABASE_KINDS = new Set<IntegrationKind>(["postgres", "mysql", "mssql", "sqlite"]);

export type IntegrationScope = "project" | "global";
export type IntegrationNoun = "integración" | "canal";

export type IntegrationCardActions = {
  test(): void;
  connect(): void;
  disconnect(): Promise<unknown>;
  remove(): Promise<unknown>;
  clearWebhook(): void;
  loadQr(id: string): Promise<string>;
  edit(): void;
  cancelEdit(): void;
  saved(result: SavedIntegration): void;
  policySaved?(): void;
  confirmClosed(): void;
};

export function IntegrationCard({
  integration,
  scope,
  projectSlug,
  noun,
  editing,
  confirmError,
  actions,
}: {
  readonly integration: IntegrationRecord;
  readonly scope: IntegrationScope;
  readonly projectSlug?: string;
  readonly noun: IntegrationNoun;
  readonly editing: boolean;
  readonly confirmError?: string;
  readonly actions: IntegrationCardActions;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"delete" | "disconnect">();
  const [confirmPending, setConfirmPending] = useState(false);

  const menuActions: OverflowMenuItem[] = [
    integration.status === "connected"
      ? { id: "disconnect", label: "Desconectar", onSelect: () => setConfirmKind("disconnect") }
      : { id: "connect", label: "Conectar", onSelect: actions.connect },
  ];
  if (integration.kind === "telegram") {
    menuActions.push({ id: "clear-webhook", label: "Limpiar webhook", onSelect: actions.clearWebhook });
  }
  if (integration.kind === "whatsapp") {
    menuActions.push({ id: "qr", label: "Ver QR", onSelect: () => setQrOpen(true) });
  }
  menuActions.push({ id: "delete", label: "Borrar", danger: true, onSelect: () => setConfirmKind("delete") });

  const pronoun = noun === "canal" ? "lo" : "la";

  function closeConfirm() {
    setConfirmKind(undefined);
    setConfirmPending(false);
    actions.confirmClosed();
  }

  function confirm() {
    const kind = confirmKind;
    if (!kind) return;
    setConfirmPending(true);
    const run = kind === "delete" ? actions.remove() : actions.disconnect();
    void run.then(closeConfirm, () => setConfirmPending(false));
  }

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
      {scope === "project" && projectSlug && DATABASE_KINDS.has(integration.kind) && (
        <DatabasePolicyEditor projectSlug={projectSlug} integration={integration} onSaved={actions.policySaved ?? (() => undefined)} />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={buttonGhost} onClick={actions.test}>
          Probar
        </button>
        <button type="button" className={buttonGhost} onClick={actions.edit} disabled={editing}>
          Editar
        </button>
        <OverflowMenu label={"Más acciones de " + integration.name} items={menuActions} />
      </div>
      {editing && (
        <IntegrationEditor
          key={integration.id}
          scope={scope}
          projectSlug={projectSlug}
          integration={integration}
          onSaved={actions.saved}
          onCancel={actions.cancelEdit}
        />
      )}
      {qrOpen && (
        <QrDisplay
          title="QR de WhatsApp"
          integrationName={integration.name}
          integrationId={integration.id}
          loadQr={actions.loadQr}
          onClose={() => setQrOpen(false)}
        />
      )}
      {confirmKind && (
        <ConfirmDialog
          title={(confirmKind === "delete" ? "Eliminar " : "Desconectar ") + noun}
          confirmLabel={confirmKind === "delete" ? "Eliminar" : "Desconectar"}
          pending={confirmPending}
          onCancel={closeConfirm}
          onConfirm={confirm}
        >
          <p className="text-sm text-muted">
            {confirmKind === "delete"
              ? "Se eliminará " + integration.name + " (" + integration.slug + "). Esta acción no se puede deshacer."
              : "Se desconectará " + integration.name + ". Podrás volver a conectarl" + pronoun + " cuando l" + pronoun + " necesites."}
          </p>
          {confirmError && (
            <p className="text-sm text-danger" role="alert">
              {confirmError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </article>
  );
}

export function IntegrationCredentialsNotice({ created }: { readonly created?: SavedIntegration }) {
  if (!created || (!created.apiKey && !created.webhookSecret)) return null;
  return (
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
  );
}

export function useProjectIntegrationActions(
  projectSlug: string,
  host: {
    readonly onStatus: (message: string) => void;
    readonly onError: (message: string, rawMessage?: string) => void;
  },
) {
  const queryClient = useQueryClient();
  const [confirmError, setConfirmError] = useState<string>();

  function reportFailure(cause: unknown, fallback: string) {
    host.onError(friendlyError(cause, fallback), cause instanceof Error ? cause.message : undefined);
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) });
    await queryClient.invalidateQueries({ queryKey: qk.projectSettings(projectSlug) });
  }

  const test = useMutation({
    mutationFn: (integration: IntegrationRecord) =>
      api.testIntegration(
        projectSlug,
        integration.id,
        integration.kind === "telegram" && typeof integration.config.alertRecipient === "string"
          ? integration.config.alertRecipient
          : undefined,
      ),
    onSuccess: (result, integration) => {
      // A failed verification is an outcome too, but it belongs to the error channel.
      const message = integration.name + ": " + statusLabel(result.ok ? "ok" : "error") + (result.detail ? " · " + result.detail : "") +
        (result.models && result.models.length > 0 ? " · modelos: " + result.models.slice(0, 6).join(", ") : "") +
        (result.voices && result.voices.length > 0 ? " · voces: " + result.voices.slice(0, 6).join(", ") : "");
      if (result.ok) host.onStatus(message);
      else host.onError(message);
    },
    onError: (cause) => reportFailure(cause, "No se pudo probar la integración."),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.connectIntegration(projectSlug, id),
    onSuccess: async (result) => {
      if (result.status === "error") {
        host.onError("No se pudo conectar: " + (result.lastError ?? "error desconocido"));
      } else {
        const message = "Integración " + result.name + ": " + statusLabel(result.status);
        // A warning-toned status (needs_config, qr_pending) is still waiting on the operator, not a success.
        if (statusTone(result.status) === "warning") notifyWarning(message);
        else host.onStatus(message);
      }
      await refresh();
    },
    onError: (cause) => reportFailure(cause, "No se pudo conectar la integración."),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectIntegration(projectSlug, id),
    onSuccess: async () => {
      host.onStatus("Integración desconectada");
      setConfirmError(undefined);
      await refresh();
    },
    onError: (cause) => setConfirmError(friendlyError(cause, "No se pudo desconectar la integración.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteIntegration(projectSlug, id),
    onSuccess: async () => {
      host.onStatus("Integración eliminada");
      setConfirmError(undefined);
      await refresh();
    },
    onError: (cause) => setConfirmError(friendlyError(cause, "No se pudo eliminar la integración.")),
  });

  const clearWebhook = useMutation({
    mutationFn: (id: string) => api.clearIntegrationWebhook(projectSlug, id),
    onSuccess: async () => {
      host.onStatus("Webhook de Telegram limpiado; vuelve a conectar el bot");
      await refresh();
    },
    onError: (cause) => reportFailure(cause, "No se pudo limpiar el webhook."),
  });

  return {
    confirmError,
    clearConfirmError: () => setConfirmError(undefined),
    refresh,
    test: (integration: IntegrationRecord) => test.mutate(integration),
    connect: (id: string) => connect.mutate(id),
    disconnect: async (id: string) => {
      await disconnect.mutateAsync(id);
    },
    remove: async (id: string) => {
      await remove.mutateAsync(id);
    },
    clearWebhook: (id: string) => clearWebhook.mutate(id),
    policySaved: () => void queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) }),
  };
}
