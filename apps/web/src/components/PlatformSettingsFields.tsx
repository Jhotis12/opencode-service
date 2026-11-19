import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { PLATFORM_DEFAULT_MODEL } from "@platform/shared";
import type { ModelInfo } from "../api.ts";
import { button, buttonPrimary, card, fieldError, input, sectionTitle, smallMuted } from "../ui.ts";
import { Field } from "./Field.tsx";

export type PlatformFieldValidator = (value: string) => string | undefined;

export function usePlatformFieldValidation(validator: PlatformFieldValidator) {
  const [error, setError] = useState<string>();

  return {
    error,
    validate(value: string) {
      const nextError = validator(value);
      setError(nextError);
      return nextError;
    },
    clear(value: string) {
      if (error && !validator(value)) setError(undefined);
    },
  };
}

export function validatePlatformModel(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const valid = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*(#[a-zA-Z0-9._-]+)?$/.test(normalized);
  return valid ? undefined : "Usa el formato proveedor/modelo#variante. La variante es opcional.";
}

export function validatePlatformSecretAlias(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "Introduce un alias para identificar el secreto.";
  return /^[a-z][a-z0-9:_-]{1,80}$/i.test(normalized)
    ? undefined
    : "Empieza por una letra y usa solo letras, números, dos puntos, guiones o guiones bajos.";
}

export function validatePlatformSecret(value: string): string | undefined {
  return value.trim() ? undefined : "Introduce el valor del secreto.";
}

export function validatePlatformSentryDsn(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "Introduce el DSN de Sentry o GlitchTip.";
  if (!URL.canParse(normalized)) return "Introduce una URL válida, por ejemplo https://clave@sentry.io/proyecto.";
  const protocol = new URL(normalized).protocol;
  return protocol === "https:" || protocol === "http:"
    ? undefined
    : "El DSN debe usar una URL http o https.";
}

type PlatformSettingsInputProps = InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string;
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
};

export function PlatformSettingsInput({ label, hint, error, ...inputProps }: PlatformSettingsInputProps) {
  return (
    <Field id={inputProps.id} label={label} hint={hint} error={error}>
      <input {...inputProps} className={input} />
    </Field>
  );
}

export const PLATFORM_MODEL_SUGGESTIONS = [
  { value: PLATFORM_DEFAULT_MODEL, label: "DeepSeek V4.1 Flash" },
] as const;

export function PlatformSettingsModelInput({ models, ...props }: PlatformSettingsInputProps & { readonly models: readonly ModelInfo[] }) {
  const listId = `${props.id}-options`;
  const discovered = models.map((model) => ({ value: `${model.providerID}/${model.modelID}`, label: model.name }));
  const discoveredValues = new Set(discovered.map((option) => option.value));
  const options = [
    ...discovered,
    ...PLATFORM_MODEL_SUGGESTIONS.filter((suggestion) => !discoveredValues.has(suggestion.value)),
  ];
  return (
    <>
      <PlatformSettingsInput {...props} list={listId} autoComplete="off" autoCapitalize="none" spellCheck={false} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </datalist>
    </>
  );
}

export function PlatformSettingsSection({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section id={id} className={card} aria-labelledby={titleId}>
      <div className="flex max-w-3xl flex-col gap-1">
        <h2 id={titleId} className={sectionTitle}>{title}</h2>
        <p className={smallMuted}>{description}</p>
      </div>
      {children}
    </section>
  );
}

export function PlatformSettingsFeedback({ error }: { readonly error?: string }) {
  return (
    <div className="min-h-5">
      {error ? <p className={fieldError}>{error}</p> : null}
    </div>
  );
}

export function PlatformSettingsFormActions({
  pending,
  error,
  submitLabel = "Guardar cambios",
}: {
  readonly pending: boolean;
  readonly error?: string;
  readonly submitLabel?: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonPrimary} disabled={pending} aria-busy={pending}>
          {submitLabel}
        </button>
        {pending && <span className={smallMuted}>Guardando…</span>}
      </div>
      <PlatformSettingsFeedback error={error} />
    </>
  );
}

export function PlatformSettingsQueryError({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className={fieldError}>{message}</p>
      <button type="button" className={button} onClick={onRetry}>Reintentar</button>
    </div>
  );
}
