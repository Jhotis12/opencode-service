import { Writable } from "node:stream";
import pino, { type Logger as PinoLogger } from "pino";
import { redact, type Logger, type LogBindings } from "../../../domain/telemetry/index.ts";

export interface LoggerOptions {
  level?: string;
  destination?: { write(chunk: string): void };
  base?: Record<string, unknown>;
}

class PinoLoggerAdapter implements Logger {
  constructor(private readonly logger: PinoLogger) {}

  private emit(level: "debug" | "info" | "warn" | "error", bindings: LogBindings, message?: string) {
    this.logger[level](redact(bindings) as Record<string, unknown>, message ?? (bindings.event as string) ?? "");
  }

  debug(bindings: LogBindings, message?: string): void {
    this.emit("debug", bindings, message);
  }
  info(bindings: LogBindings, message?: string): void {
    this.emit("info", bindings, message);
  }
  warn(bindings: LogBindings, message?: string): void {
    this.emit("warn", bindings, message);
  }
  error(bindings: LogBindings, message?: string): void {
    this.emit("error", bindings, message);
  }
  child(bindings: LogBindings): Logger {
    return new PinoLoggerAdapter(this.logger.child(redact(bindings) as Record<string, unknown>));
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const stream =
    options.destination instanceof Writable
      ? options.destination
      : options.destination
        ? new Writable({
            write(chunk, _encoding, callback) {
              options.destination!.write(String(chunk));
              callback();
            },
          })
        : undefined;
  const instance = stream
    ? pino({ level: options.level ?? "info", base: options.base ?? undefined, redact: { paths: [], censor: "[REDACTED]" } }, stream)
    : pino({ level: options.level ?? "info", base: options.base ?? undefined });
  return new PinoLoggerAdapter(instance);
}

export function createMemoryLogger(sink: string[]): Logger {
  return createLogger({ level: "debug", destination: { write: (chunk) => sink.push(chunk) } });
}
