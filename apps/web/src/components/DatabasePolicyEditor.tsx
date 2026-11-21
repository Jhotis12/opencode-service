import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { IntegrationRecord } from "@platform/shared";
import { api } from "../api.ts";
import { Select } from "./Select.tsx";
import type { SelectOption } from "./select/options.ts";
import { buttonGhost, friendlyError } from "../ui.ts";
import { notifyError, notifySuccess } from "./Toast.tsx";

const ACCESS_OPTIONS: readonly SelectOption[] = [
  { value: "read", label: "Solo lectura" },
  { value: "write", label: "Lectura y escritura" },
];

export function DatabasePolicyEditor({
  projectSlug,
  integration,
  onSaved,
}: {
  projectSlug: string;
  integration: IntegrationRecord;
  onSaved(): void;
}) {
  const [access, setAccess] = useState<"read" | "write">(
    integration.config.access === "read" ? "read" : "write",
  );
  const [maxRows, setMaxRows] = useState(Number(integration.config.maxRows ?? 1_000));
  const [allowDdl, setAllowDdl] = useState(integration.config.allowDdl === true);
  const save = useMutation({
    mutationFn: () =>
      api.updateIntegration(projectSlug, integration.id, {
        config: { ...integration.config, access, maxRows, allowDdl },
      }),
    onSuccess: () => {
      notifySuccess("Política de base de datos guardada");
      onSaved();
    },
    onError: (cause) =>
      notifyError(friendlyError(cause, "No se pudo guardar la política de base de datos.")),
  });
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-well p-2">
      <strong className="text-xs text-slate-200">Política de base de datos</strong>
      <Select
        label="Acceso"
        options={ACCESS_OPTIONS}
        value={access}
        emptyValue=""
        onChange={(next) => {
          if (next === "read" || next === "write") setAccess(next);
        }}
      />
      <label className="text-[11px] text-muted">
        Máximo de filas
        <input
          type="number"
          min={1}
          max={10000}
          value={maxRows}
          onChange={(event) => setMaxRows(Number(event.target.value))}
        />
      </label>
      <label className="flex-row items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" className="w-auto" checked={allowDdl} onChange={(event) => setAllowDdl(event.target.checked)} />
        Permitir DDL
      </label>
      <button className={buttonGhost} disabled={save.isPending} onClick={() => save.mutate()}>
        Guardar política
      </button>
    </div>
  );
}
