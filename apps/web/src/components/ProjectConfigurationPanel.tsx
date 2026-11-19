import type { MouseEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { tab, tabActive, tabList } from "../ui.ts";
import { ProjectDestinationsPanel } from "./ProjectDestinationsPanel.tsx";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel.tsx";

const SECTIONS = [
  ["general", "General"],
  ["destinations", "Destinos"],
  ["secrets", "Secretos"],
  ["readiness", "Preparación"],
] as const;

type ConfigurationSection = (typeof SECTIONS)[number][0];

const DEFAULT_SECTION: ConfigurationSection = "general";

function isSection(value: string | null): value is ConfigurationSection {
  return SECTIONS.some(([key]) => key === value);
}

export function ProjectConfigurationPanel({
  projectSlug,
  navigationBlocked = false,
  onNavigateBlocked,
}: {
  projectSlug: string;
  navigationBlocked?: boolean;
  onNavigateBlocked?(target: string): void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section: ConfigurationSection = isSection(requested) ? requested : DEFAULT_SECTION;
  const integrationsPath = `/projects/${projectSlug}/integrations`;

  function selectSection(next: ConfigurationSection) {
    const params = new URLSearchParams(searchParams);
    if (next === DEFAULT_SECTION) params.delete("section");
    else params.set("section", next);
    setSearchParams(params, { replace: true });
  }

  function guardNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (!navigationBlocked) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigateBlocked?.(integrationsPath);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className={tabList} role="tablist" aria-label="Secciones de configuración">
          {SECTIONS.map(([key, label]) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${tab} ${active ? tabActive : ""}`.trim()}
                onClick={() => selectSection(key)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Las conexiones, canales y bases de datos se gestionan en{" "}
          <Link className="text-accent hover:underline" to={integrationsPath} onClick={guardNavigation}>
            Integraciones
          </Link>
          .
        </p>
      </div>

      <section role="tabpanel" aria-label={SECTIONS.find(([key]) => key === section)?.[1]} className="min-w-0">
        {section === "general" && <ProjectSettingsPanel projectSlug={projectSlug} section="general" />}
        {section === "destinations" && <ProjectDestinationsPanel projectSlug={projectSlug} />}
        {section === "secrets" && <ProjectSettingsPanel projectSlug={projectSlug} section="secrets" />}
        {section === "readiness" && <ProjectSettingsPanel projectSlug={projectSlug} section="readiness" />}
      </section>
    </div>
  );
}
