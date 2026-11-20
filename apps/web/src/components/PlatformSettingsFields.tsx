import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { PLATFORM_DEFAULT_MODEL } from "@platform/shared";
import type { ModelInfo } from "../api.ts";
import { button, buttonPrimary, card, fieldError, input, sectionTitle, smallMuted } from "../ui.ts";
import { Field } from "./Field.tsx";
import { Select } from "./Select.tsx";
import { modelOptions, type SelectOption } from "./select/options.ts";

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

export type PlatformSettingsModelInputProps = {
  readonly id: string;
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  /** The raw `proveedor/modelo#variante` value; an unlisted saved value is pinned by the picker. */
  readonly value: string;
  readonly models: readonly ModelInfo[];
  readonly emptyLabel: string;
  onChange(value: string): void;
};

/** Catalogue rows grouped by provider, the built-in suggestion when missing, and the empty row last. */
function platformModelOptions(models: readonly ModelInfo[], emptyLabel: string): readonly SelectOption[] {
  const discovered = modelOptions(models).map((option) => ({
    ...option,
    // A catalogue entry without a name still needs a readable row: fall back to its ref.
    label: option.label || option.value,
  }));
  const discoveredValues = new Set(discovered.map((option) => option.value));
  const suggestions = PLATFORM_MODEL_SUGGESTIONS
    .filter((suggestion) => !discoveredValues.has(suggestion.value))
    .map((suggestion) => ({ value: suggestion.value, label: suggestion.label }));
  return [...discovered, ...suggestions, { value: "", label: emptyLabel }];
}

export function PlatformSettingsModelInput({
  id,
  label,
  hint,
  error,
  value,
  models,
  emptyLabel,
  onChange,
}: PlatformSettingsModelInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <Select
        label={label}
        options={platformModelOptions(models, emptyLabel)}
        value={value}
        emptyValue=""
        searchable
        allowCustom
        placeholder="Selecciona un modelo"
        onChange={(next) => onChange(next ?? "")}
      />
    </Field>
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
    <section
      id={id}
      className={`${card} lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-4`}
      aria-labelledby={titleId}
    >
      <div className="flex max-w-prose flex-col gap-1">
        <h2 id={titleId} className={sectionTitle}>{title}</h2>
        <p className={smallMuted}>{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3 [&>form]:max-w-none">{children}</div>
    </section>
  );
}

export function PlatformSettingsFeedback({ status, error }: { readonly status?: string; readonly error?: string }) {
  return (
    <div className="min-h-5" aria-live="polite">
      {error ? <p className={fieldError}>{error}</p> : status ? <p className="text-sm text-ok">{status}</p> : null}
    </div>
  );
}

export function PlatformSettingsFormActions({
  pending,
  status,
  error,
  submitLabel = "Guardar cambios",
}: {
  readonly pending: boolean;
  readonly status?: string;
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
      <PlatformSettingsFeedback status={status} error={error} />
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
