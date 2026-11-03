import type { Store } from "../../application/ports/store.ts";
import type { WorkspacePort } from "../../application/ports/workspace.ts";
import type { ExecuteWorkflowRunUseCase } from "../../application/use-cases/execute-workflow.ts";
import type { WorkflowRunRecord } from "../entities.ts";
import type { Logger } from "../telemetry/index.ts";
import { TriggerConfigSchema, type NodeSpec, type WorkflowGraph } from "@platform/shared";

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
  const sets = parseCron(expression);
  if (!sets) return false;
  return matchesParts(sets, {
    minute: date.getUTCMinutes(),
    hour: date.getUTCHours(),
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    weekday: date.getUTCDay(),
  });
}

function parseCron(expression: string): Array<Set<number>> | undefined {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return undefined;
  const sets = fields.map((field, index) => {
    const [min, max] = FIELD_RANGES[index]!;
    return parseCronField(field, min, max);
  });
  if (sets.some((item) => !item)) return undefined;
  return sets as Array<Set<number>>;
}

function matchesParts(
  sets: Array<Set<number>>,
  parts: { minute: number; hour: number; day: number; month: number; weekday: number },
): boolean {
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = sets;
  return (
    minutes!.has(parts.minute) &&
    hours!.has(parts.hour) &&
    daysOfMonth!.has(parts.day) &&
    months!.has(parts.month) &&
    daysOfWeek!.has(parts.weekday)
  );
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function zonedParts(date: Date, timeZone: string): {
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
  year: string;
} {
  const parts = zonedFormatter(timeZone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    minute: Number(value("minute")),
    hour: Number(value("hour")),
    day: Number(value("day")),
    month: Number(value("month")),
    weekday: WEEKDAYS[value("weekday")] ?? 0,
    year: value("year"),
  };
}

export function matchesCronInTimeZone(expression: string, date: Date, timeZone: string): boolean {
  const sets = parseCron(expression);
  if (!sets) return false;
  try {
    return matchesParts(sets, zonedParts(date, timeZone));
  } catch {
    return false;
  }
}

export function zonedMinuteKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(
    parts.hour,
  ).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function cronWindowsBetween(
  expression: string,
  from: Date,
  to: Date,
  timeZone: string,
  limit = 1_000,
): Date[] {
  if (to.getTime() < from.getTime()) return [];
  const start = Math.ceil(from.getTime() / 60_000) * 60_000;
  const end = Math.floor(to.getTime() / 60_000) * 60_000;
  const windows: Date[] = [];
  const seen = new Set<string>();
  for (let timestamp = start; timestamp <= end; timestamp += 60_000) {
    const date = new Date(timestamp);
    if (!matchesCronInTimeZone(expression, date, timeZone)) continue;
    const key = zonedMinuteKey(date, timeZone);
    if (seen.has(key)) continue;
    seen.add(key);
    windows.push(date);
    if (windows.length >= limit) break;
  }
  return windows;
}

export function nextCronDate(
  expression: string,
  from: Date,
  timeZone: string,
  maxMinutes = 525_600,
): Date | undefined {
  const start = Math.ceil(from.getTime() / 60_000) * 60_000 + 60_000;
  for (let offset = 0; offset < maxMinutes; offset += 1) {
    const date = new Date(start + offset * 60_000);
    if (matchesCronInTimeZone(expression, date, timeZone)) return date;
  }
  return undefined;
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

  async syncFromWorkspaces(now = new Date()): Promise<void> {
    const projects = await this.deps.workspace.listProjects();
    for (const slug of projects) {
      const graph = await this.deps.workspace.readWorkflow(slug).catch(() => undefined);
      if (!graph) continue;
      const trigger = graph.nodes.find((node) => node.type === "trigger");
      if (!trigger || trigger.config.kind !== "schedule") continue;
      this.ensureScheduleState(slug, graph, trigger, now);
    }
  }

  private ensureScheduleState(projectSlug: string, graph: WorkflowGraph, trigger: NodeSpec, now: Date): void {
    let config;
    try {
      config = TriggerConfigSchema.parse(trigger.config);
    } catch (error) {
      this.deps.logger.warn({
        event: "workflow_schedule_invalid",
        entryPoint: "scheduler",
        projectSlug,
        nodeId: trigger.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const current = this.deps.store.scheduleStates.find({
      projectSlug,
      workflowId: graph.id,
      nodeId: trigger.id,
    });
    const nextWindow =
      config.cron && isValidCronExpression(config.cron)
        ? nextCronDate(config.cron, now, config.timezone)
        : undefined;
    this.deps.store.scheduleStates.upsert({
      id: current?.id ?? crypto.randomUUID(),
      projectSlug,
      workflowId: graph.id,
      nodeId: trigger.id,
      timezone: config.timezone,
      enabled: config.enabled,
      overlapPolicy: config.overlapPolicy,
      catchUp: config.catchUp,
      catchUpWindowMinutes: config.catchUpWindowMinutes,
      lastWindowAt: current?.lastWindowAt,
      nextWindowAt: current?.nextWindowAt ?? nextWindow?.toISOString(),
      lastRunId: current?.lastRunId,
      updatedAt: now.toISOString(),
    });
  }

  async tick(now = new Date()): Promise<WorkflowRunRecord[]> {
    const triggered: WorkflowRunRecord[] = [];
    const currentMinute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    const projects = await this.deps.workspace.listProjects();
    for (const slug of projects) {
      const graph = await this.deps.workspace.readWorkflow(slug).catch(() => undefined);
      if (!graph) continue;
      const trigger = graph.nodes.find((node) => node.type === "trigger");
      if (!trigger || trigger.config.kind !== "schedule") continue;
      const parsed = TriggerConfigSchema.safeParse(trigger.config);
      if (!parsed.success) {
        this.deps.logger.warn({
          event: "workflow_schedule_invalid",
          entryPoint: "scheduler",
          projectSlug: slug,
          nodeId: trigger.id,
          error: parsed.error.issues.map((issue) => issue.message).join("; "),
        });
        continue;
      }
      const config = parsed.data;
      if (!config.cron || !isValidCronExpression(config.cron)) {
        this.deps.logger.warn({
          event: "workflow_schedule_invalid",
          entryPoint: "scheduler",
          projectSlug: slug,
          nodeId: trigger.id,
          error: "invalid cron expression",
        });
        continue;
      }
      this.ensureScheduleState(slug, graph, trigger, now);
      const state = this.deps.store.scheduleStates.find({
        projectSlug: slug,
        workflowId: graph.id,
        nodeId: trigger.id,
      });
      if (!state) continue;
      if (!state.enabled) {
        this.deps.logger.info({
          event: "workflow_schedule_skip",
          entryPoint: "scheduler",
          projectSlug: slug,
          workflowId: graph.id,
          nodeId: trigger.id,
          reason: "disabled",
        });
        continue;
      }

      const from = state.lastWindowAt
        ? new Date(new Date(state.lastWindowAt).getTime() + 60_000)
        : currentMinute;
      const limit = state.catchUp ? Math.max(1, Math.min(1_000, state.catchUpWindowMinutes)) : 1;
      const windows = cronWindowsBetween(config.cron, from, now, state.timezone, limit);
      for (const window of windows) {
        const nextWindowAt = nextCronDate(config.cron, window, state.timezone)?.toISOString();
        if (state.overlapPolicy === "skip" && this.deps.store.runs.findInFlight(slug, graph.id)) {
          this.deps.logger.info({
            event: "workflow_schedule_skip",
            entryPoint: "scheduler",
            projectSlug: slug,
            workflowId: graph.id,
            nodeId: trigger.id,
            reason: "overlap_skip",
            window: window.toISOString(),
          });
          this.deps.store.scheduleStates.update(
            { projectSlug: slug, workflowId: graph.id, nodeId: trigger.id },
            { lastWindowAt: window.toISOString(), nextWindowAt },
          );
          continue;
        }
        const idempotencyKey = `schedule:${graph.id}:${trigger.id}:${cronMinuteKey(window)}`;
        try {
          const run = await this.deps.executor.start({
            projectSlug: slug,
            graph,
            payload: { scheduledAt: window.toISOString(), cron: config.cron, timezone: state.timezone },
            entryPoint: "schedule",
            idempotencyKey,
            launchedBy: "scheduler",
            sourceDetail: `cron:${config.cron}`,
          });
          triggered.push(run);
          this.deps.store.scheduleStates.update(
            { projectSlug: slug, workflowId: graph.id, nodeId: trigger.id },
            { lastWindowAt: window.toISOString(), nextWindowAt, lastRunId: run.id },
          );
        } catch (error) {
          this.deps.logger.warn({
            event: "workflow_schedule_skip",
            entryPoint: "scheduler",
            projectSlug: slug,
            workflowId: graph.id,
            nodeId: trigger.id,
            reason: "start_failed",
            window: window.toISOString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    return triggered;
  }
}
