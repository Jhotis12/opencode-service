import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { badge, friendlyError } from "../ui.ts";
import { notifySuccess } from "./Toast.tsx";
import {
  PlatformSettingsFormActions,
  PlatformSettingsInput,
  PlatformSettingsSection,
  usePlatformFieldValidation,
  validatePlatformSentryDsn,
} from "./PlatformSettingsFields.tsx";

export function PlatformSettingsTelemetrySection({ configured }: { readonly configured: boolean }) {
  const queryClient = useQueryClient();
  const [sentryDsn, setSentryDsn] = useState("");
  const validation = usePlatformFieldValidation(validatePlatformSentryDsn);

  const save = useMutation({
    mutationFn: () => api.saveSettings({ sentryDsn: sentryDsn.trim() }),
    onSuccess: async () => {
      setSentryDsn("");
      notifySuccess("DSN guardado. Reinicia el servicio para activar Sentry.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.settings }),
        queryClient.invalidateQueries({ queryKey: qk.effectiveConfig() }),
        queryClient.invalidateQueries({ queryKey: qk.secrets }),
      ]);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validation.validate(sentryDsn)) {
      document.getElementById("telemetria-dsn")?.focus();
      return;
    }
    save.mutate();
  }

  return (
    <PlatformSettingsSection
      id="telemetria"
      title="Telemetría"
      description="Configura Sentry, GlitchTip o Bugsink para centralizar errores. El DSN es un secreto y nunca se muestra después de guardarlo."
    >
      <span className={badge}>{configured ? "DSN configurado" : "DSN sin configurar"}</span>
      <form className="flex max-w-3xl flex-col gap-4" aria-labelledby="telemetria-title" noValidate onSubmit={onSubmit}>
        <PlatformSettingsInput
          id="telemetria-dsn"
          name="sentryDsn"
          type="password"
          label="DSN de Sentry o GlitchTip"
          hint="URL http o https. Se guarda cifrado y requiere reiniciar para aplicar el cambio."
          error={validation.error}
          value={sentryDsn}
          placeholder="https://clave@sentry.io/proyecto"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => {
            setSentryDsn(event.target.value);
            validation.clear(event.target.value);
          }}
          onBlur={() => validation.validate(sentryDsn)}
        />
        <PlatformSettingsFormActions
          pending={save.isPending}
          error={save.error ? friendlyError(save.error, "No se pudo guardar el DSN.") : undefined}
          submitLabel="Guardar DSN"
        />
      </form>
    </PlatformSettingsSection>
  );
}
