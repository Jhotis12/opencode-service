import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DestinationKind, ProjectDestination } from "@platform/shared";
import { api } from "../api.ts";
import { qk } from "../query.ts";
import { badge, button, buttonDanger, buttonGhost, card, friendlyError, notify } from "../ui.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Field } from "./Field.tsx";

const KINDS: Array<{ value: DestinationKind; label: string }> = [
  { value: "telegram_chat", label: "Chat de Telegram" },
  { value: "whatsapp", label: "Chat de WhatsApp" },
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook" },
  { value: "custom", label: "Otro" },
];

export function ProjectDestinationsPanel({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.destinations(projectSlug),
    queryFn: () => api.listDestinations(projectSlug).then((result) => result.data),
  });
  const [kind, setKind] = useState<DestinationKind>("telegram_chat");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [labelError, setLabelError] = useState<string>();
  const [valueError, setValueError] = useState<string>();
  const [editing, setEditing] = useState<ProjectDestination>();
  const [pendingDelete, setPendingDelete] = useState<ProjectDestination>();
  const [error, setError] = useState<string>();
  const destinations = query.data ?? [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: qk.destinations(projectSlug) });
  }

  const create = useMutation({
    mutationFn: (input: { kind: DestinationKind; label: string; value: string }) =>
      api.createDestination(projectSlug, input),
    onSuccess: async () => {
      setLabel("");
      setValue("");
      notify.success("Destino creado");
      setError(undefined);
      await refresh();
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo crear el destino.")),
  });

  const update = useMutation({
    mutationFn: () =>
      api.updateDestination(projectSlug, editing!.id, {
        kind: editing!.kind,
        label: editing!.label,
        value: editing!.value,
      }),
    onSuccess: async () => {
      setEditing(undefined);
      notify.success("Destino actualizado");
      setError(undefined);
      await refresh();
    },
    onError: (cause) => setError(friendlyError(cause, "No se pudo actualizar el destino.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDestination(projectSlug, id),
    onSuccess: async () => {
      setPendingDelete(undefined);
      notify.success("Destino eliminado");
      setError(undefined);
      await refresh();
    },
    onError: (cause) => {
      setPendingDelete(undefined);
      setError(friendlyError(cause, "No se pudo eliminar el destino; revisa las referencias."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextLabel = label.trim();
    const nextValue = value.trim();
    setLabelError(nextLabel ? undefined : "La etiqueta es obligatoria.");
    setValueError(nextValue ? undefined : "El valor es obligatorio.");
    if (!nextLabel || !nextValue) {
      return;
    }
    create.mutate({ kind, label: nextLabel, value: nextValue });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Los destinos etiquetados se reutilizan en allowlists, alertas, aprobaciones y nodos Notificar. También puedes seguir
        usando un chat ID o email crudo; adoptar un valor existente no rompe las referencias actuales.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <form className={`${card} !grid gap-3 md:grid-cols-3`} onSubmit={submit} aria-label="Crear destino" noValidate>
        <label>
          Tipo
          <select value={kind} onChange={(event) => setKind(event.target.value as DestinationKind)}>
            {KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Field id="destination-label" label="Etiqueta" error={labelError}>
          <input
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              if (labelError) setLabelError(undefined);
            }}
            placeholder="Admin de ventas"
          />
        </Field>
        <Field id="destination-value" label="Valor" error={valueError}>
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (valueError) setValueError(undefined);
            }}
            placeholder="123456789"
          />
        </Field>
        <button className={`${button} md:col-span-3`} disabled={create.isPending}>
          Crear destino
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {destinations.map((destination) => (
          <article className="flex flex-col gap-2 rounded-lg border border-line bg-well p-3" key={destination.id}>
            {editing?.id === destination.id ? (
              <div className="grid gap-2 md:grid-cols-3">
                <label>
                  Tipo
                  <select
                    value={editing.kind}
                    onChange={(event) => setEditing({ ...editing, kind: event.target.value as DestinationKind })}
                  >
                    {KINDS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Etiqueta
                  <input value={editing.label} onChange={(event) => setEditing({ ...editing, label: event.target.value })} />
                </label>
                <label>
                  Valor
                  <input value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} />
                </label>
                <div className="flex gap-2 md:col-span-3">
                  <button className={button} disabled={update.isPending} onClick={() => update.mutate()}>
                    Guardar destino
                  </button>
                  <button className={buttonGhost} onClick={() => setEditing(undefined)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-sm">{destination.label}</strong> <span className={badge}>{destination.kind}</span>
                  <small className="block break-all text-xs text-muted">{destination.value}</small>
                </span>
                <span className="flex gap-1.5">
                  <button className={buttonGhost} onClick={() => setEditing(destination)}>
                    Editar
                  </button>
                  <button
                    className={buttonDanger}
                    aria-label={`Borrar el destino ${destination.label}`}
                    onClick={() => setPendingDelete(destination)}
                  >
                    Borrar
                  </button>
                </span>
              </div>
            )}
          </article>
        ))}
        {destinations.length === 0 && <p className="text-sm text-muted">Aún no hay destinos etiquetados en este proyecto.</p>}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar destino"
          confirmLabel="Eliminar"
          pending={remove.isPending}
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => remove.mutate(pendingDelete.id)}
        >
          <p className="text-sm text-muted">
            Se eliminará el destino <strong>{pendingDelete.label}</strong> ({pendingDelete.value}). Las allowlists y nodos
            que lo usan dejarán de resolverlo.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
