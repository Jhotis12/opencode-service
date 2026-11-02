import type { NodeType } from "@platform/shared";

export const NODE_META: Record<NodeType, { title: string; color: string; category: string; description: string }> = {
  trigger: { title: "Trigger", color: "#f59e0b", category: "Entrada", description: "Entrada manual o por canal" },
  http: { title: "HTTP Request", color: "#22d3ee", category: "Acciones", description: "Llama una API externa" },
  code: { title: "Código", color: "#38bdf8", category: "Acciones", description: "TypeScript en worker aislado" },
  transform: { title: "Transformar", color: "#f472b6", category: "Acciones", description: "Mapea o plantilla JSON" },
  delay: { title: "Esperar", color: "#fbbf24", category: "Acciones", description: "Pausa el flujo N milisegundos" },
  validate: { title: "Validar", color: "#2dd4bf", category: "Lógica", description: "Verifica campos requeridos" },
  agent: { title: "Agente", color: "#a78bfa", category: "IA", description: "Sub-agente con modelo y Notebooks" },
  decision: { title: "Condición", color: "#34d399", category: "Lógica", description: "Bifurca en sí / no" },
  approval: { title: "Aprobación", color: "#fb7185", category: "Humano", description: "Pausa hasta aprobación humana" },
};

export const NODE_CATALOG: NodeType[] = ["http", "code", "transform", "delay", "validate", "agent", "decision", "approval"];

export const PALETTE_GROUPS: ReadonlyArray<{ label: string; types: NodeType[] }> = [
  { label: "Entrada", types: ["trigger"] },
  { label: "Acciones", types: ["http", "code", "transform", "delay"] },
  { label: "IA", types: ["agent"] },
  { label: "Lógica", types: ["validate", "decision"] },
  { label: "Humano", types: ["approval"] },
];
