import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PLATFORM_DEFAULT_MODEL } from "@platform/shared";
import { api, type ModelInfo } from "../api.ts";
import { qk } from "../query.ts";
import { friendlyError, smallMuted } from "../ui.ts";
import { Skeleton } from "./Skeleton.tsx";
import {
  PlatformSettingsFormActions,
  PlatformSettingsModelInput,
  PlatformSettingsQueryError,
  PlatformSettingsSection,
  usePlatformFieldValidation,
  validatePlatformModel,
} from "./PlatformSettingsFields.tsx";

const MODEL_SECTION_COPY = {
  defaultModel: {
    id: "modelo",
    title: "Modelo por defecto",
    description: "Se usa cuando el proyecto, el flujo o el nodo no definen un modelo propio. Por defecto: DeepSeek V4.1 Flash.",
    success: "Modelo por defecto guardado.",
    emptyLabel: "Sin modelo (usar el valor por defecto)",
  },
  orchestratorModel: {
    id: "orquestador",
    title: "Modelo del orquestador",
    description: "Se usa en el plano de control global. Si lo dejas vacío, hereda el modelo por defecto (DeepSeek V4.1 Flash).",
    success: "Modelo del orquestador guardado.",
    emptyLabel: "Heredar el modelo por defecto",
  },
} as const;

type ModelSettingKey = keyof typeof MODEL_SECTION_COPY;

type PlatformModelSectionProps = {
  readonly initialValue?: string;
  readonly models: readonly ModelInfo[];
  readonly modelsPending: boolean;
  readonly modelsError?: unknown;
  readonly onRetryModels: () => void;
};

function saveModel(key: ModelSettingKey, value: string | null) {
  if (key === "defaultModel") return api.saveSettings({ defaultModel: value });
  return api.saveSettings({ orchestratorModel: value });
}

function PlatformModelForm({ kind, initialValue, models, modelsPending, modelsError, onRetryModels }: PlatformModelSectionProps & { readonly kind: ModelSettingKey }) {
  const queryClient = useQueryClient();
  const copy = MODEL_SECTION_COPY[kind];
  const inputId = `${copy.id}-value`;
  const selectedValue = initialValue ?? PLATFORM_DEFAULT_MODEL;
  const [draft, setDraft] = useState(selectedValue);
  const [status, setStatus] = useState<string>();
  const validation = usePlatformFieldValidation(validatePlatformModel);

  useEffect(() => setDraft(selectedValue), [selectedValue]);

  const save = useMutation({
    mutationFn: () => saveModel(kind, draft.trim() || null),
    onSuccess: async () => {
      setDraft(draft.trim());
      setStatus(copy.success);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.settings }),
        queryClient.invalidateQueries({ queryKey: qk.effectiveConfig() }),
      ]);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    if (validation.validate(draft)) {
      document.getElementById(inputId)?.focus();
      return;
    }
    save.mutate();
  }

  return (
    <PlatformSettingsSection id={copy.id} title={copy.title} description={copy.description}>
      <form className="flex max-w-3xl flex-col gap-4" aria-labelledby={`${copy.id}-title`} noValidate onSubmit={onSubmit}>
        <PlatformSettingsModelInput
          id={inputId}
          label="Modelo"
          hint="Formato: proveedor/modelo#variante. La variante es opcional."
          error={validation.error}
          value={draft}
          models={models}
          emptyLabel={copy.emptyLabel}
          onChange={(value) => {
            setDraft(value);
            validation.validate(value);
          }}
        />
        {modelsPending && (
          <div className="flex flex-col gap-2" aria-label="Cargando sugerencias de modelos">
            <Skeleton className="max-w-sm" />
            <p className={smallMuted}>Cargando sugerencias de modelos…</p>
          </div>
        )}
        {modelsError !== undefined && modelsError !== null && (
          <PlatformSettingsQueryError
            message={friendlyError(modelsError, "No se pudieron cargar las sugerencias. Puedes escribir el modelo manualmente.")}
            onRetry={onRetryModels}
          />
        )}
        <PlatformSettingsFormActions
          pending={save.isPending}
          status={status}
          error={save.error ? friendlyError(save.error, "No se pudo guardar el modelo.") : undefined}
        />
      </form>
    </PlatformSettingsSection>
  );
}

export function PlatformSettingsModelSection(props: PlatformModelSectionProps) {
  return <PlatformModelForm {...props} kind="defaultModel" />;
}

export function PlatformSettingsOrchestratorSection(props: PlatformModelSectionProps) {
  return <PlatformModelForm {...props} kind="orchestratorModel" />;
}
