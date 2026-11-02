import { useMemo, useState, type CSSProperties } from "react";
import type { NodeType, WorkflowGraph } from "@platform/shared";
import { Modal } from "./Modal.tsx";
import { NODE_META, PALETTE_GROUPS } from "./nodes/node-catalog.ts";
import { NodeIcon } from "./nodes/node-icons.tsx";
import { nodeShapeStyle } from "./nodes/node-shapes.ts";

function ShapePreview({ type }: { type: NodeType }) {
  const meta = NODE_META[type];
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center"
      data-node-shape={type}
      style={{
        ...nodeShapeStyle(type),
        background: `color-mix(in srgb, ${meta.color} 24%, #0b1220)`,
        color: meta.color,
      }}
    >
      <NodeIcon type={type} />
    </span>
  );
}

export function NodePaletteModal({
  graph,
  onClose,
  onAdd,
}: {
  graph: WorkflowGraph;
  onClose(): void;
  onAdd(type: NodeType): void;
}) {
  const [search, setSearch] = useState("");
  const hasTrigger = graph.nodes.some((node) => node.type === "trigger");
  const term = search.trim().toLowerCase();

  const groups = useMemo(
    () =>
      PALETTE_GROUPS.map((group) => ({
        ...group,
        types: group.types.filter((type) => {
          if (!term) return true;
          const meta = NODE_META[type];
          return [meta.title, meta.category, meta.description].some((value) => value.toLowerCase().includes(term));
        }),
      })).filter((group) => group.types.length > 0),
    [term],
  );

  return (
    <Modal title="Agregar nodo" onClose={onClose} size="lg">
      <label>
        Buscar nodo
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, categoría o descripción…"
          aria-label="Buscar nodo"
          autoFocus
        />
      </label>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No hay nodos que coincidan con “{search}”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="text-[10px] uppercase tracking-wider text-muted">{group.label}</h3>
              <div className="flex flex-col gap-1.5">
                {group.types.map((type) => {
                  const meta = NODE_META[type];
                  const disabled = type === "trigger" && hasTrigger;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      title={disabled ? "Este flujo ya tiene un trigger." : undefined}
                      className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-[#0b1220] p-2.5 text-left text-slate-200 transition hover:border-[var(--node-color)] disabled:cursor-not-allowed disabled:opacity-45"
                      style={{ "--node-color": meta.color } as CSSProperties}
                      onClick={() => onAdd(type)}
                    >
                      <ShapePreview type={type} />
                      <span className="min-w-0">
                        <strong className="block text-xs">{meta.title}</strong>
                        <small className="block truncate text-[10px] text-muted">
                          {disabled ? "Este flujo ya tiene un trigger." : meta.description}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
