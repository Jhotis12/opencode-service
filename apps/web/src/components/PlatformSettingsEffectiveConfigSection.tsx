import type { EffectiveConfig, EffectiveConfigSource, EffectiveSetting } from "@platform/shared";
import { badge, smallMuted } from "../ui.ts";
import { friendlyError } from "../ui.ts";
import { Skeleton } from "./Skeleton.tsx";
import { PlatformSettingsQueryError, PlatformSettingsSection } from "./PlatformSettingsFields.tsx";

const SOURCE_LABELS: Record<EffectiveConfigSource, string> = {
  entity: "Entidad",
  project: "Proyecto",
  platform: "Plataforma",
  environment: "Entorno",
  default: "Predeterminado",
};

function settingGroup(setting: EffectiveSetting): "models" | "telemetry" | "system" {
  if (setting.key === "defaultModel" || setting.key === "orchestratorModel") return "models";
  if (setting.key === "sentryDsn") return "telemetry";
  return "system";
}

function settingValue(setting: EffectiveSetting): string {
  if (setting.secret) return setting.value === undefined || setting.value === null ? "Sin definir" : "Configurado";
  return String(setting.value ?? "Sin definir");
}

export function PlatformSettingsEffectiveConfigSection({
  config,
  pending,
  error,
  onRetry,
}: {
  readonly config?: EffectiveConfig;
  readonly pending: boolean;
  readonly error?: unknown;
  readonly onRetry: () => void;
}) {
  const platform = config?.platform ?? [];
  const hasLoadError = error !== undefined && error !== null;
  const groups = [
    { id: "models", label: "Modelos", items: platform.filter((item) => settingGroup(item) === "models") },
    { id: "telemetry", label: "Telemetría", items: platform.filter((item) => settingGroup(item) === "telemetry") },
    { id: "system", label: "Sistema", items: platform.filter((item) => settingGroup(item) === "system") },
  ];

  return (
    <PlatformSettingsSection
      id="configuracion"
      title="Configuración efectiva"
      description="Valores resueltos por precedencia: entidad, proyecto, plataforma, entorno y valor predeterminado. Los secretos solo indican si están configurados."
    >
      {pending && (
        <div className="flex flex-col gap-3" aria-label="Cargando configuración efectiva">
          <Skeleton />
          <Skeleton />
          <Skeleton className="w-2/3" />
        </div>
      )}
      {hasLoadError && (
        <PlatformSettingsQueryError
          message={friendlyError(error, "No se pudo cargar la configuración efectiva.")}
          onRetry={onRetry}
        />
      )}
      {!pending && !hasLoadError && groups.every((group) => group.items.length === 0) && (
        <p className={smallMuted}>No hay configuración efectiva para mostrar.</p>
      )}
      {!pending && !hasLoadError && groups.filter((group) => group.items.length > 0).map((group) => (
        <div key={group.id} className="flex flex-col gap-2" aria-label={group.label}>
          <p className="text-xs font-semibold text-slate-300">{group.label}</p>
          <ul className="divide-y divide-line border-y border-line">
            {group.items.map((item) => (
              <li key={item.key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center">
                <strong className="text-sm font-medium text-slate-200">{item.label}</strong>
                <code className="break-all text-xs text-slate-300" title={item.secret ? undefined : settingValue(item)}>
                  {settingValue(item)}
                </code>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={badge}>{SOURCE_LABELS[item.source]}</span>
                  {!item.editable && <span className="text-xs text-muted">Solo lectura</span>}
                  {item.restartRequired && <span className="text-xs text-warn">Requiere reinicio</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </PlatformSettingsSection>
  );
}
