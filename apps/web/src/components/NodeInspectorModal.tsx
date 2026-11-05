import { useMemo, useState } from "react";
import type { Edge, IntegrationRecord, NodeSpec, ProjectDestination, SubagentProfile, WorkflowGraph } from "@platform/shared";
import type { ModelInfo, StepRun } from "../api.ts";
import { Modal } from "./Modal.tsx";
import { NodeInspector } from "./NodeInspector.tsx";
import { NODE_META } from "./nodes/node-catalog.ts";
import { NodeIcon } from "./nodes/node-icons.tsx";
import { getConnectionIssue, nodeIssues, type GraphIssue } from "./canvas/graph-edits.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { badge, button, buttonDanger, buttonGhost, statusBadge } from "../ui.ts";

type InspectorTab = "settings" | "connections" | "execution";

function conditionLabel(condition?: string): string {
  return condition === "true" ? "sí" : condition === "false" ? "no" : "sin rama";
}

function edgeTargetLabel(graph: WorkflowGraph, edge: Edge): string {
  return graph.nodes.find((node) => node.id === edge.target)?.label ?? edge.target;
}

function edgeSourceLabel(graph: WorkflowGraph, edge: Edge): string {
  return graph.nodes.find((node) => node.id === edge.source)?.label ?? edge.source;
}

function ValuePreview({ value }: { value: unknown }) {
  if (value === undefined) return <span className="text-muted">—</span>;
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function defaultBranch(graph: WorkflowGraph, nodeId: string): "true" | "false" {
  const conditions = new Set(graph.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.condition));
  return conditions.has("true") ? "false" : "true";
}

export function NodeInspectorModal({
  node,
  graph,
  agents,
  models,
  integrations,
  destinations,
  lastStep,
  scheduleNextRun,
  code,
  codeDirty,
  issues,
  initialTab = "settings",
  onClose,
  onPatch,
  onConfig,
  onCodeChange,
  onSaveCode,
  onEnableDecisionCode,
  onRemove,
  onDuplicate,
  onConnect,
  onStartCanvasConnect,
  onChangeEdgeCondition,
  onDeleteEdge,
}: {
  node: NodeSpec;
  graph: WorkflowGraph;
  agents: SubagentProfile[];
  models: ModelInfo[];
  integrations: IntegrationRecord[];
  destinations: ProjectDestination[];
  lastStep?: StepRun;
  scheduleNextRun?: string;
  code: string;
  codeDirty: boolean;
  issues: GraphIssue[];
  initialTab?: InspectorTab;
  onClose(): void;
  onPatch(patch: Partial<NodeSpec>): void;
  onConfig(patch: Record<string, unknown>): void;
  onCodeChange(value: string): void;
  onSaveCode(): void;
  onEnableDecisionCode(): void;
  onRemove(): void;
  onDuplicate(): void;
  onConnect(sourceId: string, targetId: string, condition?: "true" | "false"): void;
  onStartCanvasConnect(sourceId: string, condition?: "true" | "false"): void;
  onChangeEdgeCondition(edgeId: string, condition: "true" | "false"): void;
  onDeleteEdge(edgeId: string): void;
}) {
  const meta = NODE_META[node.type];
  const [tab, setTab] = useState<InspectorTab>(initialTab);
  const [branch, setBranch] = useState<"true" | "false">(() => defaultBranch(graph, node.id));
  const [targetId, setTargetId] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const nodeIssueList = nodeIssues(issues, node.id);
  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
  const incoming = graph.edges.filter((edge) => edge.target === node.id);
  const condition = node.type === "decision" ? branch : undefined;

  const candidates = useMemo(
    () =>
      graph.nodes
        .filter((candidate) => candidate.id !== node.id)
        .map((candidate) => ({
          node: candidate,
          issue: getConnectionIssue(graph, node.id, candidate.id, condition),
        })),
    [condition, graph, node.id],
  );
  const validCount = candidates.filter((candidate) => !candidate.issue).length;
  const currentEdge = outgoing.find((edge) =>
    node.type === "decision" ? edge.condition === branch : true,
  );
  const replacing = Boolean(currentEdge && currentEdge.target !== targetId);

  function changeBranch(next: "true" | "false") {
    setBranch(next);
    setTargetId("");
    setConfirmReplace(false);
  }

  function submitConnection() {
    if (!targetId) return;
    if (replacing && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    onConnect(node.id, targetId, condition);
    setConfirmReplace(false);
  }

  const tabs: Array<[InspectorTab, string]> = [
    ["settings", "Ajustes"],
    ["connections", "Conexiones"],
    ["execution", "Ejecución"],
  ];

  return (
    <Modal
      title={`Nodo: ${node.label ?? meta.title}`}
      onClose={onClose}
      size="xl"
      actions={
        <>
          <button type="button" className={buttonGhost} onClick={onDuplicate}>
            Duplicar
          </button>
          <button type="button" className={buttonGhost} onClick={() => setTab("connections")}>
            Conexiones
          </button>
          <button type="button" className={buttonDanger} onClick={onRemove}>
            Eliminar
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${meta.color} 20%, var(--color-well))`, color: meta.color }}
        >
          <NodeIcon type={node.type} />
        </span>
        <span className={badge}>{meta.title}</span>
        <small className="truncate text-[11px] text-muted">{node.id}</small>
        {lastStep && <StatusBadge status={lastStep.status} />}
        {nodeIssueList.length > 0 && (
          <span className={statusBadge("paused")}>
            {nodeIssueList.length} {nodeIssueList.length === 1 ? "problema" : "problemas"}
          </span>
        )}
      </div>

      <div className="flex gap-1 border-b border-line pb-2" role="tablist" aria-label="Detalles del nodo">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`rounded-md border px-3 py-1.5 text-xs transition ${
              tab === key
                ? "border-line bg-panel-2 text-slate-100"
                : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <div role="tabpanel" className="flex flex-col gap-3">
          {nodeIssueList.length > 0 && (
            <ul className="flex list-inside list-disc flex-col gap-1 rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs text-warn">
              {nodeIssueList.map((issue) => (
                <li key={issue.id}>{issue.message}</li>
              ))}
            </ul>
          )}
          <NodeInspector
            node={node}
            nodes={graph.nodes}
            agents={agents}
            models={models}
            integrations={integrations}
            destinations={destinations}
            scheduleNextRun={scheduleNextRun}
            code={code}
            codeDirty={codeDirty}
            onPatch={onPatch}
            onConfig={onConfig}
            onCodeChange={onCodeChange}
            onSaveCode={onSaveCode}
            onEnableDecisionCode={onEnableDecisionCode}
          />
        </div>
      )}

      {tab === "connections" && (
        <div role="tabpanel" className="flex flex-col gap-4">
          {node.type === "decision" && (
            <div className="flex flex-col gap-1.5">
              <strong className="text-xs text-muted">Rama</strong>
              <div className="flex gap-1.5">
                {(["true", "false"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md border px-3 py-1.5 text-xs transition ${
                      branch === value
                        ? "border-line bg-panel-2 text-slate-100"
                        : "border-line text-muted hover:bg-panel"
                    }`}
                    onClick={() => changeBranch(value)}
                  >
                    {value === "true" ? "sí" : "no"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <strong className="text-xs uppercase tracking-wide text-muted">Agregar conexión</strong>
            <select
              aria-label="Nodo destino"
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
                setConfirmReplace(false);
              }}
            >
              <option value="">Selecciona un destino…</option>
              {candidates.map(({ node: candidate, issue }) => (
                <option key={candidate.id} value={candidate.id} disabled={Boolean(issue)}>
                  {candidate.label ?? candidate.id}
                  {issue ? ` — ${issue}` : ""}
                </option>
              ))}
            </select>
            {validCount === 0 && (
              <p className="text-xs text-muted">No hay destinos válidos para este nodo con la configuración actual.</p>
            )}
            {replacing && (
              <p className="text-xs text-warn">
                Esta conexión reemplazará la salida actual hacia {edgeTargetLabel(graph, currentEdge!)}.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={button}
                disabled={!targetId}
                onClick={submitConnection}
              >
                {confirmReplace ? "Confirmar reemplazo" : "Conectar"}
              </button>
              <button
                type="button"
                className={buttonGhost}
                onClick={() => {
                  onStartCanvasConnect(node.id, condition);
                }}
              >
                Conectar en el canvas
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <strong className="text-xs uppercase tracking-wide text-muted">Salidas ({outgoing.length})</strong>
            {outgoing.length === 0 && <p className="text-xs text-muted">Este nodo todavía no tiene salidas.</p>}
            {outgoing.map((edge) => (
              <div key={edge.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-well p-2">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                  → {edgeTargetLabel(graph, edge)}
                </span>
                {node.type === "decision" && (
                  <select
                    aria-label={`Rama hacia ${edgeTargetLabel(graph, edge)}`}
                    className="!w-auto !rounded-md !px-2 !py-1 !text-[11px]"
                    value={edge.condition ?? "true"}
                    onChange={(event) => onChangeEdgeCondition(edge.id, event.target.value as "true" | "false")}
                  >
                    <option value="true">sí</option>
                    <option value="false">no</option>
                  </select>
                )}
                <button
                  type="button"
                  className={buttonGhost}
                  aria-label={`Eliminar conexión hacia ${edgeTargetLabel(graph, edge)}`}
                  onClick={() => onDeleteEdge(edge.id)}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-2">
            <strong className="text-xs uppercase tracking-wide text-muted">Entradas ({incoming.length})</strong>
            {incoming.length === 0 && <p className="text-xs text-muted">Este nodo todavía no tiene entradas.</p>}
            {incoming.map((edge) => (
              <div key={edge.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-well p-2">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                  ← {edgeSourceLabel(graph, edge)}
                  {graph.nodes.find((source) => source.id === edge.source)?.type === "decision" &&
                    ` (${conditionLabel(edge.condition)})`}
                </span>
                <button
                  type="button"
                  className={buttonGhost}
                  aria-label={`Eliminar conexión desde ${edgeSourceLabel(graph, edge)}`}
                  onClick={() => onDeleteEdge(edge.id)}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "execution" && (
        <div role="tabpanel" className="flex flex-col gap-2">
          {lastStep ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={lastStep.status} />
                <span className={badge}>{lastStep.durationMs} ms</span>
                {lastStep.model && <span className={badge}>{lastStep.model}</span>}
                {lastStep.agentId && <span className={badge}>{lastStep.agentId}</span>}
              </div>
              {lastStep.error && <p className="text-xs text-danger">{lastStep.error}</p>}
              <details>
                <summary className="cursor-pointer text-xs text-muted">Entrada</summary>
                <ValuePreview value={lastStep.input} />
              </details>
              <details open>
                <summary className="cursor-pointer text-xs text-muted">Salida</summary>
                <ValuePreview value={lastStep.output} />
              </details>
              {lastStep.logs && lastStep.logs.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Logs ({lastStep.logs.length})</summary>
                  <ul className="mt-1 flex list-inside list-disc flex-col gap-1 text-xs text-muted">
                    {lastStep.logs.map((log, index) => (
                      <li key={index}>
                        <code>{log.message}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">Este nodo todavía no tiene una ejecución registrada.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
