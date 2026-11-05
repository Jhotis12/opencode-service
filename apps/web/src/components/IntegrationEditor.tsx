import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  INTEGRATION_CONFIG_REGISTRY,
  INTEGRATION_KIND_LABELS,
  type ConfigField,
  type IntegrationKind,
  type IntegrationRecord,
} from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { buttonGhost, buttonPrimary, card, friendlyError } from "../ui.ts";

export interface SavedIntegration {
  integration: IntegrationRecord;
  apiKey?: string;
  webhookSecret?: string;
}

type Scope = "project" | "global";

function getPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function setPath(value: Record<string, unknown>, path: string, next: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const clone = structuredClone(value);
  let current: Record<string, unknown> = clone;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1)!] = next;
  return clone;
}

function getFieldValue(config: Record<string, unknown>, key: string): unknown {
  if (key === "routing") return (config.routing as { mode?: unknown } | undefined)?.mode ?? "hybrid";
  if (key === "allowlist") return (config.routing as { allowlist?: unknown } | undefined)?.allowlist ?? [];
  if (key === "public") return Boolean((config.routing as { public?: unknown } | undefined)?.public);
  return getPath(config, key);
}

function setFieldValue(config: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const routing = { ...((config.routing as Record<string, unknown> | undefined) ?? {}) };
  if (key === "routing") return { ...config, routing: { ...routing, mode: value } };
  if (key === "allowlist") return { ...config, routing: { ...routing, allowlist: value } };
  if (key === "public") return { ...config, routing: { ...routing, public: value } };
  return setPath(config, key, value);
}

function visible(config: Record<string, unknown>, field: ConfigField): boolean {
  if (!field.visibleWhen) return true;
  const actual = getFieldValue(config, field.visibleWhen.key);
  if ("equals" in field.visibleWhen) return actual === field.visibleWhen.equals;
  if ("notEquals" in field.visibleWhen) return actual !== field.visibleWhen.notEquals;
  return true;
}

function toList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function labelForField(field: ConfigField): string {
  return field.label;
}

export function IntegrationEditor({
  scope,
  projectSlug,
  integration,
  defaultKind = "telegram",
  onSaved,
  onCancel,
}: {
  scope: Scope;
  projectSlug?: string;
  integration?: IntegrationRecord;
  defaultKind?: IntegrationKind;
  onSaved(result: SavedIntegration): void;
  onCancel?(): void;
}) {
  const queryClient = useQueryClient();
  const initialKind = integration?.kind ?? defaultKind;
  const initialDefinition = INTEGRATION_CONFIG_REGISTRY[initialKind];
  const [kind, setKind] = useState<IntegrationKind>(initialKind);
  const [name, setName] = useState(integration?.name ?? "");
  const [slug, setSlug] = useState(integration?.slug ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(() => ({
    ...structuredClone(initialDefinition.defaults),
    ...(integration?.config ?? {}),
  }));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(() => JSON.stringify(integration?.config ?? initialDefinition.defaults, null, 2));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [rawError, setRawError] = useState<string>();

  useEffect(() => {
    if (!integration) return;
    const definition = INTEGRATION_CONFIG_REGISTRY[integration.kind];
    setKind(integration.kind);
    setName(integration.name);
    setSlug(integration.slug);
    setConfig({ ...structuredClone(definition.defaults), ...integration.config });
    setSecrets({});
    setAdvanced(JSON.stringify(integration.config, null, 2));
    setError(undefined);
    setRawError(undefined);
  }, [integration?.id]);

  const destinationsQuery = useQuery({
    queryKey: qk.destinations(projectSlug ?? ""),
    queryFn: () => api.listDestinations(projectSlug!).then((result) => result.data),
    enabled: scope === "project" && Boolean(projectSlug),
  });
  const destinations = destinationsQuery.data ?? [];
  const definition = INTEGRATION_CONFIG_REGISTRY[kind];
  const groups = useMemo(
    () => [...new Set(definition.fields.map((field) => field.group ?? "General"))],
    [definition],
  );

  function chooseKind(next: IntegrationKind) {
    const nextDefinition = INTEGRATION_CONFIG_REGISTRY[next];
    setKind(next);
    setConfig(structuredClone(nextDefinition.defaults));
    setSecrets({});
    setAdvanced(JSON.stringify(nextDefinition.defaults, null, 2));
  }

  function setField(field: ConfigField, value: unknown) {
    setConfig((current) => setFieldValue(current, field.key, value));
  }

  function buildConfig(): Record<string, unknown> {
    let next = structuredClone(config);
    if (advancedOpen) {
      const parsed = JSON.parse(advanced) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("La configuración avanzada debe ser un objeto JSON.");
      }
      next = { ...(parsed as Record<string, unknown>), ...next };
    }
    if (next.imap && typeof next.imap === "object") {
      const imap = next.imap as Record<string, unknown>;
      if (!imap.host && !imap.port) delete next.imap;
    }
    if (kind === "whatsapp" && next.mode === "baileys") delete next.phoneNumberId;
    delete next.token;
    delete next.password;
    delete next.smtpPassword;
    delete next.imapPassword;
    delete next.apiKey;
    delete next.webhookSecret;
    return next;
  }

  const save = useMutation({
    mutationFn: async (): Promise<SavedIntegration> => {
      const finalConfig = buildConfig();
      const finalSecrets = Object.fromEntries(
        Object.entries(secrets)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => Boolean(value)),
      );
      if (integration) {
        const updated =
          scope === "project"
            ? await api.updateIntegration(projectSlug!, integration.id, {
                name,
                config: finalConfig,
                secrets: finalSecrets,
              })
            : await api.updateControlIntegration(integration.id, {
                name,
                config: finalConfig,
                secrets: finalSecrets,
              });
        return { integration: updated };
      }
      if (scope === "project") {
        return api.createIntegration(projectSlug!, {
          kind,
          name,
          slug,
          config: finalConfig,
          secrets: finalSecrets,
        });
      }
      return api.createControlIntegration({ kind, name, slug, config: finalConfig, secrets: finalSecrets });
    },
    onSuccess: async (result) => {
      setError(undefined);
      setRawError(undefined);
      await queryClient.invalidateQueries({
        queryKey: scope === "project" ? qk.integrations(projectSlug!) : qk.controlIntegrations,
      });
      onSaved(result);
    },
    onError: (cause) => {
      setRawError(cause instanceof Error ? cause.message : undefined);
      setError(friendlyError(cause, "No se pudo guardar la integración."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  function renderField(field: ConfigField) {
    if (!visible(config, field)) return null;
    const value = getFieldValue(config, field.key);
    const secret = field.secret || definition.secretFields.includes(field.key);
    const label = labelForField(field);
    const common = {
      "aria-label": label,
      placeholder: field.placeholder,
    };

    if (secret) {
      return (
        <label key={field.key}>
          {label}
          <input
            type="password"
            value={secrets[field.key] ?? ""}
            placeholder={integration ? "Dejar vacío para conservar" : field.placeholder}
            onChange={(event) => setSecrets((current) => ({ ...current, [field.key]: event.target.value }))}
          />
        </label>
      );
    }

    if (field.type === "boolean") {
      return (
        <label key={field.key} className="flex-row items-center gap-2">
          <input
            type="checkbox"
            className="w-auto"
            checked={value === true}
            onChange={(event) => setField(field, event.target.checked)}
          />
          {label}
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label key={field.key}>
          {label}
          <select value={String(value ?? "")} onChange={(event) => setField(field, event.target.value)}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "number") {
      return (
        <label key={field.key}>
          {label}
          <input
            type="number"
            value={value === undefined ? "" : Number(value)}
            onChange={(event) => setField(field, event.target.value === "" ? undefined : Number(event.target.value))}
          />
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <label key={field.key} className="md:col-span-2">
          {label}
          <textarea
            rows={3}
            value={String(value ?? "")}
            onChange={(event) => setField(field, event.target.value)}
          />
        </label>
      );
    }

    if (field.type === "json") {
      const raw = typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value, null, 2);
      return (
        <label key={field.key} className="md:col-span-2">
          {label}
          <textarea
            rows={3}
            value={raw}
            onChange={(event) => {
              const text = event.target.value;
              try {
                setField(field, text.trim() ? JSON.parse(text) : undefined);
              } catch {
                setField(field, text);
              }
            }}
          />
        </label>
      );
    }

    if (field.type === "custom") {
      if (field.widget === "destination-list") {
        const list = toList(value);
        return (
          <label key={field.key}>
            {label}
            <input
              {...common}
              value={list.join(", ")}
              onChange={(event) =>
                setField(
                  field,
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              list="integration-destinations"
            />
          </label>
        );
      }
      if (field.widget === "destination-picker") {
        return (
          <label key={field.key}>
            {label}
            <input
              {...common}
              value={String(value ?? "")}
              onChange={(event) => setField(field, event.target.value)}
              list="integration-destinations"
            />
          </label>
        );
      }
      if (field.widget === "alert-events") {
        const selected = toList(value);
        return (
          <div className="flex flex-col gap-1 md:col-span-2" key={field.key}>
            <strong className="text-xs text-muted">{label}</strong>
            <div className="flex flex-wrap gap-3">
              {["run.failed", "integration.down", "health.degraded"].map((event) => (
                <label key={event} className="flex-row items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-auto"
                    checked={selected.includes(event)}
                    onChange={(changeEvent) => {
                      const next = changeEvent.target.checked
                        ? [...selected, event]
                        : selected.filter((item) => item !== event);
                      setField(field, next);
                    }}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>
        );
      }
    }

    return (
      <label key={field.key}>
        {label}
        <input
          {...common}
          type={field.type === "password" ? "password" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
          value={String(value ?? "")}
          onChange={(event) => setField(field, event.target.value)}
        />
      </label>
    );
  }

  return (
    <form className={`${card} !grid gap-3 md:grid-cols-2`} onSubmit={submit} aria-label={integration ? "Editar integración" : "Crear integración"}>
      <h2 className="text-base font-semibold text-slate-100 md:col-span-2">
        {integration ? "Editar integración" : "Nueva integración"}
      </h2>
      {error && (
        <p className="text-sm text-danger md:col-span-2" role="alert" title={rawError}>
          {error}
        </p>
      )}
      {!integration && (
        <label>
          Tipo
          <select value={kind} onChange={(event) => chooseKind(event.target.value as IntegrationKind)}>
            {Object.entries(INTEGRATION_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Nombre
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bot de ventas" />
      </label>
      {!integration && (
        <label>
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="ventas-telegram" />
        </label>
      )}
      {groups.map((group) => (
        <fieldset className="md:col-span-2" key={group}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group}</legend>
          <div className="grid gap-3 md:grid-cols-2">{definition.fields.filter((field) => (field.group ?? "General") === group).map(renderField)}</div>
        </fieldset>
      ))}
      <datalist id="integration-destinations">
        {destinations.map((destination) => (
          <option key={destination.id} value={destination.id}>
            {destination.label} · {destination.value}
          </option>
        ))}
      </datalist>
      <details className="md:col-span-2" open={advancedOpen} onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-xs text-muted">Configuración avanzada</summary>
        <label className="mt-2">
          JSON adicional (sin secretos; los campos guiados tienen prioridad)
          <textarea rows={4} value={advanced} onChange={(event) => setAdvanced(event.target.value)} />
        </label>
      </details>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button className={buttonPrimary} disabled={save.isPending || !name || (!integration && !slug)}>
          {integration ? "Guardar cambios" : "Crear integración"}
        </button>
        {onCancel && (
          <button type="button" className={buttonGhost} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
