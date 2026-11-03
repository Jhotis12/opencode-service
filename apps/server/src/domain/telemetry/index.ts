import type { EntryPointType } from "@platform/shared";

export interface LogBindings {
  requestId?: string;
  runId?: string;
  entryPoint?: EntryPointType;
  [key: string]: unknown;
}

export interface Logger {
  debug(bindings: LogBindings, message?: string): void;
  info(bindings: LogBindings, message?: string): void;
  warn(bindings: LogBindings, message?: string): void;
  error(bindings: LogBindings, message?: string): void;
  child(bindings: LogBindings): Logger;
}

export interface ErrorTracker {
  captureException(error: unknown, context?: LogBindings): void;
  captureMessage(message: string, level: "warn" | "error", context?: LogBindings): void;
  enabled(): boolean;
}

export interface MetricsSnapshot {
  requests: number;
  errors: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface Metrics {
  recordRequest(route: string, status: number, durationMs: number): void;
  increment(
    name:
      | "workflow_runs"
      | "workflow_failures"
      | "workflow_runs_queued"
      | "workflow_runs_dispatched"
      | "channel_messages"
      | "worker_timeouts"
      | "chat_turns_started"
      | "chat_turns_succeeded"
      | "chat_turns_failed"
      | "chat_turns_timed_out"
      | "chat_turns_cancelled"
      | "chat_turns_recovered"
      | "chat_transport_retries",
  ): void;
  snapshot(): MetricsSnapshot;
}

export const SECRET_KEY_PATTERN =
  /pass(word)?|secret|token|api[-_]?key|authorization|cookie|credential|dsn|private[-_]?key/i;

/** Deep-redacts values whose key looks secret. Keeps output JSON-safe. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 4096 ? `${value.slice(0, 4096)}…` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redact(item, depth + 1);
  }
  return result;
}
