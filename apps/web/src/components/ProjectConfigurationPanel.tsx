import { useState } from "react";
import { ProjectDestinationsPanel } from "./ProjectDestinationsPanel.tsx";
import { ProjectResourcesPanel } from "./ProjectResourcesPanel.tsx";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel.tsx";

type ConfigurationSection = "general" | "connections" | "channels" | "destinations" | "secrets" | "readiness";

const SECTIONS: Array<[ConfigurationSection, string]> = [
  ["general", "General"],
  ["connections", "Conexiones"],
  ["channels", "Canales"],
  ["destinations", "Destinos"],
  ["secrets", "Secretos"],
  ["readiness", "Preparación"],
];

export function ProjectConfigurationPanel({ projectSlug }: { projectSlug: string }) {
  const [section, setSection] = useState<ConfigurationSection>("general");
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-line bg-well p-1" aria-label="Secciones de configuración">
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              section === key ? "bg-panel-2 text-slate-100" : "text-muted hover:bg-panel hover:text-slate-200"
            }`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {section === "general" && <ProjectSettingsPanel projectSlug={projectSlug} section="general" />}
      {section === "connections" && <ProjectResourcesPanel projectSlug={projectSlug} section="connections" />}
      {section === "channels" && <ProjectResourcesPanel projectSlug={projectSlug} section="channels" />}
      {section === "destinations" && <ProjectDestinationsPanel projectSlug={projectSlug} />}
      {section === "secrets" && <ProjectResourcesPanel projectSlug={projectSlug} section="secrets" />}
      {section === "readiness" && <ProjectSettingsPanel projectSlug={projectSlug} section="readiness" />}
    </div>
  );
}
