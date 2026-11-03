import type { NodeType } from "@platform/shared";

export const NODE_CATEGORY_COLORS = {
  input: "var(--color-node-input)",
  action: "var(--color-node-action)",
  logic: "var(--color-node-logic)",
  ai: "var(--color-node-ai)",
  human: "var(--color-node-human)",
} as const;

export const NODE_META: Record<NodeType, { title: string; color: string; category: string; description: string }> = {
  trigger: { title: "Trigger", color: NODE_CATEGORY_COLORS.input, category: "Entrada", description: "Entrada manual o por canal" },
  http: { title: "HTTP Request", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "Llama una API externa" },
  database: { title: "Base de datos", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "Consulta o escribe en una integración SQL" },
  notify: { title: "Notificar", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "Envía un mensaje por un canal del proyecto" },
  subworkflow: { title: "Subflujo", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "Ejecuta una versión inmutable de otro flujo" },
  foreach: { title: "Por cada", color: NODE_CATEGORY_COLORS.logic, category: "Lógica", description: "Ejecuta un subflujo por cada elemento" },
  code: { title: "Código", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "TypeScript en worker aislado" },
  transform: { title: "Transformar", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "Mapea o plantilla JSON" },
  delay: { title: "Esperar", color: NODE_CATEGORY_COLORS.action, category: "Acciones", description: "Pausa el flujo N milisegundos" },
  validate: { title: "Validar", color: NODE_CATEGORY_COLORS.logic, category: "Lógica", description: "Verifica campos requeridos" },
  agent: { title: "Agente", color: NODE_CATEGORY_COLORS.ai, category: "IA", description: "Sub-agente con modelo y Notebooks" },
  decision: { title: "Condición", color: NODE_CATEGORY_COLORS.logic, category: "Lógica", description: "Bifurca en sí / no" },
  approval: { title: "Aprobación", color: NODE_CATEGORY_COLORS.human, category: "Humano", description: "Pausa hasta aprobación humana" },
};

export const NODE_CATALOG: NodeType[] = ["http", "database", "notify", "subworkflow", "code", "transform", "delay", "validate", "foreach", "agent", "decision", "approval"];

export const PALETTE_GROUPS: ReadonlyArray<{ label: string; types: NodeType[] }> = [
  { label: "Entrada", types: ["trigger"] },
  { label: "Acciones", types: ["http", "database", "notify", "subworkflow", "code", "transform", "delay"] },
  { label: "IA", types: ["agent"] },
  { label: "Lógica", types: ["validate", "foreach", "decision"] },
  { label: "Humano", types: ["approval"] },
];
