import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import type { IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { badge, button, buttonDanger, buttonGhost, buttonPrimary, card, friendlyError } from "../ui.ts";

const KIND_OPTIONS: Array<{ value: IntegrationRecord["kind"]; label: string; config: string; secrets: string }> = [
  {
    value: "telegram",
    label: "Telegram",
    config: '{"routing":{"mode":"hybrid","allowlist":[],"public":false}}',
    secrets: '{"token":"123456:ABC..."}',
  },
  {
    value: "whatsapp",
    label: "WhatsApp (QR)",
    config: '{"mode":"baileys","routing":{"mode":"hybrid","allowlist":[],"public":false}}',
    secrets: "{}",
  },
  {
    value: "external_chat",
    label: "Chat externo / API",
    config: '{"routing":{"mode":"agent","allowlist":[],"public":false}}',
    secrets: "{}",
  },
  {
    value: "email",
    label: "Email (contrato futuro)",
    config: '{"from":"ventas@example.com","smtp":{"host":"smtp.example.com","port":587,"secure":false},"routing":{"mode":"agent","allowlist":[]}}',
    secrets: '{"smtpPassword":"..."}',
  },
  {
    value: "postgres",
    label: "PostgreSQL",
    config: '{"host":"localhost","port":5432,"database":"crm","user":"app"}',
    secrets: '{"password":"..."}',
  },
  { value: "mysql", label: "MySQL", config: '{"host":"localhost","port":3306,"database":"crm","user":"app"}', secrets: '{"password":"..."}' },
  { value: "mssql", label: "SQL Server", config: '{"host":"localhost","port":1433,"database":"crm","user":"app"}', secrets: '{"password":"..."}' },
  { value: "sqlite", label: "SQLite", config: '{"filename":"/data/client.sqlite"}', secrets: "{}" },
  { value: "http", label: "HTTP API", config: '{"baseUrl":"https://api.example.com"}', secrets: "{}" },
];

function kindLabel(kind: IntegrationRecord["kind"]): string {
  return KIND_OPTIONS.find((item) => item.value === kind)?.label ?? kind;
}

export function ProjectResourcesPanel({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const integrationsQuery = useQuery({
    queryKey: qk.integrations(projectSlug),
    queryFn: () => api.listIntegrations(projectSlug).then((result) => result.data),
  });
  const secretsQuery = useQuery({
    queryKey: qk.projectSecrets(projectSlug),
    queryFn: () => api.listProjectSecrets(projectSlug).then((result) => result.data),
  });
  const [kind, setKind] = useState<IntegrationRecord["kind"]>("telegram");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [config, setConfig] = useState(KIND_OPTIONS[0]!.config);
  const [secrets, setSecrets] = useState("{}");
  const [channelMode, setChannelMode] = useState<"agent" | "workflow" | "hybrid">("hybrid");
  const [allowlist, setAllowlist] = useState("");
  const [channelPublic, setChannelPublic] = useState(false);
  const [token, setToken] = useState("");
  const [whatsappMode, setWhatsappMode] = useState<"baileys" | "cloud">("baileys");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [created, setCreated] = useState<{ integration: IntegrationRecord; apiKey?: string; webhookSecret?: string }>();
  const [secretAlias, setSecretAlias] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [rawError, setRawError] = useState<string>();
  const [qr, setQr] = useState<{ id: string; qr: string }>();

  const integrations = integrationsQuery.data ?? [];
  const secretsList = secretsQuery.data ?? [];
  const isChannel = ["telegram", "whatsapp", "external_chat"].includes(kind);

  function chooseKind(next: IntegrationRecord["kind"]) {
    setKind(next);
    const option = KIND_OPTIONS.find((item) => item.value === next);
    const nextConfig = option?.config ?? "{}";
    const channel = ["telegram", "whatsapp", "external_chat"].includes(next);
    setConfig(nextConfig);
    setSecrets(channel ? "{}" : option?.secrets ?? "{}");
    setChannelMode("hybrid");
    setAllowlist("");
    setChannelPublic(false);
    setToken("");
    setWhatsappMode("baileys");
    setPhoneNumberId("");
  }

  const create = useMutation({
    mutationFn: () => {
      const parsedConfig = JSON.parse(config) as Record<string, unknown>;
      const parsedSecrets = JSON.parse(secrets) as Record<string, string>;
      const channel = ["telegram", "whatsapp", "external_chat"].includes(kind);
      const finalConfig = channel
        ? {
            ...parsedConfig,
            ...(kind === "whatsapp"
              ? {
                  mode: whatsappMode,
                  ...(whatsappMode === "cloud" ? { phoneNumberId } : {}),
                }
              : {}),
            routing: {
              mode: channelMode,
              allowlist: allowlist
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              public: channelPublic,
            },
          }
        : parsedConfig;
      const finalSecrets = token ? { ...parsedSecrets, token } : parsedSecrets;
      return api.createIntegration(projectSlug, {
        kind,
        name,
        slug,
        config: finalConfig,
        secrets: finalSecrets,
      });
    },
    onSuccess: async (result) => {
      setCreated(result);
      setStatus(`Integración ${result.integration.name} creada`);
      setName("");
      setSlug("");
      await queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: qk.projectSettings(projectSlug) });
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setError(friendlyError(cause, "No se pudo crear la integración."));
    },
  });

  const test = useMutation({
    mutationFn: (id: string) => api.testIntegration(projectSlug, id),
    onSuccess: (result, id) => setStatus(`${id}: ${result.ok ? "ok" : "error"}${result.detail ? ` · ${result.detail}` : ""}`),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.connectIntegration(projectSlug, id),
    onSuccess: async () => {
      setStatus("Integración conectada");
      await queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) });
    },
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectIntegration(projectSlug, id),
    onSuccess: async () => {
      setStatus("Integración desconectada");
      await queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteIntegration(projectSlug, id),
    onSuccess: async () => {
      setStatus("Integración eliminada");
      await queryClient.invalidateQueries({ queryKey: qk.integrations(projectSlug) });
    },
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

  async function showQr(id: string) {
    try {
      const result = await api.integrationQr(projectSlug, id);
      setQr({ id, qr: await QRCode.toDataURL(result.qr, { margin: 1, width: 220 }) });
    } catch {
      setStatus("Todavía no hay un QR disponible para esa integración");
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    create.mutate();
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
                  {kindLabel(integration.kind)} · <code>{integration.slug}</code>
                </p>
              </div>
              <StatusBadge status={integration.status} />
            </header>
            <small className="break-all text-xs text-muted">ID: {integration.id}</small>
            <div className="flex flex-wrap gap-1.5">
              <button className={buttonGhost} onClick={() => test.mutate(integration.id)}>
                Probar
              </button>
              <button className={buttonGhost} onClick={() => connect.mutate(integration.id)}>
                Conectar
              </button>
              <button className={buttonGhost} onClick={() => disconnect.mutate(integration.id)}>
                Desconectar
              </button>
              {integration.kind === "whatsapp" && (
                <button className={buttonGhost} onClick={() => void showQr(integration.id)}>
                  Ver QR
                </button>
              )}
              <button className={buttonDanger} onClick={() => remove.mutate(integration.id)}>
                Borrar
              </button>
            </div>
          </article>
        ))}
        {integrations.length === 0 && (
          <p className="text-sm text-muted">Este proyecto aún no tiene integraciones. Crea una para que el flujo reciba o envíe datos.</p>
        )}
      </div>

      {qr && (
        <div className={card}>
          <strong className="text-sm">QR de WhatsApp · {qr.id}</strong>
          <img className="h-[220px] w-[220px] rounded-lg bg-white" src={qr.qr} alt="Código QR de WhatsApp" />
        </div>
      )}

      <form className={`${card} !grid gap-3 md:grid-cols-2`} onSubmit={submitCreate} aria-label="Crear integración">
        <h2 className="text-base font-semibold text-slate-100 md:col-span-2">Nueva integración</h2>
        <label>
          Tipo
          <select value={kind} onChange={(event) => chooseKind(event.target.value as IntegrationRecord["kind"])}>
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bot de ventas" />
        </label>
        <label>
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="ventas-telegram" />
        </label>

        {isChannel && (
          <>
            <label>
              Cómo responde el canal
              <select value={channelMode} onChange={(event) => setChannelMode(event.target.value as typeof channelMode)}>
                <option value="hybrid">Híbrido: admin → agente, público → flujo</option>
                <option value="agent">Siempre al agente principal</option>
                <option value="workflow">Siempre al flujo</option>
              </select>
            </label>
            <label>
              Allowlist de administradores (coma)
              <input value={allowlist} onChange={(event) => setAllowlist(event.target.value)} placeholder="123456789, +57..." />
            </label>
            <label className="flex-row items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                className="w-auto"
                checked={channelPublic}
                onChange={(event) => setChannelPublic(event.target.checked)}
              />
              Permitir remitentes públicos en este canal
            </label>

            {kind === "telegram" && (
              <label className="md:col-span-2">
                Token del bot (@BotFather)
                <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="123456:ABC…" />
              </label>
            )}

            {kind === "whatsapp" && (
              <>
                <label>
                  Modo de WhatsApp
                  <select value={whatsappMode} onChange={(event) => setWhatsappMode(event.target.value as typeof whatsappMode)}>
                    <option value="baileys">Baileys (QR personal)</option>
                    <option value="cloud">Cloud API (Meta)</option>
                  </select>
                </label>
                {whatsappMode === "cloud" && (
                  <>
                    <label>
                      Token de Meta
                      <input type="password" value={token} onChange={(event) => setToken(event.target.value)} />
                    </label>
                    <label>
                      Phone number ID
                      <input value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} />
                    </label>
                  </>
                )}
              </>
            )}

            {kind === "external_chat" && (
              <p className="text-xs text-muted md:col-span-2">
                Al crear el canal se genera una API key de un solo uso. La app externa debe enviar mensajes a{" "}
                <code>/api/v1/integrations/&lt;id&gt;/messages</code> con el header <code>x-integration-key</code>.
              </p>
            )}

            <details className="md:col-span-2">
              <summary className="cursor-pointer text-xs text-muted">Configuración avanzada</summary>
              <label className="mt-2">
                JSON adicional (sin secretos; el modo y allowlist de arriba tienen prioridad)
                <textarea rows={3} value={config} onChange={(event) => setConfig(event.target.value)} />
              </label>
            </details>
          </>
        )}

        {!isChannel && (
          <>
            <label className="md:col-span-2">
              Configuración (JSON, sin secretos)
              <textarea rows={3} value={config} onChange={(event) => setConfig(event.target.value)} />
            </label>
            <label className="md:col-span-2">
              Secretos (JSON; se guardan en la bóveda del proyecto)
              <textarea rows={3} value={secrets} onChange={(event) => setSecrets(event.target.value)} />
            </label>
          </>
        )}

        <button className={`${buttonPrimary} md:col-span-2`} disabled={create.isPending || !name || !slug}>
          Crear integración
        </button>
      </form>

      {created && (
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
    </div>
  );
}
