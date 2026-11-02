import type { Store } from "../../application/ports/store.ts";
import type { WorkspacePort } from "../../application/ports/workspace.ts";
import type { ExecuteWorkflowRunUseCase } from "../../application/use-cases/execute-workflow.ts";
import type { WorkflowRunRecord } from "../entities.ts";
import type { Logger } from "../telemetry/index.ts";

const FIELD_RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week (0 and 7 are Sunday)
];

function parseFieldToken(token: string, min: number, max: number): Set<number> | undefined {
  const [rangePart, stepPart, extra] = token.split("/");
  if (!rangePart || extra !== undefined) return undefined;
  const step = stepPart === undefined ? 1 : Number(stepPart);
  if (!Number.isInteger(step) || step <= 0) return undefined;

  let start = min;
  let end = max;
  if (rangePart !== "*") {
    if (rangePart.includes("-")) {
      const [lo, hi, more] = rangePart.split("-");
      if (!lo || !hi || more !== undefined) return undefined;
      start = Number(lo);
      end = Number(hi);
    } else {
      start = Number(rangePart);
      end = stepPart === undefined ? start : max;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return undefined;
    }
  }

  const values = new Set<number>();
  for (let current = start; current <= end; current += step) {
    values.add(max === 7 && current === 7 ? 0 : current);
  }
  return values;
}

function parseCronField(field: string, min: number, max: number): Set<number> | undefined {
  const parts = field.split(",");
  if (parts.length === 0) return undefined;
  const result = new Set<number>();
  for (const part of parts) {
    if (!part) return undefined;
    const values = parseFieldToken(part, min, max);
    if (!values || values.size === 0) return undefined;
    for (const v of values) result.add(v);
  }
  return result;
}

export function isValidCronExpression(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, index) => {
    const [min, max] = FIELD_RANGES[index]!;
    return parseCronField(field, min, max) !== undefined;
  });
}

export function matchesCron(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const sets = fields.map((field, index) => {
    const [min, max] = FIELD_RANGES[index]!;
    return parseCronField(field, min, max);
  });
  if (sets.some((item) => !item)) return false;
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = sets as Array<Set<number>>;
  return (
    minutes.has(date.getUTCMinutes()) &&
    hours.has(date.getUTCHours()) &&
    daysOfMonth.has(date.getUTCDate()) &&
    months.has(date.getUTCMonth() + 1) &&
    daysOfWeek.has(date.getUTCDay())
  );
}

export function cronMinuteKey(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export class WorkflowScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly deps: {
      store: Store;
      workspace: WorkspacePort;
      executor: ExecuteWorkflowRunUseCase;
      logger: Logger;
      intervalMs?: number;
    },
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick().catch((error) => {
        this.deps.logger.error({
          event: "workflow_scheduler_failed",
          entryPoint: "scheduler",
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.deps.intervalMs ?? 30_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async tick(now = new Date()): Promise<WorkflowRunRecord[]> {
    const triggered: WorkflowRunRecord[] = [];
    const minuteKey = cronMinuteKey(now);
    const projects = await this.deps.workspace.listProjects();
    for (const slug of projects) {
      const graph = await this.deps.workspace.readWorkflow(slug).catch(() => undefined);
      if (!graph) continue;
      const trigger = graph.nodes.find((node) => node.type === "trigger");
      if (!trigger || trigger.config.kind !== "schedule") continue;
      const cron = typeof trigger.config.cron === "string" ? trigger.config.cron : "";
      if (!cron || !matchesCron(cron, now)) continue;
      const idempotencyKey = `schedule:${graph.id}:${trigger.id}:${minuteKey}`;
      try {
        const run = await this.deps.executor.start({
          projectSlug: slug,
          graph,
          payload: { scheduledAt: now.toISOString(), cron },
          entryPoint: "schedule",
          idempotencyKey,
          launchedBy: "scheduler",
          sourceDetail: `cron:${cron}`,
        });
        triggered.push(run);
      } catch (error) {
        this.deps.logger.warn({
          event: "workflow_schedule_skip",
          entryPoint: "scheduler",
          projectSlug: slug,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return triggered;
  }
}
