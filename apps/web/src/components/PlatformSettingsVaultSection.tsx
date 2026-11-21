import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { buttonDanger, fieldError, friendlyError, smallMuted } from "../ui.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Skeleton } from "./Skeleton.tsx";
import { notifySuccess } from "./Toast.tsx";
import {
  PlatformSettingsFormActions,
  PlatformSettingsInput,
  PlatformSettingsQueryError,
  PlatformSettingsSection,
  usePlatformFieldValidation,
  validatePlatformSecret,
  validatePlatformSecretAlias,
} from "./PlatformSettingsFields.tsx";

type VaultSecret = Awaited<ReturnType<typeof api.listSecrets>>["data"][number];

export function PlatformSettingsVaultSection({
  secrets,
  secretsPending,
  secretsError,
  onRetrySecrets,
}: {
  readonly secrets: readonly VaultSecret[];
  readonly secretsPending: boolean;
  readonly secretsError?: unknown;
  readonly onRetrySecrets: () => void;
}) {
  const queryClient = useQueryClient();
  const [alias, setAlias] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [aliasToDelete, setAliasToDelete] = useState<string>();
  const aliasValidation = usePlatformFieldValidation(validatePlatformSecretAlias);
  const valueValidation = usePlatformFieldValidation(validatePlatformSecret);
  const hasLoadError = secretsError !== undefined && secretsError !== null;

  const save = useMutation({
    mutationFn: () => api.saveSecret(alias.trim(), secretValue),
    onSuccess: async () => {
      setAlias("");
      setSecretValue("");
      notifySuccess("Secreto guardado en la bóveda.");
      await queryClient.invalidateQueries({ queryKey: qk.secrets });
    },
  });

  const remove = useMutation({
    mutationFn: (secretAlias: string) => api.deleteSecret(secretAlias),
    onSuccess: async (_result, secretAlias) => {
      notifySuccess(`Secreto ${secretAlias} eliminado.`);
      setAliasToDelete(undefined);
      await queryClient.invalidateQueries({ queryKey: qk.secrets });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const aliasError = aliasValidation.validate(alias);
    const valueError = valueValidation.validate(secretValue);
    if (aliasError || valueError) {
      document.getElementById(aliasError ? "boveda-alias" : "boveda-value")?.focus();
      return;
    }
    save.mutate();
  }

  function cancelDelete() {
    setAliasToDelete(undefined);
    remove.reset();
  }

  return (
    <PlatformSettingsSection
      id="boveda"
      title="Bóveda"
      description="Guarda secretos globales para proveedores, Sentry y el orquestador. Solo se listan aliases; los valores nunca se leen ni se muestran."
    >
      <form className="grid max-w-4xl gap-4 md:grid-cols-2" aria-labelledby="boveda-title" noValidate onSubmit={onSubmit}>
        <PlatformSettingsInput
          id="boveda-alias"
          name="alias"
          label="Alias"
          hint="Por ejemplo, provider:token. Hasta 81 caracteres."
          error={aliasValidation.error}
          value={alias}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => {
            setAlias(event.target.value);
            aliasValidation.clear(event.target.value);
          }}
          onBlur={() => aliasValidation.validate(alias)}
        />
        <PlatformSettingsInput
          id="boveda-value"
          name="value"
          type="password"
          label="Valor del secreto"
          hint="Se cifra antes de guardarse y no vuelve a mostrarse."
          error={valueValidation.error}
          value={secretValue}
          autoComplete="new-password"
          onChange={(event) => {
            setSecretValue(event.target.value);
            valueValidation.clear(event.target.value);
          }}
          onBlur={() => valueValidation.validate(secretValue)}
        />
        <div className="md:col-span-2">
          <PlatformSettingsFormActions
            pending={save.isPending}
            error={save.error ? friendlyError(save.error, "No se pudo guardar el secreto.") : undefined}
            submitLabel="Guardar secreto"
          />
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-slate-200">Secretos guardados</h3>
        {secretsPending && (
          <div className="flex flex-col gap-2" aria-label="Cargando secretos">
            <Skeleton />
            <Skeleton className="w-2/3" />
          </div>
        )}
        {hasLoadError && (
          <PlatformSettingsQueryError
            message={friendlyError(secretsError, "No se pudieron cargar los aliases.")}
            onRetry={onRetrySecrets}
          />
        )}
        {!secretsPending && !hasLoadError && secrets.length === 0 && (
          <p className={smallMuted}>Todavía no hay secretos globales. Guarda el primero con el formulario.</p>
        )}
        {secrets.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {secrets.map((secret) => (
              <li key={secret.alias} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <code className="break-all text-sm text-slate-200">{secret.alias}</code>
                <button
                  type="button"
                  className={buttonDanger}
                  title={`Eliminar ${secret.alias}`}
                  aria-label={`Eliminar ${secret.alias}`}
                  onClick={() => {
                    setAliasToDelete(secret.alias);
                  }}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {aliasToDelete && (
        <ConfirmDialog
          title="Eliminar secreto"
          confirmLabel="Eliminar secreto"
          pending={remove.isPending}
          onCancel={cancelDelete}
          onConfirm={() => remove.mutate(aliasToDelete)}
        >
          <p className="text-sm text-slate-200">
            Se eliminará <code>{aliasToDelete}</code> de la bóveda global. Las integraciones que lo usen dejarán de tener acceso.
          </p>
          {remove.error && (
            <p className={fieldError} role="alert">{friendlyError(remove.error, "No se pudo eliminar el secreto.")}</p>
          )}
        </ConfirmDialog>
      )}
    </PlatformSettingsSection>
  );
}
