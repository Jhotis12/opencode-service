import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type ModelInfo } from "../api.ts";
import { qk } from "../query.ts";
import { Modal } from "../components/Modal.tsx";
import { ControlChannelsPanel } from "../components/ControlChannelsPanel.tsx";
import { badge, button, buttonPrimary, card, pageTitle, statusBadge } from "../ui.ts";

type ModalKey = "model" | "provider" | "vault" | "telemetry";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: qk.settings, queryFn: () => api.getSettings().then((result) => result.data) });
  const secretsQuery = useQuery({ queryKey: qk.secrets, queryFn: () => api.listSecrets().then((result) => result.data) });
  const modelsQuery = useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((result) => result.data),
    staleTime: 5 * 60_000,
  });

  const settings = settingsQuery.data;
  const secrets = secretsQuery.data ?? [];
  const models = modelsQuery.data ?? [];

  const [modal, setModal] = useState<ModalKey>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [apiKey, setApiKey] = useState("");
  const [defaultModelDraft, setDefaultModelDraft] = useState("");
  const [secretAlias, setSecretAlias] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [sentryDsn, setSentryDsn] = useState("");

  useEffect(() => {
    if (settings?.defaultModel) setDefaultModelDraft(settings.defaultModel);
  }, [settings?.defaultModel]);

  const connectProvider = useMutation({
    mutationFn: () => api.connectProvider(apiKey),
    onSuccess: async (result) => {
      setApiKey("");
      setStatus(`OpenCode Go conectado · ${result.models.length} modelos`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.settings }),
        queryClient.invalidateQueries({ queryKey: qk.models }),
      ]);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo conectar el proveedor"),
  });

  const saveDefaultModel = useMutation({
    mutationFn: () => api.saveSettings({ defaultModel: defaultModelDraft || null }),
    onSuccess: async () => {
      setStatus(defaultModelDraft ? `Modelo por defecto: ${defaultModelDraft}` : "Modelo por defecto eliminado");
      setModal(undefined);
      await queryClient.invalidateQueries({ queryKey: qk.settings });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el modelo"),
  });

  const saveSecret = useMutation({
    mutationFn: () => api.saveSecret(secretAlias, secretValue),
    onSuccess: async () => {
      setSecretAlias("");
      setSecretValue("");
      setStatus("Secreto de plataforma guardado en la bóveda");
      await queryClient.invalidateQueries({ queryKey: qk.secrets });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el secreto"),
  });

  const saveSentry = useMutation({
    mutationFn: () => api.saveSettings({ sentryDsn }),
    onSuccess: async () => {
      setSentryDsn("");
      setStatus("DSN guardado. Reinicia para activar Sentry.");
      await queryClient.invalidateQueries({ queryKey: qk.settings });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el DSN"),
  });

  const queryError = settingsQuery.error ?? secretsQuery.error ?? modelsQuery.error;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Ajustes de plataforma</h1>
          <p className="mt-1 text-sm text-muted">
            Proveedor, bóveda global, telemetría y canales del orquestador. Los recursos de cada caso de uso se configuran
            dentro de su proyecto.
          </p>
        </div>
        {settings && <span className={badge}>Modo OpenCode: {settings.opencodeMode}</span>}
      </header>

      {status && (
        <p className="text-sm text-ok" aria-live="polite">
          {status}
        </p>
      )}
      {(error || queryError) && (
        <p className="text-sm text-danger">
          {error ?? (queryError instanceof Error ? queryError.message : "Error al cargar ajustes")}
        </p>
      )}

      <div className={`${card} !flex-row flex-wrap gap-6`}>
        {[
          { label: "Modelo por defecto", value: settings?.defaultModel ?? "sin definir" },
          { label: "OpenCode Go", value: settings?.providerConnected ? "conectado" : "sin conectar" },
          { label: "Sentry / GlitchTip", value: settings?.sentryConfigured ? "configurado" : "sin configurar" },
          { label: "Secretos de plataforma", value: String(secrets.length) },
          { label: "Modelos disponibles", value: String(models.length) },
        ].map((item) => (
          <div className="flex min-w-[120px] flex-col gap-1" key={item.label}>
            <small className="text-xs text-muted">{item.label}</small>
            <strong className="text-sm text-slate-100">{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">Modelo por defecto</h2>
          <p className="text-xs text-muted">Se usa cuando el proyecto, el flujo o el nodo no definen un modelo propio.</p>
          <div className="flex items-center justify-between gap-2">
            <code>{settings?.defaultModel ?? "sin definir"}</code>
            <button className={button} onClick={() => setModal("model")}>
              Elegir modelo
            </button>
          </div>
        </article>

        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">OpenCode Go</h2>
          <p className="text-xs text-muted">Conecta la API key del proveedor y revisa los modelos disponibles.</p>
          <div className="flex items-center justify-between gap-2">
            <span className={statusBadge(settings?.providerConnected ? "connected" : "paused")}>
              {settings?.providerConnected ? "API key guardada" : "sin API key"}
            </span>
            <button className={button} onClick={() => setModal("provider")}>
              Conectar y ver modelos
            </button>
          </div>
        </article>

        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">Bóveda de plataforma</h2>
          <p className="text-xs text-muted">{secrets.length} secretos globales cifrados con AES-256-GCM.</p>
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
            {secrets.map((secret) => (
              <span className={badge} key={secret.alias}>
                {secret.alias}
              </span>
            ))}
          </div>
          <button className={`${button} self-start`} onClick={() => setModal("vault")}>
            Gestionar secretos de plataforma
          </button>
        </article>

        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">Telemetría y errores</h2>
          <p className="text-xs text-muted">
            Sentry / GlitchTip: {settings?.sentryConfigured ? "configurado" : "sin configurar"}.
          </p>
          <button className={`${button} self-start`} onClick={() => setModal("telemetry")}>
            Configurar Sentry
          </button>
        </article>

        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">Proyectos y conocimiento</h2>
          <p className="text-xs text-muted">
            Cada proyecto contiene sus canales, bases, secretos, agentes y bancos de información.
          </p>
          <Link className={`${button} self-start`} to="/projects">
            Ir a proyectos
          </Link>
        </article>
      </div>

      <section className={card}>
        <h2 className="text-base font-semibold text-slate-100">Canales del orquestador global</h2>
        <ControlChannelsPanel />
      </section>

      {settings && (
        <p className="text-xs text-muted">
          Datos persistentes: <code>{settings.dataDir}</code>
        </p>
      )}

      {modal === "model" && (
        <Modal title="Modelo por defecto" onClose={() => setModal(undefined)} size="sm">
          <p className="text-xs text-muted">Se usa cuando un flujo o nodo no define un modelo propio.</p>
          <label>
            Modelo
            <select value={defaultModelDraft} onChange={(event) => setDefaultModelDraft(event.target.value)}>
              <option value="">Sin modelo global (usar el de OpenCode)</option>
              {models.map((model: ModelInfo) => {
                const value = `${model.providerID}/${model.modelID}`;
                return (
                  <option key={value} value={value}>
                    {model.name} · {value}
                  </option>
                );
              })}
            </select>
          </label>
          <button className={buttonPrimary} disabled={saveDefaultModel.isPending} onClick={() => saveDefaultModel.mutate()}>
            Guardar modelo
          </button>
        </Modal>
      )}

      {modal === "provider" && (
        <Modal title="OpenCode Go" onClose={() => setModal(undefined)} size="md">
          <p className="text-xs text-muted">
            La key se guarda cifrada y nunca se muestra al agente. Estado:{" "}
            {settings?.providerConnected ? "conectado" : "sin conectar"}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-…"
              className="min-w-[220px] flex-1"
            />
            <button className={buttonPrimary} disabled={connectProvider.isPending || !apiKey} onClick={() => connectProvider.mutate()}>
              Conectar
            </button>
          </div>
          <h3 className="text-sm font-semibold text-slate-100">Modelos disponibles ({models.length})</h3>
          <div className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border border-line bg-[#080f1c] p-2">
            {models.map((model) => (
              <div
                className="flex justify-between gap-3 border-b border-line/50 px-1.5 py-1 text-xs last:border-0"
                key={`${model.providerID}/${model.modelID}`}
              >
                <code>
                  {model.providerID}/{model.modelID}
                </code>
                <span className="text-muted">{model.name}</span>
              </div>
            ))}
            {models.length === 0 && <p className="text-sm text-muted">Conecta el proveedor para descubrir modelos.</p>}
          </div>
        </Modal>
      )}

      {modal === "vault" && (
        <Modal title="Secretos de plataforma" onClose={() => setModal(undefined)} size="md">
          <p className="text-xs text-muted">
            Solo para proveedor, Sentry y el orquestador. Los secretos de cada proyecto se gestionan en su pestaña Recursos.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={secretAlias} onChange={(event) => setSecretAlias(event.target.value)} placeholder="alias" className="min-w-[160px] flex-1" />
            <input
              type="password"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="valor"
              className="min-w-[160px] flex-1"
            />
            <button className={button} disabled={saveSecret.isPending || !secretAlias || !secretValue} onClick={() => saveSecret.mutate()}>
              Guardar
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {secrets.map((secret) => (
              <li key={secret.alias}>
                <code>{secret.alias}</code> <span className={badge}>{secret.kind}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {modal === "telemetry" && (
        <Modal title="Telemetría y errores" onClose={() => setModal(undefined)} size="md">
          <p className="text-xs text-muted">
            Pega el DSN de Sentry (o de GlitchTip/Bugsink). Tras guardarlo, reinicia el contenedor para activar el SDK.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={sentryDsn}
              onChange={(event) => setSentryDsn(event.target.value)}
              placeholder="https://…@sentry.io/…"
              className="min-w-[220px] flex-1"
            />
            <button className={button} disabled={saveSentry.isPending || !sentryDsn} onClick={() => saveSentry.mutate()}>
              Guardar DSN
            </button>
          </div>
          <p className="text-xs text-muted">
            Estado actual: {settings?.sentryConfigured ? "configurado" : "sin configurar"}. El panel interno está en Salud
            del sistema.
          </p>
        </Modal>
      )}
    </section>
  );
}
