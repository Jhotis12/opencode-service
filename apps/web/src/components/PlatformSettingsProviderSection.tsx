import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ModelInfo } from "../api.ts";
import { qk } from "../query.ts";
import { badge, friendlyError, smallMuted, statusBadge } from "../ui.ts";
import { Skeleton } from "./Skeleton.tsx";
import {
  PlatformSettingsFormActions,
  PlatformSettingsInput,
  PlatformSettingsQueryError,
  PlatformSettingsSection,
  usePlatformFieldValidation,
} from "./PlatformSettingsFields.tsx";

export function PlatformSettingsProviderSection({
  connected,
  models,
  modelsPending,
  modelsError,
  onRetryModels,
}: {
  readonly connected: boolean;
  readonly models: readonly ModelInfo[];
  readonly modelsPending: boolean;
  readonly modelsError?: unknown;
  readonly onRetryModels: () => void;
}) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string>();
  const validation = usePlatformFieldValidation((value) => value.trim() ? undefined : "Introduce la API key de OpenCode Go.");

  const connect = useMutation({
    mutationFn: () => api.connectProvider(apiKey.trim()),
    onSuccess: async (result) => {
      setApiKey("");
      setStatus(`Proveedor conectado. ${result.models.length} modelos disponibles.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.settings }),
        queryClient.invalidateQueries({ queryKey: qk.models }),
      ]);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    if (validation.validate(apiKey)) {
      document.getElementById("proveedores-api-key")?.focus();
      return;
    }
    connect.mutate();
  }

  return (
    <PlatformSettingsSection
      id="proveedores"
      title="Proveedores"
      description="Conecta OpenCode Go y revisa los modelos que puede usar la plataforma. La API key se cifra y no vuelve a mostrarse."
    >
      <span className={connected ? statusBadge("connected") : badge}>{connected ? "Conectado" : "Sin conectar"}</span>
      <form className="flex max-w-3xl flex-col gap-4" aria-labelledby="proveedores-title" noValidate onSubmit={onSubmit}>
        <PlatformSettingsInput
          id="proveedores-api-key"
          name="apiKey"
          type="password"
          label="API key de OpenCode Go"
          hint="Pega una clave nueva para conectar o reemplazar la actual."
          error={validation.error}
          value={apiKey}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => {
            setApiKey(event.target.value);
            validation.clear(event.target.value);
          }}
          onBlur={() => validation.validate(apiKey)}
        />
        <PlatformSettingsFormActions
          pending={connect.isPending}
          status={status}
          error={connect.error ? friendlyError(connect.error, "No se pudo conectar el proveedor.") : undefined}
          submitLabel="Conectar proveedor"
        />
      </form>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-slate-200">Modelos disponibles</h3>
        {modelsPending && (
          <div className="flex flex-col gap-2" aria-label="Cargando modelos">
            <Skeleton />
            <Skeleton className="w-2/3" />
          </div>
        )}
        {modelsError !== undefined && modelsError !== null && (
          <PlatformSettingsQueryError
            message={friendlyError(modelsError, "No se pudieron cargar los modelos.")}
            onRetry={onRetryModels}
          />
        )}
        {!modelsPending && !(modelsError !== undefined && modelsError !== null) && models.length === 0 && (
          <p className={smallMuted}>Conecta el proveedor para descubrir modelos.</p>
        )}
        {models.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {models.map((model) => (
              <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" key={`${model.providerID}/${model.modelID}`}>
                <code className="break-all text-slate-200">{model.providerID}/{model.modelID}</code>
                <span className="text-xs text-muted">{model.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PlatformSettingsSection>
  );
}
