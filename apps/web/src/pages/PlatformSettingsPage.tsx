import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { Breadcrumbs } from "../components/Breadcrumbs.tsx";
import { ControlChannelsPanel } from "../components/ControlChannelsPanel.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { PlatformSettingsEffectiveConfigSection } from "../components/PlatformSettingsEffectiveConfigSection.tsx";
import { PlatformSettingsModelSection, PlatformSettingsOrchestratorSection } from "../components/PlatformSettingsModelSections.tsx";
import { PlatformSettingsProviderSection } from "../components/PlatformSettingsProviderSection.tsx";
import { PlatformSettingsTelemetrySection } from "../components/PlatformSettingsTelemetrySection.tsx";
import { PlatformSettingsVaultSection } from "../components/PlatformSettingsVaultSection.tsx";
import { PlatformSettingsQueryError, PlatformSettingsSection } from "../components/PlatformSettingsFields.tsx";
import { useDocumentTitle } from "../useDocumentTitle.ts";
import { badge, buttonPrimary, card, friendlyError } from "../ui.ts";

const SECTION_IDS = ["modelo", "orquestador", "proveedores", "boveda", "telemetria", "proyectos", "canales", "configuracion"] as const;
type SectionId = typeof SECTION_IDS[number];

const SECTION_BY_HASH: Record<string, SectionId> = {
  "#modelo": "modelo",
  "#orquestador": "orquestador",
  "#proveedores": "proveedores",
  "#boveda": "boveda",
  "#telemetria": "telemetria",
  "#proyectos": "proyectos",
  "#canales": "canales",
  "#configuracion": "configuracion",
};

export function PlatformSettingsPage() {
  useDocumentTitle("Ajustes");
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = SECTION_BY_HASH[location.hash] ?? "modelo";
  const settingsQuery = useQuery({ queryKey: qk.settings, queryFn: () => api.getSettings().then((result) => result.data) });
  const effectiveQuery = useQuery({ queryKey: qk.effectiveConfig(), queryFn: () => api.getEffectiveConfig() });
  const secretsQuery = useQuery({ queryKey: qk.secrets, queryFn: () => api.listSecrets().then((result) => result.data) });
  const modelsQuery = useQuery({
    queryKey: qk.models,
    queryFn: () => api.listModels().then((result) => result.data),
    staleTime: 5 * 60_000,
  });

  const settings = settingsQuery.data;
  const models = modelsQuery.data ?? [];
  const modelQueryProps = {
    models,
    modelsPending: modelsQuery.isPending,
    modelsError: modelsQuery.error,
    onRetryModels: () => { void modelsQuery.refetch(); },
  };
  let content: ReactNode;

  if (!settings) {
    content = settingsQuery.error ? (
      <section className={card} aria-label="Error al cargar ajustes">
        <PlatformSettingsQueryError
          message={friendlyError(settingsQuery.error, "No se pudieron cargar los ajustes de plataforma.")}
          onRetry={() => { void settingsQuery.refetch(); }}
        />
      </section>
    ) : (
      <div className={card} aria-label="Cargando ajustes de plataforma">
        <Skeleton size="lg" className="w-1/3" />
        <Skeleton shape="block" size="sm" />
        <Skeleton />
        <Skeleton className="w-2/3" />
      </div>
    );
  } else {
    content = (
      <Tabs
        aria-label="Secciones de ajustes de plataforma"
        value={activeSection}
        onValueChange={(section) => navigate({ pathname: location.pathname, search: location.search, hash: section })}
        items={[
          {
            id: "modelo",
            label: "Modelo",
            content: <PlatformSettingsModelSection initialValue={settings.defaultModel} {...modelQueryProps} />,
          },
          {
            id: "orquestador",
            label: "Orquestador",
            content: <PlatformSettingsOrchestratorSection initialValue={settings.orchestratorModel} {...modelQueryProps} />,
          },
          {
            id: "proveedores",
            label: "Proveedores",
            content: <PlatformSettingsProviderSection connected={settings.providerConnected} {...modelQueryProps} />,
          },
          {
            id: "boveda",
            label: "Bóveda",
            content: (
              <PlatformSettingsVaultSection
                secrets={secretsQuery.data ?? []}
                secretsPending={secretsQuery.isPending}
                secretsError={secretsQuery.error}
                onRetrySecrets={() => { void secretsQuery.refetch(); }}
              />
            ),
          },
          {
            id: "telemetria",
            label: "Telemetría",
            content: <PlatformSettingsTelemetrySection configured={settings.sentryConfigured} />,
          },
          {
            id: "proyectos",
            label: "Proyectos",
            content: (
              <PlatformSettingsSection
                id="proyectos"
                title="Proyectos"
                description="Los canales, secretos, agentes y bancos de conocimiento de cada caso de uso se configuran dentro de su proyecto."
              >
                <Link className={`${buttonPrimary} self-start`} to="/projects">Abrir proyectos</Link>
              </PlatformSettingsSection>
            ),
          },
          {
            id: "canales",
            label: "Canales globales",
            content: (
              <PlatformSettingsSection
                id="canales"
                title="Canales globales"
                description="Gestiona los canales que usa el orquestador para consultar todos los proyectos y enviar alertas globales."
              >
                <ControlChannelsPanel />
              </PlatformSettingsSection>
            ),
          },
          {
            id: "configuracion",
            label: "Configuración efectiva",
            content: (
              <PlatformSettingsEffectiveConfigSection
                config={effectiveQuery.data}
                pending={effectiveQuery.isPending}
                error={effectiveQuery.error}
                onRetry={() => { void effectiveQuery.refetch(); }}
              />
            ),
          },
        ]}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ajustes de plataforma"
        description="Configura modelos, proveedores, secretos y canales globales. Cada sección tiene su propio enlace."
        breadcrumbs={<Breadcrumbs items={[{ label: "Proyectos", to: "/projects" }, { label: "Ajustes", to: "/settings" }]} />}
        actions={settings ? <span className={badge}>Modo OpenCode: {settings.opencodeMode}</span> : undefined}
      />
      {content}
      {settings && <p className="break-all text-xs text-muted">Datos persistentes: <code>{settings.dataDir}</code></p>}
    </div>
  );
}
