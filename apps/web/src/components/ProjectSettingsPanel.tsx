import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { badge, buttonPrimary, card, statusBadge } from "../ui.ts";

export function ProjectSettingsPanel({
  projectSlug,
  section = "all",
}: {
  projectSlug: string;
  section?: "all" | "general" | "readiness";
}) {
  const queryClient = useQueryClient();
  const showGeneral = section === "all" || section === "general";
  const showReadiness = section === "all" || section === "readiness";
  const settingsQuery = useQuery({
    queryKey: qk.projectSettings(projectSlug),
    queryFn: () => api.getProjectSettings(projectSlug),
  });
  const destinationsQuery = useQuery({
    queryKey: qk.destinations(projectSlug),
    queryFn: () => api.listDestinations(projectSlug).then((result) => result.data),
    enabled: showGeneral,
  });
  const modelsQuery = useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((result) => result.data),
    staleTime: 5 * 60_000,
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [primaryAgent, setPrimaryAgent] = useState("");
  const [approvalIntegrationId, setApprovalIntegrationId] = useState("");
  const [approvalRecipient, setApprovalRecipient] = useState("");
  const [transcriptionIntegrationId, setTranscriptionIntegrationId] = useState("");
  const [speechIntegrationId, setSpeechIntegrationId] = useState("");
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!settingsQuery.data) return;
    setName(settingsQuery.data.project.name);
    setDescription(settingsQuery.data.project.description);
    setDefaultModel(settingsQuery.data.project.defaultModel ?? "");
    setPrimaryAgent(settingsQuery.data.project.primaryAgent ?? "");
    setApprovalIntegrationId(settingsQuery.data.project.approvalIntegrationId ?? "");
    setApprovalRecipient(settingsQuery.data.project.approvalRecipient ?? "");
    setTranscriptionIntegrationId(settingsQuery.data.project.transcriptionIntegrationId ?? "");
    setSpeechIntegrationId(settingsQuery.data.project.speechIntegrationId ?? "");
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      api.updateProjectSettings(projectSlug, {
        name,
        description,
        defaultModel: defaultModel || null,
        primaryAgent: primaryAgent || null,
        approvalIntegrationId: approvalIntegrationId || null,
        approvalRecipient: approvalRecipient || null,
        transcriptionIntegrationId: transcriptionIntegrationId || null,
        speechIntegrationId: speechIntegrationId || null,
      }),
    onSuccess: async () => {
      setStatus("Ajustes del proyecto guardados");
      await queryClient.invalidateQueries({ queryKey: qk.projectSettings(projectSlug) });
      await queryClient.invalidateQueries({ queryKey: qk.projects });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "No se pudieron guardar los ajustes"),
  });

  const settings = settingsQuery.data;
  const models = modelsQuery.data ?? [];
  const destinations = destinationsQuery.data ?? [];
  const error = settingsQuery.error ?? modelsQuery.error ?? save.error;

  if (!settings) {
    return <p className="text-sm text-muted">{error instanceof Error ? error.message : "Cargando ajustes del proyecto…"}</p>;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {showGeneral && (
      <form
        className={`${card} gap-3`}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        aria-label="Ajustes del proyecto"
      >
        <h2 className="text-base font-semibold text-slate-100">Identidad y modelo</h2>
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Descripción
          <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          Modelo por defecto del proyecto
          <select value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)}>
            <option value="">Usar el modelo global</option>
            {models.map((model) => (
              <option key={`${model.providerID}/${model.modelID}`} value={`${model.providerID}/${model.modelID}`}>
                {model.name} · {model.providerID}/{model.modelID}
                {model.input?.includes("image") ? " · visión" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agente principal
          <input
            value={primaryAgent}
            onChange={(event) => setPrimaryAgent(event.target.value)}
            placeholder="principal/agente"
          />
        </label>
        <h3 className="mt-2 text-sm font-semibold text-slate-100">Aprobaciones</h3>
        <label>
          Canal de aprobación del proyecto
          <select
            value={approvalIntegrationId}
            onChange={(event) => setApprovalIntegrationId(event.target.value)}
          >
            <option value="">Sin canal por defecto</option>
            {settings.integrations
              .filter((integration) => integration.capabilities.includes("outbound_message"))
              .map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name} · {integration.kind}
                </option>
              ))}
          </select>
        </label>
        <label>
          Destinatario de aprobación
          <input
            value={approvalRecipient}
            onChange={(event) => setApprovalRecipient(event.target.value)}
            placeholder="ID de destino o 123456789"
            list="project-approval-destinations"
          />
        </label>
        <datalist id="project-approval-destinations">
          {destinations.map((destination) => (
            <option key={destination.id} value={destination.id}>
              {destination.label} · {destination.value}
            </option>
          ))}
        </datalist>
        <p className="text-xs text-muted">
          Puedes usar un destino etiquetado de la sección Destinos o un valor crudo; los valores existentes siguen siendo válidos.
        </p>
        <h3 className="mt-2 text-sm font-semibold text-slate-100">Transcripción</h3>
        <label>
          Conexión de transcripción por defecto
          <select
            value={transcriptionIntegrationId}
            onChange={(event) => setTranscriptionIntegrationId(event.target.value)}
          >
            <option value="">Sin conexión por defecto</option>
            {settings.integrations
              .filter((integration) => integration.kind === "transcription")
              .map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name} · {String(integration.config.model ?? "sin modelo")}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          Se usa para transcribir audio en modo agente. Los nodos Transcribir pueden elegir otra conexión.
        </p>
        {settings.integrations.every((integration) => integration.kind !== "transcription") && (
          <p className="text-xs text-warn">Crea una integración de Transcripción en Recursos para habilitar audio.</p>
        )}
        <h3 className="mt-2 text-sm font-semibold text-slate-100">Voz</h3>
        <label>
          Conexión de voz por defecto
          <select value={speechIntegrationId} onChange={(event) => setSpeechIntegrationId(event.target.value)}>
            <option value="">Sin conexión por defecto</option>
            {settings.integrations
              .filter((integration) => integration.kind === "speech")
              .map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name} · {String(integration.config.voice ?? "sin voz")}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          Se usa para responder con audio en Telegram y para los nodos Generar voz que no eligen otra conexión.
        </p>
        {settings.integrations.every((integration) => integration.kind !== "speech") && (
          <p className="text-xs text-warn">Crea una integración de Voz (TTS) en Recursos para habilitar la respuesta por audio.</p>
        )}
        <button className={buttonPrimary} disabled={save.isPending || !name}>
          Guardar ajustes
        </button>
        {status && <p className="text-sm text-ok">{status}</p>}
        {error && <p className="text-sm text-danger">{error instanceof Error ? error.message : "Error de ajustes"}</p>}
      </form>
      )}

      {showReadiness && (
      <aside className={`${card} gap-2`}>
        <h2 className="text-base font-semibold text-slate-100">Preparación del proyecto</h2>
        <p className="text-xs text-muted">Completa estos pasos para que el caso de uso esté listo.</p>
        <ul className="flex flex-col gap-2">
          {settings.readiness.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span className={statusBadge(item.ready ? "ok" : "paused")}>{item.ready ? "listo" : "pendiente"}</span>
              <span>
                <strong className="block text-sm text-slate-200">{item.label}</strong>
                {item.detail && <small className="text-xs text-muted">{item.detail}</small>}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          <span className={badge}>{settings.integrations.length} integraciones</span>
          <span className={badge}>{settings.notebooks.length} notebooks</span>
        </div>
      </aside>
      )}
    </div>
  );
}
