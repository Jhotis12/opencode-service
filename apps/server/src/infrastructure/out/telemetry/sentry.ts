import * as Sentry from "@sentry/bun";
import { redact, type ErrorTracker, type LogBindings } from "../../../domain/telemetry/index.ts";

/** Removes secrets and unbounded bodies from an event before it leaves the process. */
export function sanitizeSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const clone = structuredClone(event) as Record<string, unknown>;
  if (clone.request && typeof clone.request === "object") {
    const request = clone.request as Record<string, unknown>;
    if (request.headers) request.headers = redact(request.headers);
    if (request.data) request.data = "[REDACTED]";
    if (request.cookies) request.cookies = "[REDACTED]";
  }
  if (clone.extra) clone.extra = redact(clone.extra);
  if (clone.contexts) clone.contexts = redact(clone.contexts);
  if (clone.breadcrumbs) clone.breadcrumbs = redact(clone.breadcrumbs);
  return clone as T;
}

export class SentryErrorTracker implements ErrorTracker {
  private active = false;

  constructor(dsn: string | undefined, environment: string) {
    if (!dsn) return;
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        return sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
      },
    });
    this.active = true;
  }

  enabled(): boolean {
    return this.active;
  }

  captureException(error: unknown, context?: LogBindings): void {
    if (!this.active) return;
    Sentry.captureException(error, {
      tags: { entryPoint: context?.entryPoint, requestId: context?.requestId },
      extra: redact(context ?? {}) as Record<string, unknown>,
    });
  }

  captureMessage(message: string, level: "warn" | "error", context?: LogBindings): void {
    if (!this.active) return;
    Sentry.captureMessage(message, {
      level: level === "warn" ? "warning" : "error",
      tags: { entryPoint: context?.entryPoint },
      extra: redact(context ?? {}) as Record<string, unknown>,
    });
  }
}

export class NoopErrorTracker implements ErrorTracker {
  enabled(): boolean {
    return false;
  }
  captureException(): void {}
  captureMessage(): void {}
}
