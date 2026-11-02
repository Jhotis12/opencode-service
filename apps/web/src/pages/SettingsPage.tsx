import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { api, type ChannelSummary, type ModelInfo, type ProjectSummary } from "../api.ts";
import { qk } from "../query.ts";
import { Modal } from "../components/Modal.tsx";
import { badge, button, buttonGhost, buttonPrimary, card, pageTitle, statusBadge } from "../ui.ts";

type ModalKey = "model" | "provider" | "vault" | "database" | "channel" | "telemetry";

const CHANNEL_HELP: Record<ChannelSummary["type"], string> = {
  external_chat:
    "Conecta el chat de otra aplicación. Al crear el canal recibes una API key; tu app debe hacer POST a /api/v1/channels/<slug>/messages con el header x-channel-key y un threadId estable para mantener la conversación.",
  telegram:
    "Crea un bot con @BotFather, pega el token y añade tu ID de Telegram a la allowlist. Pulsa Iniciar para conectar el bot.",
  whatsapp:
    "Baileys abre un QR para escanear con tu WhatsApp; Cloud API usa las credenciales de Meta. Añade tu número a la allowlist de administradores.",
};

function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    void QRCode.toDataURL(value, { margin: 1, width: 220 }).then(setSrc).catch(() => setSrc(undefined));
  }, [value]);
  return src ? (
    <img className="h-[200px] w-[200px] rounded-lg bg-white" src={src} alt="Código QR de WhatsApp" />
  ) : (
    <pre>{value}</pre>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: qk.settings, queryFn: () => api.getSettings().then((result) => result.data) });
  const secretsQuery = useQuery({ queryKey: qk.secrets, queryFn: () => api.listSecrets().then((result) => result.data) });
  const databasesQuery = useQuery({ queryKey: qk.databases, queryFn: () => api.listDatabases().then((result) => result.data) });
  const channelsQuery = useQuery({ queryKey: qk.channels, queryFn: () => api.listChannels().then((result) => result.data) });
  const modelsQuery = useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((result) => result.data),
    staleTime: 5 * 60_000,
  });
  const projectsQuery = useQuery({ queryKey: qk.projects, queryFn: () => api.listProjects().then((result) => result.data) });

  const settings = settingsQuery.data;
  const secrets = secretsQuery.data ?? [];
  const databases = databasesQuery.data ?? [];
  const channels = channelsQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const [modal, setModal] = useState<ModalKey>();
  const [dbTests, setDbTests] = useState<Record<string, { ok: boolean; latencyMs: number; detail?: string }>>({});
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  const [apiKey, setApiKey] = useState("");
  const [defaultModelDraft, setDefaultModelDraft] = useState("");
  const [secretAlias, setSecretAlias] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [dbAlias, setDbAlias] = useState("");
  const [dbDriver, setDbDriver] = useState("postgres");
  const [dbConfig, setDbConfig] = useState('{"connectionString":"postgres://user:pass@host:5432/db"}');
  const [sentryDsn, setSentryDsn] = useState("");

  const [channelType, setChannelType] = useState<ChannelSummary["type"]>("external_chat");
  const [channelSlug, setChannelSlug] = useState("");
  const [channelName, setChannelName] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [channelPublic, setChannelPublic] = useState(false);
  const [channelProject, setChannelProject] = useState("");
  const [channelModel, setChannelModel] = useState("");
  const [channelToken, setChannelToken] = useState("");
  const [channelPhoneId, setChannelPhoneId] = useState("");
  const [channelMode, setChannelMode] = useState("baileys");
  const [createdChannel, setCreatedChannel] = useState<{ slug: string; apiKey?: string; webhookSecret?: string }>();
  const [qr, setQr] = useState<{ slug: string; qr: string }>();

  useEffect(() => {
    if (settings?.defaultModel) setDefaultModelDraft(settings.defaultModel);
  }, [settings?.defaultModel]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("channel.status", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { channelSlug: string; qr?: string; status: string };
      if (data.qr) setQr({ slug: data.channelSlug, qr: data.qr });
      setStatus(`Canal ${data.channelSlug}: ${data.status}`);
    });
    return () => source.close();
  }, []);

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
      setStatus("Secreto guardado en la bóveda");
      await queryClient.invalidateQueries({ queryKey: qk.secrets });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo guardar el secreto"),
  });

  const saveDatabase = useMutation({
    mutationFn: () => {
      const config = JSON.parse(dbConfig) as Record<string, unknown>;
      return api.saveDatabase(dbAlias, { ...config, driver: dbDriver });
    },
    onSuccess: async () => {
      setStatus(`Base de datos ${dbAlias} registrada`);
      await queryClient.invalidateQueries({ queryKey: qk.databases });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Configuración de base de datos inválida"),
  });

  const testDatabase = useMutation({
    mutationFn: (alias: string) => api.testDatabase(alias),
    onSuccess: (result, alias) => setDbTests((current) => ({ ...current, [alias]: result })),
  });

  const createChannel = useMutation({
    mutationFn: () => {
      const config: Record<string, unknown> = {};
      if (channelType === "external_chat") {
        if (channelProject) config.projectSlug = channelProject;
        if (channelModel) config.model = channelModel;
      }
      if (channelType === "telegram") config.token = channelToken;
      if (channelType === "whatsapp") {
        config.mode = channelMode;
        if (channelMode === "cloud") {
          config.token = channelToken;
          config.phoneNumberId = channelPhoneId;
        }
      }
      return api.createChannel({
        slug: channelSlug,
        type: channelType,
        name: channelName,
        adminAllowlist: allowlist
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        isPublic: channelPublic,
        config,
      });
    },
    onSuccess: async (result) => {
      setCreatedChannel({ slug: result.channel.slug, apiKey: result.apiKey, webhookSecret: result.webhookSecret });
      setChannelSlug("");
      setChannelName("");
      setChannelToken("");
      setStatus(`Canal ${result.channel.slug} creado`);
      await queryClient.invalidateQueries({ queryKey: qk.channels });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo crear el canal"),
  });

  const startChannel = useMutation({
    mutationFn: (slug: string) => api.startChannel(slug),
    onSuccess: async () => {
      setStatus("Canal iniciado");
      await queryClient.invalidateQueries({ queryKey: qk.channels });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "No se pudo iniciar el canal"),
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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copiado al portapapeles");
    } catch {
      setStatus(text);
    }
  }

  const queryError = settingsQuery.error ?? secretsQuery.error ?? databasesQuery.error ?? channelsQuery.error;
  const endpoint = createdChannel ? `/api/v1/channels/${createdChannel.slug}/messages` : "";

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Ajustes</h1>
          <p className="mt-1 text-sm text-muted">Cada sección se gestiona en su propio panel para no saturar la página.</p>
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
          { label: "Secretos", value: String(secrets.length) },
          { label: "Bases externas", value: String(databases.length) },
          { label: "Canales", value: String(channels.length) },
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
          <p className="text-xs text-muted">Se usa cuando un flujo o nodo no define un modelo propio.</p>
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
          <h2 className="text-base font-semibold text-slate-100">Bóveda de secretos</h2>
          <p className="text-xs text-muted">{secrets.length} secretos cifrados con AES-256-GCM.</p>
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
            {secrets.map((secret) => (
              <span className={badge} key={secret.alias}>
                {secret.alias}
              </span>
            ))}
          </div>
          <button className={`${button} self-start`} onClick={() => setModal("vault")}>
            Gestionar secretos
          </button>
        </article>

        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">Bases de datos externas</h2>
          <p className="text-xs text-muted">{databases.length} conexiones registradas por alias.</p>
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
            {databases.map((database) => (
              <span className={badge} key={database.alias}>
                <code className="border-0 bg-transparent p-0">{database.alias}</code> · {database.driver}
              </span>
            ))}
          </div>
          <button className={`${button} self-start`} onClick={() => setModal("database")}>
            Gestionar bases de datos
          </button>
        </article>

        <article className={card}>
          <h2 className="text-base font-semibold text-slate-100">Canales</h2>
          <p className="text-xs text-muted">
            {channels.length} canales. Telegram, WhatsApp o el chat de otra aplicación.
            {qr && <strong className="text-warn"> Hay un QR de WhatsApp pendiente.</strong>}
          </p>
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
            {channels.map((channel) => (
              <span className={badge} key={channel.slug}>
                <code className="border-0 bg-transparent p-0">{channel.slug}</code> · {channel.status}
              </span>
            ))}
          </div>
          <button className={`${button} self-start`} onClick={() => setModal("channel")}>
            Configurar canales
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
      </div>

      {settings && (
        <p className="text-xs text-muted">
          Datos persistentes: <code>{settings.dataDir}</code>
        </p>
      )}

      {modal === "model" && (
        <Modal title="Modelo por defecto" onClose={() => setModal(undefined)}>
          <p className="text-xs text-muted">Se usa cuando un flujo o nodo no define un modelo propio.</p>
          <label>
            Modelo
            <select value={defaultModelDraft} onChange={(event) => setDefaultModelDraft(event.target.value)}>
              <option value="">Sin modelo global (usar el de OpenCode)</option>
              {models.map((model) => {
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
        <Modal title="OpenCode Go" onClose={() => setModal(undefined)}>
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
        <Modal title="Bóveda de secretos" onClose={() => setModal(undefined)}>
          <p className="text-xs text-muted">Los valores se cifran con AES-256-GCM y solo se resuelven por alias.</p>
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

      {modal === "database" && (
        <Modal title="Bases de datos externas" onClose={() => setModal(undefined)}>
          <p className="text-xs text-muted">
            Se referencian por alias desde los nodos (`ctx.db("alias", ...)`) y desde las herramientas del agente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={dbAlias} onChange={(event) => setDbAlias(event.target.value.toLowerCase())} placeholder="crm_prod" className="min-w-[160px] flex-1" />
            <select value={dbDriver} onChange={(event) => setDbDriver(event.target.value)} className="w-auto">
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mssql">SQL Server</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>
          <textarea rows={3} value={dbConfig} onChange={(event) => setDbConfig(event.target.value)} aria-label="Configuración de base de datos" />
          <button className={button} disabled={saveDatabase.isPending || !dbAlias} onClick={() => saveDatabase.mutate()}>
            Registrar base de datos
          </button>
          <ul className="flex flex-col gap-1.5 text-sm">
            {databases.map((database) => (
              <li key={database.alias} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <code>{database.alias}</code> <span className={badge}>{database.driver}</span>
                  {dbTests[database.alias] && (
                    <span className={statusBadge(dbTests[database.alias]!.ok ? "ok" : "error")}>
                      {dbTests[database.alias]!.ok
                        ? `ok · ${dbTests[database.alias]!.latencyMs} ms`
                        : `error: ${dbTests[database.alias]!.detail ?? "sin detalle"}`}
                    </span>
                  )}
                </span>
                <button className={buttonGhost} onClick={() => testDatabase.mutate(database.alias)}>
                  Probar
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {modal === "channel" && (
        <Modal title="Canales" onClose={() => setModal(undefined)}>
          <div className="flex flex-col gap-1.5 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <strong className="text-sm text-slate-100">¿Cómo se usan?</strong>
            <p className="text-xs text-muted">{CHANNEL_HELP[channelType]}</p>
            <p className="text-xs text-muted">
              La allowlist de administradores permite hablar con el agente orquestador global; los remitentes que no
              están en ella solo pueden disparar flujos con triggers públicos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={channelType} onChange={(event) => setChannelType(event.target.value as ChannelSummary["type"])} className="w-auto">
              <option value="external_chat">Chat externo (API)</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input value={channelSlug} onChange={(event) => setChannelSlug(event.target.value.toLowerCase())} placeholder="mi-app" className="min-w-[140px] flex-1" />
            <input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="Nombre" className="min-w-[140px] flex-1" />
          </div>

          <input value={allowlist} onChange={(event) => setAllowlist(event.target.value)} placeholder="Admin IDs / teléfonos separados por coma" />
          <label className="flex-row items-center gap-2">
            <input type="checkbox" checked={channelPublic} onChange={(event) => setChannelPublic(event.target.checked)} className="w-auto" />
            Permitir triggers públicos de flujos desde este canal
          </label>

          {channelType === "external_chat" && (
            <>
              <label>
                Proyecto que responde (opcional)
                <select value={channelProject} onChange={(event) => setChannelProject(event.target.value)}>
                  <option value="">Chat directo del agente</option>
                  {projects.map((project) => (
                    <option key={project.slug} value={project.slug}>
                      {project.name} ({project.slug})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Modelo del chat
                <select value={channelModel} onChange={(event) => setChannelModel(event.target.value)}>
                  <option value="">Modelo por defecto del sistema</option>
                  {models.map((model) => (
                    <option key={`${model.providerID}/${model.modelID}`} value={`${model.providerID}/${model.modelID}`}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {channelType === "telegram" && (
            <label>
              Token del bot (@BotFather)
              <input type="password" value={channelToken} onChange={(event) => setChannelToken(event.target.value)} placeholder="123456:ABC…" />
            </label>
          )}

          {channelType === "whatsapp" && (
            <>
              <label>
                Modo
                <select value={channelMode} onChange={(event) => setChannelMode(event.target.value)}>
                  <option value="baileys">Baileys (QR personal)</option>
                  <option value="cloud">WhatsApp Cloud API (Meta)</option>
                </select>
              </label>
              {channelMode === "cloud" && (
                <>
                  <input type="password" value={channelToken} onChange={(event) => setChannelToken(event.target.value)} placeholder="Token de Meta" />
                  <input value={channelPhoneId} onChange={(event) => setChannelPhoneId(event.target.value)} placeholder="Phone number ID" />
                </>
              )}
            </>
          )}

          <button className={buttonPrimary} disabled={createChannel.isPending || !channelSlug || !channelName} onClick={() => createChannel.mutate()}>
            Crear canal
          </button>

          {createdChannel && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-accent/35 bg-accent/10 p-3 text-sm">
              <strong className="text-slate-100">Guarda estas credenciales ahora (no se vuelven a mostrar):</strong>
              <p>
                Canal <code>{createdChannel.slug}</code>
              </p>
              {createdChannel.apiKey && (
                <p className="flex flex-wrap items-center gap-2">
                  API key: <code>{createdChannel.apiKey}</code>
                  <button className={buttonGhost} onClick={() => void copy(createdChannel.apiKey!)}>
                    Copiar
                  </button>
                </p>
              )}
              {createdChannel.webhookSecret && (
                <p className="flex flex-wrap items-center gap-2">
                  Webhook secret: <code>{createdChannel.webhookSecret}</code>
                  <button className={buttonGhost} onClick={() => void copy(createdChannel.webhookSecret!)}>
                    Copiar
                  </button>
                </p>
              )}
              {createdChannel.apiKey && (
                <>
                  <p className="flex flex-wrap items-center gap-2">
                    Endpoint: <code>{endpoint}</code>
                    <button className={buttonGhost} onClick={() => void copy(endpoint)}>
                      Copiar
                    </button>
                  </p>
                  <pre>{`curl -X POST ${window.location.origin}${endpoint} \\
  -H "content-type: application/json" \\
  -H "x-channel-key: ${createdChannel.apiKey}" \\
  -d '{"threadId":"cliente-42","message":"Hola"}'`}</pre>
                </>
              )}
            </div>
          )}

          {qr && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-accent/35 bg-accent/10 p-3 text-sm">
              <strong className="text-slate-100">Escanea el QR de WhatsApp ({qr.slug})</strong>
              <QrImage value={qr.qr} />
            </div>
          )}

          <h3 className="text-sm font-semibold text-slate-100">Canales existentes</h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {channels.map((channel) => (
              <li key={channel.slug} className="flex flex-col gap-1.5 border-b border-line pb-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <code>{channel.slug}</code> <span className={badge}>{channel.type}</span> · {channel.status}
                    {channel.hasKey && <span className={statusBadge("ok")}>API key</span>}
                  </span>
                  <button className={buttonGhost} onClick={() => startChannel.mutate(channel.slug)}>
                    Iniciar
                  </button>
                </div>
                <p className="text-xs text-muted">{CHANNEL_HELP[channel.type]}</p>
                {channel.type === "external_chat" && <code>/api/v1/channels/{channel.slug}/messages</code>}
              </li>
            ))}
            {channels.length === 0 && <p className="text-sm text-muted">Aún no hay canales configurados.</p>}
          </ul>
        </Modal>
      )}

      {modal === "telemetry" && (
        <Modal title="Telemetría y errores" onClose={() => setModal(undefined)}>
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
