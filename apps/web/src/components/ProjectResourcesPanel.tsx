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
import { badge, button, buttonGhost, card, friendlyError } from "../ui.ts";

const DATABASE_KINDS = new Set<IntegrationRecord["kind"]>(["postgres", "mysql", "mssql", "sqlite"]);
const CHANNEL_KINDS = new Set<IntegrationRecord["kind"]>(["telegram", "whatsapp", "external_chat"]);

export type ResourceSection = "all" | "connections" | "channels" | "secrets";

export function DatabasePolicyEditor({
  projectSlug,
  integration,
  onSaved,
}: {
  projectSlug: string;
  integration: IntegrationRecord;
  onSaved(): void;
}) {
  const [access, setAccess] = useState<"read" | "write">(
    integration.config.access === "read" ? "read" : "write",
  );
  const [maxRows, setMaxRows] = useState(Number(integration.config.maxRows ?? 1_000));
  const [allowDdl, setAllowDdl] = useState(integration.config.allowDdl === true);
  const save = useMutation({
    mutationFn: () =>
      api.updateIntegration(projectSlug, integration.id, {
        config: { ...integration.config, access, maxRows, allowDdl },
      }),
    onSuccess: onSaved,
  });
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-well p-2">
      <strong className="text-xs text-slate-200">Política de base de datos</strong>
      <label className="text-[11px] text-muted">
        Acceso
        <select value={access} onChange={(event) => setAccess(event.target.value as "read" | "write")}>
          <option value="read">Solo lectura</option>
          <option value="write">Lectura y escritura</option>
        </select>
      </label>
      <label className="text-[11px] text-muted">
        Máximo de filas
        <input
          type="number"
          min={1}
          max={10000}
          value={maxRows}
          onChange={(event) => setMaxRows(Number(event.target.value))}
        />
      </label>
      <label className="flex-row items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" className="w-auto" checked={allowDdl} onChange={(event) => setAllowDdl(event.target.checked)} />
        Permitir DDL
      </label>
      <button className={buttonGhost} disabled={save.isPending} onClick={() => save.mutate()}>
        Guardar política
      </button>
      {save.error && <small className="text-danger">{save.error instanceof Error ? save.error.message : "Error"}</small>}
    </div>
  );
}

export function ProjectResourcesPanel({
  projectSlug,
  section = "all",
}: {
  projectSlug: string;
  section?: ResourceSection;
}) {
  const queryClient = useQueryClient();
  const integrationsQuery = useQuery({
    queryKey: qk.integrations(projectSlug),
    queryFn: () => api.listIntegrations(projectSlug).then((result) => result.data),
  });
  const secretsQuery = useQuery({
    queryKey: qk.projectSecrets(projectSlug),
    queryFn: () => api.listProjectSecrets(projectSlug).then((result) => result.data),
  });
  const [created, setCreated] = useState<SavedIntegration>();
  const [editingId, setEditingId] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const [secretAlias, setSecretAlias] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [rawError, setRawError] = useState<string>();
  const [qrFor, setQrFor] = useState<IntegrationRecord>();
  const [confirmAction, setConfirmAction] = useState<{ kind: "delete" | "disconnect"; integration: IntegrationRecord }>();
  const [confirmError, setConfirmError] = useState<string>();

  const allIntegrations = integrationsQuery.data ?? [];
  const integrations = allIntegrations.filter((integration) => {
    if (section === "secrets") return false;
    if (section === "channels") return CHANNEL_KINDS.has(integration.kind);
    if (section === "connections") return !CHANNEL_KINDS.has(integration.kind);
    return true;
  });
  const secretsList = secretsQuery.data ?? [];
  const defaultKind = section === "channels" ? "telegram" : section === "connections" ? "postgres" : "telegram";

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
    onSuccess: (result, integration) =>
      setStatus(
        `${integration.name}: ${result.ok ? "ok" : "error"}${result.detail ? ` · ${result.detail}` : ""}${
          result.models?.length ? ` · modelos: ${result.models.slice(0, 6).join(", ")}` : ""
        }${result.voices?.length ? ` · voces: ${result.voices.slice(0, 6).join(", ")}` : ""}`,
      ),
    onError: (cause) => setError(friendlyError(cause, "No se pudo probar la integración.")),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.connectIntegration(projectSlug, id),
    onSuccess: async (result) => {
      setStatus(
        result.status === "error"
          ? `No se pudo conectar: ${result.lastError ?? "error desconocido"}`
          : `Integración ${result.name}: ${result.status}`,
      );
      await refresh();
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo conectar la integración.")),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectIntegration(projectSlug, id),
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
    mutationFn: (id: string) => api.deleteIntegration(projectSlug, id),
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
    mutationFn: (id: string) => api.clearIntegrationWebhook(projectSlug, id),
    onSuccess: async () => {
      setStatus("Webhook de Telegram limpiado; vuelve a conectar el bot");
      await refresh();
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo limpiar el webhook.")),
  });

  const addSecret = useMutation({
    mutationFn: () => api.saveProjectSecret(projectSlug, secretAlias, secretValue),
    onSuccess: async () => {
      setSecretAlias("");
      setSecretValue("");
      setStatus("Secreto guardado en la bóveda del proyecto");
      await queryClient.invalidateQueries({ queryKey: qk.projectSecrets(projectSlug) });
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setError(friendlyError(cause, "No se pudo guardar el secreto."));
    },
  });

  function saved(result: SavedIntegration) {
    setCreated(result);
    setStatus(`Integración ${result.integration.name} guardada`);
    setEditingId(undefined);
    setEditorKey((current) => current + 1);
    void refresh();
  }

  function askConfirm(action: { kind: "delete" | "disconnect"; integration: IntegrationRecord }) {
    setConfirmError(undefined);
    setConfirmAction(action);
  }

  function integrationMenu(integration: IntegrationRecord): OverflowMenuItem[] {
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
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-danger" role="alert" title={rawError}>
          {error}
        </p>
      )}
      {status && <p className="text-sm text-ok">{status}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <article className={card} key={integration.id}>
            <header className="flex items-start justify-between gap-2">
              <div>
                <strong className="text-sm">{integration.name}</strong>
                <p className="text-xs text-muted">
                  {integration.kind} · <code>{integration.slug}</code>
                </p>
                {typeof integration.config.botUsername === "string" && (
                  <p className="text-xs text-muted">@{integration.config.botUsername}</p>
                )}
              </div>
              <StatusBadge status={integration.status} />
            </header>
            <small className="break-all text-xs text-muted">ID: {integration.id}</small>
            {integration.lastError && <p className="text-xs text-danger">{integration.lastError}</p>}
            {DATABASE_KINDS.has(integration.kind) && (
              <DatabasePolicyEditor
                projectSlug={projectSlug}
                integration={integration}
                onSaved={() => void queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) })}
              />
            )}
            <div className="flex flex-wrap items-center gap-1.5">
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
              <OverflowMenu label={`Más acciones de ${integration.name}`} items={integrationMenu(integration)} />
            </div>
            {editingId === integration.id && (
              <IntegrationEditor
                key={integration.id}
                scope="project"
                projectSlug={projectSlug}
                integration={integration}
                onSaved={saved}
                onCancel={() => setEditingId(undefined)}
              />
            )}
          </article>
        ))}
        {integrations.length === 0 && section !== "secrets" && (
          <p className="text-sm text-muted">
            {section === "channels"
              ? "Este proyecto aún no tiene canales. Crea uno para recibir o enviar mensajes."
              : section === "connections"
                ? "Este proyecto aún no tiene conexiones. Crea una base, API o servicio de transcripción."
                : "Este proyecto aún no tiene integraciones. Crea una para que el flujo reciba o envíe datos."}
          </p>
        )}
      </div>

      {qrFor && (
        <QrDisplay
          title="QR de WhatsApp"
          integrationName={qrFor.name}
          integrationId={qrFor.id}
          loadQr={(id) => api.integrationQr(projectSlug, id).then((result) => result.qr)}
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
              ? `Se eliminará ${confirmAction.integration.name} (${confirmAction.integration.slug}). Esta acción no se puede deshacer.`
              : `Se desconectará ${confirmAction.integration.name}. Podrás volver a conectarla cuando la necesites.`}
          </p>
          {confirmError && (
            <p className="text-sm text-danger" role="alert" title={rawError}>
              {confirmError}
            </p>
          )}
        </ConfirmDialog>
      )}

      {section !== "secrets" && (
        <IntegrationEditor
          key={editorKey}
          scope="project"
          projectSlug={projectSlug}
          defaultKind={defaultKind}
          onSaved={saved}
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

      {(section === "all" || section === "secrets") && (
        <section className={card}>
          <h2 className="text-base font-semibold text-slate-100">Secretos del proyecto</h2>
          <p className="text-xs text-muted">Se resuelven solo en el servidor y nunca se envían al agente ni a los workers.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={secretAlias} onChange={(event) => setSecretAlias(event.target.value)} placeholder="alias" className="min-w-[160px] flex-1" />
            <input
              type="password"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="valor"
              className="min-w-[160px] flex-1"
            />
            <button className={button} disabled={addSecret.isPending || !secretAlias || !secretValue} onClick={() => addSecret.mutate()}>
              Guardar secreto
            </button>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {secretsList.map((secret) => (
              <li key={secret.alias} className={badge}>
                {secret.alias} · {secret.kind}
              </li>
            ))}
            {secretsList.length === 0 && <li className="text-sm text-muted">Sin secretos de proyecto.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
