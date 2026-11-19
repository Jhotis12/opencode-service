import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { badge, buttonGhost, buttonPrimary, card, friendlyError, statusBadge } from "../ui.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Field } from "./Field.tsx";

const ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9:_-]*$/;

/**
 * Secciones de configuración del proyecto. La página de ajustes renderiza una
 * sola sección a la vez, según el `?section=` de la URL.
 */
export function ProjectSettingsPanel({
  projectSlug,
  section = "all",
}: {
  projectSlug: string;
  section?: "all" | "general" | "readiness" | "secrets";
}) {
  if (section === "secrets") return <ProjectSecretsPanel projectSlug={projectSlug} />;
  return <ProjectSettingsSections projectSlug={projectSlug} section={section} />;
}

function ProjectSettingsSections({
  projectSlug,
  section,
}: {
  projectSlug: string;
  section: "all" | "general" | "readiness";
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
  const [nameError, setNameError] = useState<string>();
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
    if (error) {
      return (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-danger">
            {friendlyError(error, "No se pudieron cargar los ajustes del proyecto.")}
          </p>
          <button
            type="button"
            className={buttonGhost}
            onClick={() => {
              void settingsQuery.refetch();
              if (modelsQuery.error) void modelsQuery.refetch();
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return <p className="text-sm text-muted">Cargando ajustes del proyecto…</p>;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {showGeneral && (
      <form
        className={`${card} gap-3`}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!name.trim()) {
            setNameError("El nombre es obligatorio.");
            setStatus(undefined);
            return;
          }
          setNameError(undefined);
          save.mutate();
        }}
        aria-label="Ajustes del proyecto"
        noValidate
      >
        <h2 className="text-base font-semibold text-slate-100">Identidad y modelo</h2>
        <Field id="project-name" label="Nombre" error={nameError}>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(undefined);
            }}
          />
        </Field>
        <Field id="project-description" label="Descripción">
          <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field id="project-default-model" label="Modelo por defecto del proyecto">
          <select value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)}>
            <option value="">Usar el modelo global</option>
            {models.map((model) => (
              <option key={`${model.providerID}/${model.modelID}`} value={`${model.providerID}/${model.modelID}`}>
                {model.name} · {model.providerID}/{model.modelID}
                {model.input?.includes("image") ? " · visión" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id="project-primary-agent" label="Agente principal">
          <input
            value={primaryAgent}
            onChange={(event) => setPrimaryAgent(event.target.value)}
            placeholder="principal/agente"
          />
        </Field>
        <h3 className="mt-2 text-sm font-semibold text-slate-100">Aprobaciones</h3>
        <Field id="project-approval-channel" label="Canal de aprobación del proyecto">
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
        </Field>
        <Field id="project-approval-recipient" label="Destinatario de aprobación">
          <input
            value={approvalRecipient}
            onChange={(event) => setApprovalRecipient(event.target.value)}
            placeholder="ID de destino o 123456789"
            list="project-approval-destinations"
          />
        </Field>
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
        <Field id="project-transcription" label="Conexión de transcripción por defecto">
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
        </Field>
        <p className="text-xs text-muted">
          Se usa para transcribir audio en modo agente. Los nodos Transcribir pueden elegir otra conexión.
        </p>
        {settings.integrations.every((integration) => integration.kind !== "transcription") && (
          <p className="text-xs text-warn">Crea una integración de Transcripción en Integraciones para habilitar audio.</p>
        )}
        <h3 className="mt-2 text-sm font-semibold text-slate-100">Voz</h3>
        <Field id="project-speech" label="Conexión de voz por defecto">
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
        </Field>
        <p className="text-xs text-muted">
          Se usa para responder con audio en Telegram y para los nodos Generar voz que no eligen otra conexión.
        </p>
        {settings.integrations.every((integration) => integration.kind !== "speech") && (
          <p className="text-xs text-warn">Crea una integración de Voz (TTS) en Integraciones para habilitar la respuesta por audio.</p>
        )}
        <button className={buttonPrimary} disabled={save.isPending}>
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

function ProjectSecretsPanel({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const secretsQuery = useQuery({
    queryKey: qk.projectSecrets(projectSlug),
    queryFn: () => api.listProjectSecrets(projectSlug).then((result) => result.data),
  });
  const [alias, setAlias] = useState("");
  const [value, setValue] = useState("");
  const [aliasError, setAliasError] = useState<string>();
  const [valueError, setValueError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<string>();

  const save = useMutation({
    mutationFn: (input: { alias: string; value: string }) =>
      api.saveProjectSecret(projectSlug, input.alias, input.value),
    onSuccess: async () => {
      setAlias("");
      setValue("");
      setStatus("Secreto guardado en la bóveda del proyecto");
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: qk.projectSecrets(projectSlug) });
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo guardar el secreto.")),
  });

  const remove = useMutation({
    mutationFn: (target: string) => api.deleteProjectSecret(projectSlug, target),
    onSuccess: async () => {
      setPendingDelete(undefined);
      setStatus("Secreto eliminado");
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: qk.projectSecrets(projectSlug) });
    },
    onError: (cause) => {
      setPendingDelete(undefined);
      setError(friendlyError(cause, "No se pudo eliminar el secreto."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextAlias = alias.trim();
    const nextValue = value;
    const nextAliasError = !nextAlias
      ? "El alias es obligatorio."
      : ALIAS_PATTERN.test(nextAlias)
        ? undefined
        : "El alias debe empezar por una letra y usar solo letras, números, :, _ o -.";
    const nextValueError = nextValue ? undefined : "El valor es obligatorio.";
    setAliasError(nextAliasError);
    setValueError(nextValueError);
    if (nextAliasError || nextValueError) {
      setStatus(undefined);
      return;
    }
    save.mutate({ alias: nextAlias, value: nextValue });
  }

  const secrets = secretsQuery.data ?? [];
  const queryError = secretsQuery.error instanceof Error ? secretsQuery.error.message : undefined;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form className={`${card} gap-3`} onSubmit={submit} aria-label="Secretos del proyecto" noValidate>
        <h2 className="text-base font-semibold text-slate-100">Secretos del proyecto</h2>
        <p className="text-xs text-muted">
          Se guardan en la bóveda del proyecto y se resuelven solo en el servidor: nunca llegan al agente ni a los workers.
        </p>
        <Field
          id="secret-alias"
          label="Alias"
          hint="Empieza por una letra y usa solo letras, números, :, _ o -."
          error={aliasError}
        >
          <input
            value={alias}
            onChange={(event) => {
              setAlias(event.target.value);
              if (aliasError) setAliasError(undefined);
            }}
            placeholder="openai_key"
            autoComplete="off"
          />
        </Field>
        <Field id="secret-value" label="Valor" error={valueError}>
          <input
            type="password"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (valueError) setValueError(undefined);
            }}
            placeholder="Valor del secreto"
            autoComplete="off"
          />
        </Field>
        <button className={buttonPrimary} disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar secreto"}
        </button>
        {status && <p className="text-sm text-ok">{status}</p>}
        {(error || queryError) && <p className="text-sm text-danger">{error ?? queryError}</p>}
      </form>

      <aside className={`${card} gap-2`}>
        <h2 className="text-base font-semibold text-slate-100">Alias guardados</h2>
        <p className="text-xs text-muted">
          Referencia un alias desde una integración o un nodo con <code>{`{{secret:alias}}`}</code>.
        </p>
        <ul className="flex flex-col gap-2">
          {secrets.map((secret) => (
            <li
              key={secret.alias}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-well p-2"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm text-slate-200">{secret.alias}</strong>
                <small className="text-xs text-muted">{secret.kind}</small>
              </span>
              <button
                type="button"
                className={buttonGhost}
                aria-label={`Borrar el secreto ${secret.alias}`}
                onClick={() => setPendingDelete(secret.alias)}
              >
                Borrar
              </button>
            </li>
          ))}
          {secrets.length === 0 && !secretsQuery.isLoading && (
            <li className="text-sm text-muted">Sin secretos de proyecto.</li>
          )}
        </ul>
      </aside>

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar secreto"
          confirmLabel="Eliminar"
          pending={remove.isPending}
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => remove.mutate(pendingDelete)}
        >
          <p className="text-sm text-muted">
            Se eliminará el secreto <strong>{pendingDelete}</strong> de la bóveda del proyecto. Las integraciones que lo
            referencian dejarán de resolverlo.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
