import type { ChatProgressEvent } from "@platform/shared";

interface RawAgentEvent {
  type?: string;
  data?: Record<string, unknown>;
}

function normalizeToolName(name?: string): string | undefined {
  if (!name) return undefined;
  return name.replace(/^platform[._]/, "");
}

function filePathFromInput(record: Record<string, unknown>): string | undefined {
  for (const key of ["filePath", "path", "file"]) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function commandText(command: string): string {
  const lower = command.toLowerCase();
  if (/\b(vitest|jest)\b/.test(lower) || /\b(bun|npm|pnpm|yarn)\s+(run\s+)?test\b/.test(lower)) {
    return "Ejecutando pruebas";
  }
  if (/\b(tsc|typecheck)\b/.test(lower)) return "Verificando tipos";
  if (/\b(eslint|biome|lint)\b/.test(lower)) return "Revisando estilo";
  if (/\b(curl|wget|http)\b/.test(lower)) return "Consultando un servicio";
  if (/\b(node|bun|deno)\b/.test(lower)) return "Ejecutando código";
  return "Ejecutando un comando";
}

function fileEditText(file: string): string | undefined {
  const normalized = file.replace(/\\/g, "/");
  const base = normalized.split("/").pop() ?? normalized;
  if (base === "workflow.json") return "Actualizando el flujo";
  if (normalized.startsWith("nodes/") || normalized.includes("/nodes/")) {
    return `Actualizando el nodo ${base}`;
  }
  if (normalized.includes("/.opencode/agents/")) return "Actualizando un agente";
  if (base === "AGENTS.md") return "Actualizando las instrucciones del proyecto";
  return undefined;
}

function fileReadText(file: string): string | undefined {
  const normalized = file.replace(/\\/g, "/");
  const base = normalized.split("/").pop() ?? normalized;
  if (base === "workflow.json") return "Revisando el flujo";
  if (normalized.startsWith("nodes/") || normalized.includes("/nodes/")) {
    return `Revisando el nodo ${base}`;
  }
  if (normalized.includes("/.opencode/agents/")) return "Revisando un agente";
  if (base === "AGENTS.md") return "Revisando las instrucciones del proyecto";
  return undefined;
}

function toolText(name?: string, input?: unknown): string {
  const normalizedName = normalizeToolName(name);
  const record = (input ?? {}) as Record<string, unknown>;
  switch (normalizedName) {
    case "workflow_upsert": {
      const graph = record.graph as { nodes?: Array<{ label?: string }> } | undefined;
      const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
      const labels = nodes
        .map((node) => node.label)
        .filter((label): label is string => Boolean(label))
        .slice(0, 3);
      if (nodes.length > 0) {
        return `Actualizando el flujo (${nodes.length} nodos${labels.length ? `: ${labels.join(", ")}` : ""})`;
      }
      return "Actualizando el flujo";
    }
    case "workflow_trigger":
      return "Ejecutando el flujo";
    case "workflow_runs":
      return "Consultando ejecuciones";
    case "workflow_get":
    case "workflow_list":
      return "Revisando el flujo";
    case "subagent_upsert": {
      const category = typeof record.category === "string" ? record.category : "";
      const role = typeof record.role === "string" ? record.role : "";
      return category && role ? `Actualizando el sub-agente ${category}/${role}` : "Actualizando un sub-agente";
    }
    case "subagent_list":
      return "Revisando agentes";
    case "kb_search":
      return "Buscando conocimiento";
    case "db_query":
      return "Consultando la base de datos";
    case "notify":
      return "Enviando una notificación";
    case "health_summary":
      return "Revisando la salud de la plataforma";
    case "project_overview":
      return "Revisando proyectos y ejecuciones";
    case "write":
    case "edit":
    case "patch": {
      const file = filePathFromInput(record);
      const text = file ? fileEditText(file) : undefined;
      return text ?? "Editando archivos del proyecto";
    }
    case "read": {
      const file = filePathFromInput(record);
      const text = file ? fileReadText(file) : undefined;
      return text ?? "Leyendo archivos del proyecto";
    }
    case "bash":
    case "shell": {
      const command = typeof record.command === "string" ? record.command : "";
      return command ? commandText(command) : "Ejecutando una comprobación";
    }
    case "task":
      return "Delegando una tarea";
    default:
      return "Trabajando en el proyecto";
  }
}

export function createChatProgressHandler(onProgress: (event: ChatProgressEvent) => void) {
  const tools = new Map<string, { name?: string; text: string }>();
  let lastActivity = { text: "", at: 0 };

  function emitActivity(event: ChatProgressEvent & { type: "activity" }) {
    const now = Date.now();
    if (event.status !== "succeeded" && event.text === lastActivity.text && now - lastActivity.at < 1200) return;
    lastActivity = { text: event.text, at: now };
    onProgress(event);
  }

  return (raw: unknown, sessionId: string): void => {
    const event = raw as RawAgentEvent;
    const data = (event.data ?? raw) as Record<string, unknown>;
    if (!event.type || data.sessionID !== sessionId) return;

    if (event.type === "session.text.delta") {
      const delta =
        typeof data.delta === "string"
          ? data.delta
          : typeof data.text === "string"
            ? data.text
            : undefined;
      if (delta) onProgress({ type: "text", text: delta });
      return;
    }

    if (event.type === "session.tool.input.started") {
      const id = typeof data.id === "string" ? data.id : "";
      const name = typeof data.name === "string" ? data.name : undefined;
      if (!id) return;
      const text = toolText(name);
      tools.set(id, { name, text });
      emitActivity({ type: "activity", id: `tool:${id}`, text, status: "started" });
      return;
    }

    if (event.type === "session.tool.called") {
      const id = typeof data.id === "string" ? data.id : "";
      if (!id) return;
      const stored = tools.get(id);
      const name = stored?.name ?? (typeof data.name === "string" ? data.name : undefined);
      const text = toolText(name, data.input);
      tools.set(id, { name, text });
      emitActivity({ type: "activity", id: `tool:${id}`, text, status: "started" });
      return;
    }

    if (event.type === "session.tool.success" || event.type === "session.tool.failed") {
      const id = typeof data.id === "string" ? data.id : "";
      if (!id) return;
      const stored = tools.get(id);
      emitActivity({
        type: "activity",
        id: `tool:${id}`,
        text: stored?.text ?? "Herramienta completada",
        status: event.type === "session.tool.success" ? "succeeded" : "failed",
      });
      tools.delete(id);
      return;
    }

    if (event.type === "filesystem.changed" && typeof data.file === "string") {
      const text = fileEditText(data.file);
      if (!text) return;
      emitActivity({ type: "activity", id: `file:${data.file}`, text, status: "succeeded" });
    }
  };
}
