import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import type { IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { button, buttonDanger, buttonGhost, buttonPrimary, card, statusBadge } from "../ui.ts";

const KINDS: Array<{ value: IntegrationRecord["kind"]; label: string; config: string; secrets: string }> = [
  {
    value: "telegram",
    label: "Telegram",
    config: '{"routing":{"mode":"agent","allowlist":[],"public":false},"alerts":["run.failed","integration.down"],"alertRecipient":""}',
    secrets: '{"token":"123456:ABC..."}',
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    config: '{"mode":"baileys","routing":{"mode":"agent","allowlist":[],"public":false},"alerts":["run.failed"],"alertRecipient":""}',
    secrets: "{}",
  },
  {
    value: "external_chat",
    label: "Chat externo / API",
    config: '{"routing":{"mode":"agent","allowlist":[],"public":false},"alerts":["run.failed"]}',
    secrets: "{}",
  },
  {
    value: "email",
    label: "Email (contrato futuro)",
    config: '{"from":"alertas@example.com","smtp":{"host":"smtp.example.com","port":587,"secure":false},"alerts":["run.failed"]}',
    secrets: '{"smtpPassword":"..."}',
  },
];

export function ControlChannelsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: qk.controlIntegrations, queryFn: () => api.controlIntegrations().then((result) => result.data) });
  const [kind, setKind] = useState<IntegrationRecord["kind"]>("telegram");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [config, setConfig] = useState(KINDS[0]!.config);
  const [secrets, setSecrets] = useState(KINDS[0]!.secrets);
  const [created, setCreated] = useState<{ integration: IntegrationRecord; apiKey?: string; webhookSecret?: string }>();
  const [status, setStatus] = useState<string>();
  const [qr, setQr] = useState<{ id: string; qr: string }>();
  const integrations = query.data ?? [];

  function chooseKind(next: IntegrationRecord["kind"]) {
    setKind(next);
    const option = KINDS.find((item) => item.value === next);
    setConfig(option?.config ?? "{}");
    setSecrets(option?.secrets ?? "{}");
  }

  const create = useMutation({
    mutationFn: () =>
      api.createControlIntegration({
        kind,
        name,
        slug,
        config: JSON.parse(config) as Record<string, unknown>,
        secrets: JSON.parse(secrets) as Record<string, string>,
      }),
    onSuccess: async (result) => {
      setCreated(result);
      setName("");
      setSlug("");
      setStatus("Canal del orquestador creado");
      await queryClient.invalidateQueries({ queryKey: qk.controlIntegrations });
      await queryClient.invalidateQueries({ queryKey: qk.controlOverview });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "No se pudo crear el canal"),
  });

  const test = useMutation({
    mutationFn: (id: string) => api.testControlIntegration(id),
    onSuccess: (result, id) => setStatus(`${id}: ${result.ok ? "ok" : "error"}${result.detail ? ` · ${result.detail}` : ""}`),
  });
  const connect = useMutation({
    mutationFn: (id: string) => api.connectControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal conectado");
      await queryClient.invalidateQueries({ queryKey: qk.controlIntegrations });
    },
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal desconectado");
      await queryClient.invalidateQueries({ queryKey: qk.controlIntegrations });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteControlIntegration(id),
    onSuccess: async () => {
      setStatus("Canal eliminado");
      await queryClient.invalidateQueries({ queryKey: qk.controlIntegrations });
    },
  });

  async function showQr(id: string) {
    try {
      const result = await api.controlIntegrationQr(id);
      setQr({ id, qr: await QRCode.toDataURL(result.qr, { margin: 1, width: 220 }) });
    } catch {
      setStatus("Todavía no hay un QR disponible para ese canal");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Estos canales son exclusivos del orquestador global: sirven para preguntar por el estado de todos los proyectos y
        recibir alertas de fallos. Los canales de cada proyecto se configuran dentro del proyecto.
      </p>
      {status && <p className="text-sm text-ok">{status}</p>}
      <div className="flex flex-col gap-2">
        {integrations.map((integration) => (
          <article className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[#0a1120] p-3" key={integration.id}>
            <span>
              <strong className="text-sm">{integration.name}</strong>{" "}
              <span className={statusBadge(integration.status)}>{integration.status}</span>
              <small className="block text-xs text-muted">
                {integration.kind} · <code>{integration.slug}</code>
              </small>
            </span>
            <span className="flex flex-wrap gap-1.5">
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
                  QR
                </button>
              )}
              <button className={buttonDanger} onClick={() => remove.mutate(integration.id)}>
                Borrar
              </button>
            </span>
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

      <form className={`${card} !grid gap-3 md:grid-cols-2`} onSubmit={submit} aria-label="Crear canal del orquestador">
        <label>
          Tipo
          <select value={kind} onChange={(event) => chooseKind(event.target.value as IntegrationRecord["kind"])}>
            {KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alertas admin" />
        </label>
        <label>
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="alertas-admin" />
        </label>
        <label>
          Configuración (JSON)
          <textarea rows={3} value={config} onChange={(event) => setConfig(event.target.value)} />
        </label>
        <label className="md:col-span-2">
          Secretos (JSON; van a la bóveda global)
          <textarea rows={2} value={secrets} onChange={(event) => setSecrets(event.target.value)} />
        </label>
        <button className={`${buttonPrimary} md:col-span-2`} disabled={create.isPending || !name || !slug}>
          Crear canal del orquestador
        </button>
      </form>

      {created && (
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
