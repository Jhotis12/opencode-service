import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import type {
  ApprovalRecord,
  ChatMessageRecord,
  ChatThreadRecord,
  ChatTurnRecord,
  ErrorEventRecord,
  IntegrationRecord,
  KbChunkRecord,
  KbSourceRecord,
  NotebookRecord,
  ProjectDestinationRecord,
  ProjectRecord,
  StepRunRecord,
  UserRecord,
  VaultSecretRecord,
  WorkflowRunRecord,
  WorkflowVersionRecord,
  WorkflowDeliveryRecord,
  WorkflowScheduleStateRecord,
  SessionContextRecord,
  WorkflowTimerRecord,
  QueuedRunRecord,
} from "../../../domain/entities.ts";
import type { WorkflowGraph } from "@platform/shared";
import type { Store } from "../../../application/ports/store.ts";
import { openDatabase, type DatabaseHandle } from "./db.ts";
import { migrate } from "./migrate.ts";
import {
  chatMessages,
  chatThreads,
  integrations,
  kbChunks,
  kbSources,
  notebooks,
  projectDestinations,
  projects,
  systemErrorEvents,
  systemSettings,
  users,
  vaultSecrets,
  workflowApprovals,
  workflowDeliveries,
  workflowRuns,
  workflowScheduleState,
  workflowStepRuns,
  workflowVersions,
  sessionContexts,
  workflowTimers,
  workflowRunQueue,
} from "./schema.ts";

const json = (value: unknown): string => JSON.stringify(value ?? null);
const parse = <T>(value: string | null): T | undefined => (value ? (JSON.parse(value) as T) : undefined);
const scopeKey = (projectSlug?: string): string => projectSlug ?? "";

interface ChatTurnRow {
  id: string;
  thread_id: string;
  scope: string;
  project_slug: string;
  integration_id: string;
  external_thread_id: string;
  session_id: string | null;
  user_message_id: string | null;
  assistant_message_id: string | null;
  inbox_id: string | null;
  assistant_opencode_message_id: string | null;
  status: string;
  delivery_state: string;
  attempt: number;
  started_at: string;
  finished_at: string | null;
  last_activity_at: string;
  last_seq: number | null;
  error_code: string | null;
  error_message: string | null;
  usage_json: string | null;
  has_side_effects: number;
  idempotency_key: string | null;
  entry_point: string;
  created_at: string;
  updated_at: string;
}

export class SqliteStore implements Store {
  private readonly handle: DatabaseHandle;

  constructor(path: string) {
    this.handle = openDatabase(path);
    migrate(this.handle.sqlite);
  }

  get sqlite() {
    return this.handle.sqlite;
  }

  close(): void {
    this.handle.close();
  }

  users = {
    count: (): number => {
      const row = this.handle.db.select({ value: sql<number>`count(*)` }).from(users).get();
      return Number(row?.value ?? 0);
    },
    create: (user: UserRecord): void => {
      this.handle.db.insert(users).values(user).run();
    },
    findByUsername: (username: string): UserRecord | undefined =>
      this.handle.db.select().from(users).where(eq(users.username, username)).get(),
    findById: (id: string): UserRecord | undefined =>
      this.handle.db.select().from(users).where(eq(users.id, id)).get(),
    updatePassword: (id: string, passwordHash: string, mustChangePassword: boolean): void => {
      this.handle.db.update(users).set({ passwordHash, mustChangePassword }).where(eq(users.id, id)).run();
    },
  };

  vault = {
    upsert: (record: VaultSecretRecord): void => {
      const projectSlug = scopeKey(record.projectSlug);
      this.handle.db
        .insert(vaultSecrets)
        .values({
          id: record.id,
          scope: record.scope,
          projectSlug,
          alias: record.alias,
          kind: record.kind,
          ciphertext: record.ciphertext,
          metadata: record.metadata ?? null,
          createdAt: record.createdAt,
        })
        .onConflictDoUpdate({
          target: [vaultSecrets.scope, vaultSecrets.projectSlug, vaultSecrets.alias],
          set: { kind: record.kind, ciphertext: record.ciphertext, metadata: record.metadata ?? null },
        })
        .run();
    },
    findByAlias: (input: { scope: VaultSecretRecord["scope"]; projectSlug?: string; alias: string }): VaultSecretRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(vaultSecrets)
        .where(
          and(
            eq(vaultSecrets.scope, input.scope),
            eq(vaultSecrets.projectSlug, scopeKey(input.projectSlug)),
            eq(vaultSecrets.alias, input.alias),
          ),
        )
        .get();
      return row ? this.mapSecret(row) : undefined;
    },
    list: (input: { scope: VaultSecretRecord["scope"]; projectSlug?: string }): VaultSecretRecord[] =>
      this.handle.db
        .select()
        .from(vaultSecrets)
        .where(
          and(
            eq(vaultSecrets.scope, input.scope),
            eq(vaultSecrets.projectSlug, scopeKey(input.projectSlug)),
          ),
        )
        .all()
        .map((row) => this.mapSecret(row)),
    remove: (input: { scope: VaultSecretRecord["scope"]; projectSlug?: string; alias: string }): boolean =>
      this.handle.sqlite
        .query("DELETE FROM vault_secrets WHERE scope = ? AND project_slug = ? AND alias = ?")
        .run(input.scope, scopeKey(input.projectSlug), input.alias).changes > 0,
  };

  settings = {
    get: (key: string): string | undefined =>
      this.handle.db.select().from(systemSettings).where(eq(systemSettings.key, key)).get()?.value,
    set: (key: string, value: string): void => {
      this.handle.db
        .insert(systemSettings)
        .values({ key, value, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date().toISOString() } })
        .run();
    },
    all: (): Record<string, string> =>
      Object.fromEntries(this.handle.db.select().from(systemSettings).all().map((row) => [row.key, row.value])),
  };

  errors = {
    insert: (record: ErrorEventRecord): void => {
      this.handle.db.insert(systemErrorEvents).values(record).run();
    },
    recent: (limit: number): ErrorEventRecord[] =>
      this.handle.db
        .select()
        .from(systemErrorEvents)
        .orderBy(desc(systemErrorEvents.createdAt))
        .limit(limit)
        .all() as ErrorEventRecord[],
  };

  projects = {
    create: (record: ProjectRecord): void => {
      this.handle.db
        .insert(projects)
        .values({
          id: record.id,
          slug: record.slug,
          name: record.name,
          description: record.description,
          defaultModel: record.defaultModel ?? null,
          primaryAgent: record.primaryAgent ?? null,
          approvalIntegrationId: record.approvalIntegrationId ?? null,
          approvalRecipient: record.approvalRecipient ?? null,
          transcriptionIntegrationId: record.transcriptionIntegrationId ?? null,
          speechIntegrationId: record.speechIntegrationId ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt ?? record.createdAt,
        })
        .run();
    },
    list: (): ProjectRecord[] =>
      this.handle.db
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .all()
        .map((row) => this.mapProject(row)),
    findBySlug: (slug: string): ProjectRecord | undefined => {
      const row = this.handle.db.select().from(projects).where(eq(projects.slug, slug)).get();
      return row ? this.mapProject(row) : undefined;
    },
    update: (
      slug: string,
      patch: Partial<Pick<ProjectRecord, "name" | "description">> & {
        defaultModel?: string | null;
        primaryAgent?: string | null;
        approvalIntegrationId?: string | null;
        approvalRecipient?: string | null;
        transcriptionIntegrationId?: string | null;
        speechIntegrationId?: string | null;
      },
    ): void => {
      this.handle.db
        .update(projects)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.defaultModel !== undefined ? { defaultModel: patch.defaultModel ?? null } : {}),
          ...(patch.primaryAgent !== undefined ? { primaryAgent: patch.primaryAgent ?? null } : {}),
          ...(patch.approvalIntegrationId !== undefined
            ? { approvalIntegrationId: patch.approvalIntegrationId ?? null }
            : {}),
          ...(patch.approvalRecipient !== undefined
            ? { approvalRecipient: patch.approvalRecipient ?? null }
            : {}),
          ...(patch.transcriptionIntegrationId !== undefined
            ? { transcriptionIntegrationId: patch.transcriptionIntegrationId ?? null }
            : {}),
          ...(patch.speechIntegrationId !== undefined
            ? { speechIntegrationId: patch.speechIntegrationId ?? null }
            : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.slug, slug))
        .run();
    },
  };

  integrations = {
    create: (record: IntegrationRecord): void => {
      this.handle.db
        .insert(integrations)
        .values({
          id: record.id,
          scope: record.scope,
          projectSlug: scopeKey(record.projectSlug),
          kind: record.kind,
          name: record.name,
          slug: record.slug,
          config: json(record.config),
          secretRefs: json(record.secretRefs),
          capabilities: json(record.capabilities),
          status: record.status,
          keyHash: record.keyHash ?? null,
          lastError: record.lastError ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
    },
    update: (
      id: string,
      patch: Partial<Omit<IntegrationRecord, "id" | "scope" | "projectSlug" | "kind" | "createdAt">>,
    ): void => {
      this.handle.db
        .update(integrations)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
          ...(patch.config !== undefined ? { config: json(patch.config) } : {}),
          ...(patch.secretRefs !== undefined ? { secretRefs: json(patch.secretRefs) } : {}),
          ...(patch.capabilities !== undefined ? { capabilities: json(patch.capabilities) } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.keyHash !== undefined ? { keyHash: patch.keyHash ?? null } : {}),
          ...(patch.lastError !== undefined ? { lastError: patch.lastError ?? null } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(integrations.id, id))
        .run();
    },
    findById: (id: string): IntegrationRecord | undefined => {
      const row = this.handle.db.select().from(integrations).where(eq(integrations.id, id)).get();
      return row ? this.mapIntegration(row) : undefined;
    },
    findBySlug: (input: { scope: IntegrationRecord["scope"]; projectSlug?: string; slug: string }): IntegrationRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.scope, input.scope),
            eq(integrations.projectSlug, scopeKey(input.projectSlug)),
            eq(integrations.slug, input.slug),
          ),
        )
        .get();
      return row ? this.mapIntegration(row) : undefined;
    },
    list: (input: { scope: IntegrationRecord["scope"]; projectSlug?: string }): IntegrationRecord[] =>
      this.handle.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.scope, input.scope),
            eq(integrations.projectSlug, scopeKey(input.projectSlug)),
          ),
        )
        .orderBy(desc(integrations.createdAt))
        .all()
        .map((row) => this.mapIntegration(row)),
    listAll: (): IntegrationRecord[] =>
      this.handle.db
        .select()
        .from(integrations)
        .orderBy(desc(integrations.createdAt))
        .all()
        .map((row) => this.mapIntegration(row)),
    remove: (id: string): boolean =>
      this.handle.sqlite.query("DELETE FROM integrations WHERE id = ?").run(id).changes > 0,
    updateStatus: (id: string, status: IntegrationRecord["status"], lastError?: string): void => {
      this.handle.db
        .update(integrations)
        .set({ status, lastError: lastError ?? null, updatedAt: new Date().toISOString() })
        .where(eq(integrations.id, id))
        .run();
    },
  };

  destinations = {
    create: (record: ProjectDestinationRecord): void => {
      this.handle.db
        .insert(projectDestinations)
        .values({
          id: record.id,
          projectSlug: record.projectSlug,
          kind: record.kind,
          label: record.label,
          value: record.value,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
    },
    update: (id: string, patch: Partial<Pick<ProjectDestinationRecord, "kind" | "label" | "value">>): void => {
      this.handle.db
        .update(projectDestinations)
        .set({
          ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.value !== undefined ? { value: patch.value } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projectDestinations.id, id))
        .run();
    },
    findById: (id: string): ProjectDestinationRecord | undefined => {
      const row = this.handle.db.select().from(projectDestinations).where(eq(projectDestinations.id, id)).get();
      return row ? this.mapDestination(row) : undefined;
    },
    list: (projectSlug: string): ProjectDestinationRecord[] =>
      this.handle.db
        .select()
        .from(projectDestinations)
        .where(eq(projectDestinations.projectSlug, projectSlug))
        .orderBy(desc(projectDestinations.createdAt))
        .all()
        .map((row) => this.mapDestination(row)),
    remove: (id: string): boolean =>
      this.handle.sqlite.query("DELETE FROM project_destinations WHERE id = ?").run(id).changes > 0,
  };

  runs = {
    claim: (record: WorkflowRunRecord): { run: WorkflowRunRecord; created: boolean } => {
      const inserted = this.handle.db
        .insert(workflowRuns)
        .values({
          id: record.id,
          projectSlug: record.projectSlug,
          workflowId: record.workflowId,
          status: record.status,
          idempotencyKey: record.idempotencyKey ?? null,
          payloadHash: record.payloadHash,
          input: json(record.input),
          output: record.output === undefined ? null : json(record.output),
          error: record.error ?? null,
          entryPoint: record.entryPoint,
          launchedBy: record.launchedBy ?? null,
          graphHash: record.graphHash ?? null,
          versionId: record.versionId ?? null,
          integrationId: record.integrationId ?? null,
          sourceDetail: record.sourceDetail ?? null,
          parentRunId: record.parentRunId ?? null,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: workflowRuns.id })
        .all();
      if (inserted.length > 0) return { run: record, created: true };
      const existing = record.idempotencyKey
        ? this.findRunByKey(record.projectSlug, record.workflowId, record.idempotencyKey)
        : undefined;
      return { run: existing ?? record, created: false };
    },
    findById: (id: string): WorkflowRunRecord | undefined => this.mapRun(this.selectRunById(id)),
    update: (
      id: string,
      patch: Partial<
        Pick<
          WorkflowRunRecord,
          "status" | "output" | "error" | "finishedAt" | "entryPoint" | "launchedBy" | "sourceDetail" | "versionId" | "graphHash"
        >
      >,
    ): void => {
      this.handle.db
        .update(workflowRuns)
        .set({
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.output !== undefined ? { output: json(patch.output) } : {}),
          ...(patch.error !== undefined ? { error: patch.error } : {}),
          ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
          ...(patch.entryPoint !== undefined ? { entryPoint: patch.entryPoint } : {}),
          ...(patch.launchedBy !== undefined ? { launchedBy: patch.launchedBy ?? null } : {}),
          ...(patch.sourceDetail !== undefined ? { sourceDetail: patch.sourceDetail ?? null } : {}),
          ...(patch.versionId !== undefined ? { versionId: patch.versionId ?? null } : {}),
          ...(patch.graphHash !== undefined ? { graphHash: patch.graphHash ?? null } : {}),
        })
        .where(eq(workflowRuns.id, id))
        .run();
    },
    listByProject: (projectSlug: string, limit: number): WorkflowRunRecord[] =>
      this.handle.db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.projectSlug, projectSlug))
        .orderBy(desc(workflowRuns.startedAt))
        .limit(limit)
        .all()
        .map((row) => this.mapRun(row)!),
    findInFlight: (projectSlug: string, workflowId: string): WorkflowRunRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.projectSlug, projectSlug),
            eq(workflowRuns.workflowId, workflowId),
            or(eq(workflowRuns.status, "running"), eq(workflowRuns.status, "paused")),
          ),
        )
        .orderBy(desc(workflowRuns.startedAt))
        .get();
      return this.mapRun(row);
    },
    countInFlight: (projectSlug: string): number => {
      const row = this.handle.db
        .select({ value: sql<number>`count(*)` })
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.projectSlug, projectSlug),
            or(eq(workflowRuns.status, "running"), eq(workflowRuns.status, "paused")),
          ),
        )
        .get();
      return Number(row?.value ?? 0);
    },
    listByStatus: (status: WorkflowRunRecord["status"]): WorkflowRunRecord[] =>
      this.handle.db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.status, status))
        .orderBy(workflowRuns.startedAt)
        .all()
        .map((row) => this.mapRun(row)!),
    listRecent: (limit: number): WorkflowRunRecord[] =>
      this.handle.db
        .select()
        .from(workflowRuns)
        .orderBy(desc(workflowRuns.startedAt))
        .limit(limit)
        .all()
        .map((row) => this.mapRun(row)!),
    insertStep: (record: StepRunRecord): void => {
      this.handle.db
        .insert(workflowStepRuns)
        .values({
          id: record.id,
          runId: record.runId,
          nodeId: record.nodeId,
          status: record.status,
          input: record.input === undefined ? null : json(record.input),
          output: record.output === undefined ? null : json(record.output),
          model: record.model ?? null,
          agentId: record.agentId ?? null,
          logs: record.logs ? JSON.stringify(record.logs) : null,
          durationMs: record.durationMs,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt ?? null,
          error: record.error ?? null,
        })
        .run();
    },
    listSteps: (runId: string): StepRunRecord[] =>
      this.handle.db
        .select()
        .from(workflowStepRuns)
        .where(eq(workflowStepRuns.runId, runId))
        .orderBy(workflowStepRuns.startedAt)
        .all()
        .map((row) => ({
          id: row.id,
          runId: row.runId,
          nodeId: row.nodeId,
          status: row.status as StepRunRecord["status"],
          input: parse(row.input),
          output: parse(row.output),
          model: row.model ?? undefined,
          agentId: row.agentId ?? undefined,
          logs: row.logs ? (JSON.parse(row.logs) as Array<{ message: string; fields: Record<string, unknown> }>) : undefined,
          durationMs: row.durationMs,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt ?? undefined,
          error: row.error ?? undefined,
        })),
    createApproval: (record: ApprovalRecord): void => {
      this.handle.db
        .insert(workflowApprovals)
        .values({
          id: record.id,
          runId: record.runId,
          nodeId: record.nodeId,
          status: record.status,
          createdAt: record.createdAt,
          decidedAt: record.decidedAt ?? null,
          decidedBy: record.decidedBy ?? null,
        })
        .run();
    },
    findApproval: (runId: string, nodeId: string): ApprovalRecord | undefined =>
      this.handle.db
        .select()
        .from(workflowApprovals)
        .where(and(eq(workflowApprovals.runId, runId), eq(workflowApprovals.nodeId, nodeId)))
        .get() as ApprovalRecord | undefined,
    listApprovals: (runId: string): ApprovalRecord[] =>
      this.handle.db
        .select()
        .from(workflowApprovals)
        .where(eq(workflowApprovals.runId, runId))
        .orderBy(desc(workflowApprovals.createdAt))
        .all() as ApprovalRecord[],
    pendingApproval: (runId: string): ApprovalRecord | undefined =>
      this.handle.db
        .select()
        .from(workflowApprovals)
        .where(and(eq(workflowApprovals.runId, runId), eq(workflowApprovals.status, "pending")))
        .get() as ApprovalRecord | undefined,
    decideApproval: (
      runId: string,
      nodeId: string,
      status: "approved" | "rejected",
      decidedBy: string,
    ): void => {
      this.handle.db
        .update(workflowApprovals)
        .set({ status, decidedAt: new Date().toISOString(), decidedBy })
        .where(and(eq(workflowApprovals.runId, runId), eq(workflowApprovals.nodeId, nodeId)))
        .run();
    },
  };

  deliveries = {
    create: (record: WorkflowDeliveryRecord): void => {
      this.handle.db
        .insert(workflowDeliveries)
        .values({
          id: record.id,
          projectSlug: record.projectSlug,
          runId: record.runId ?? null,
          nodeId: record.nodeId ?? null,
          integrationId: record.integrationId,
          actionKey: record.actionKey,
          recipient: record.recipient ?? null,
          status: record.status,
          providerMessageId: record.providerMessageId ?? null,
          attempts: record.attempts,
          lastError: record.lastError ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
    },
    findByActionKey: (input: { actionKey: string; integrationId: string }): WorkflowDeliveryRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(workflowDeliveries)
        .where(
          and(
            eq(workflowDeliveries.actionKey, input.actionKey),
            eq(workflowDeliveries.integrationId, input.integrationId),
          ),
        )
        .get();
      return row ? this.mapDelivery(row) : undefined;
    },
    update: (
      id: string,
      patch: Partial<
        Pick<WorkflowDeliveryRecord, "status" | "providerMessageId" | "attempts" | "lastError" | "recipient">
      >,
    ): void => {
      this.handle.db
        .update(workflowDeliveries)
        .set({
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.providerMessageId !== undefined ? { providerMessageId: patch.providerMessageId } : {}),
          ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
          ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
          ...(patch.recipient !== undefined ? { recipient: patch.recipient } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workflowDeliveries.id, id))
        .run();
    },
    listByRun: (runId: string): WorkflowDeliveryRecord[] =>
      this.handle.db
        .select()
        .from(workflowDeliveries)
        .where(eq(workflowDeliveries.runId, runId))
        .orderBy(desc(workflowDeliveries.createdAt))
        .all()
        .map((row) => this.mapDelivery(row)),
  };

  scheduleStates = {
    upsert: (record: WorkflowScheduleStateRecord): void => {
      this.handle.db
        .insert(workflowScheduleState)
        .values({
          id: record.id,
          projectSlug: record.projectSlug,
          workflowId: record.workflowId,
          nodeId: record.nodeId,
          timezone: record.timezone,
          enabled: record.enabled,
          overlapPolicy: record.overlapPolicy,
          catchUp: record.catchUp,
          catchUpWindowMinutes: record.catchUpWindowMinutes,
          lastWindowAt: record.lastWindowAt ?? null,
          nextWindowAt: record.nextWindowAt ?? null,
          lastRunId: record.lastRunId ?? null,
          updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
          target: [workflowScheduleState.projectSlug, workflowScheduleState.workflowId, workflowScheduleState.nodeId],
          set: {
            timezone: record.timezone,
            enabled: record.enabled,
            overlapPolicy: record.overlapPolicy,
            catchUp: record.catchUp,
            catchUpWindowMinutes: record.catchUpWindowMinutes,
            lastWindowAt: record.lastWindowAt ?? null,
            nextWindowAt: record.nextWindowAt ?? null,
            lastRunId: record.lastRunId ?? null,
            updatedAt: record.updatedAt,
          },
        })
        .run();
    },
    find: (input: { projectSlug: string; workflowId: string; nodeId: string }): WorkflowScheduleStateRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(workflowScheduleState)
        .where(
          and(
            eq(workflowScheduleState.projectSlug, input.projectSlug),
            eq(workflowScheduleState.workflowId, input.workflowId),
            eq(workflowScheduleState.nodeId, input.nodeId),
          ),
        )
        .get();
      return row ? this.mapScheduleState(row) : undefined;
    },
    listAll: (): WorkflowScheduleStateRecord[] =>
      this.handle.db.select().from(workflowScheduleState).all().map((row) => this.mapScheduleState(row)),
    update: (
      input: { projectSlug: string; workflowId: string; nodeId: string },
      patch: Partial<
        Pick<
          WorkflowScheduleStateRecord,
          | "timezone"
          | "enabled"
          | "overlapPolicy"
          | "catchUp"
          | "catchUpWindowMinutes"
          | "lastWindowAt"
          | "nextWindowAt"
          | "lastRunId"
        >
      >,
    ): void => {
      this.handle.db
        .update(workflowScheduleState)
        .set({
          ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.overlapPolicy !== undefined ? { overlapPolicy: patch.overlapPolicy } : {}),
          ...(patch.catchUp !== undefined ? { catchUp: patch.catchUp } : {}),
          ...(patch.catchUpWindowMinutes !== undefined
            ? { catchUpWindowMinutes: patch.catchUpWindowMinutes }
            : {}),
          ...(patch.lastWindowAt !== undefined ? { lastWindowAt: patch.lastWindowAt } : {}),
          ...(patch.nextWindowAt !== undefined ? { nextWindowAt: patch.nextWindowAt } : {}),
          ...(patch.lastRunId !== undefined ? { lastRunId: patch.lastRunId } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(workflowScheduleState.projectSlug, input.projectSlug),
            eq(workflowScheduleState.workflowId, input.workflowId),
            eq(workflowScheduleState.nodeId, input.nodeId),
          ),
        )
        .run();
    },
    removeByProject: (projectSlug: string): void => {
      this.handle.db.delete(workflowScheduleState).where(eq(workflowScheduleState.projectSlug, projectSlug)).run();
    },
  };

  sessionContexts = {
    upsert: (record: SessionContextRecord): void => {
      this.handle.db
        .insert(sessionContexts)
        .values({
          sessionId: record.sessionId,
          scope: record.scope,
          projectSlug: record.projectSlug ?? "",
          agentId: record.agentId ?? null,
          context: record.context,
          runId: record.runId ?? null,
          integrationId: record.integrationId ?? null,
          externalThreadId: record.externalThreadId ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
          target: sessionContexts.sessionId,
          set: {
            scope: record.scope,
            projectSlug: record.projectSlug ?? "",
            agentId: record.agentId ?? null,
            context: record.context,
            runId: record.runId ?? null,
            integrationId: record.integrationId ?? null,
            externalThreadId: record.externalThreadId ?? null,
            updatedAt: record.updatedAt,
          },
        })
        .run();
    },
    find: (sessionId: string): SessionContextRecord | undefined => {
      const row = this.handle.db.select().from(sessionContexts).where(eq(sessionContexts.sessionId, sessionId)).get();
      return row ? this.mapSessionContext(row) : undefined;
    },
    remove: (sessionId: string): void => {
      this.handle.db.delete(sessionContexts).where(eq(sessionContexts.sessionId, sessionId)).run();
    },
    removeByProject: (projectSlug: string): void => {
      this.handle.db.delete(sessionContexts).where(eq(sessionContexts.projectSlug, projectSlug)).run();
    },
  };

  timers = {
    create: (record: WorkflowTimerRecord): void => {
      this.handle.db
        .insert(workflowTimers)
        .values({
          id: record.id,
          runId: record.runId,
          nodeId: record.nodeId,
          dueAt: record.dueAt,
          status: record.status,
          payload: record.payload === undefined ? null : json(record.payload),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
    },
    claimDue: (now: Date, limit: number): WorkflowTimerRecord[] => {
      const claim = this.handle.sqlite.transaction(() => {
        const rows = this.handle.db
          .select()
          .from(workflowTimers)
          .where(and(eq(workflowTimers.status, "pending"), lte(workflowTimers.dueAt, now.toISOString())))
          .orderBy(workflowTimers.dueAt)
          .limit(limit)
          .all();
        for (const row of rows) {
          this.handle.db
            .update(workflowTimers)
            .set({ status: "running", updatedAt: new Date().toISOString() })
            .where(eq(workflowTimers.id, row.id))
            .run();
        }
        return rows.map((row) => this.mapTimer({ ...row, status: "running" }));
      });
      return claim();
    },
    markFired: (id: string): void => {
      this.handle.db
        .update(workflowTimers)
        .set({ status: "fired", updatedAt: new Date().toISOString() })
        .where(eq(workflowTimers.id, id))
        .run();
    },
    listByRun: (runId: string): WorkflowTimerRecord[] =>
      this.handle.db
        .select()
        .from(workflowTimers)
        .where(eq(workflowTimers.runId, runId))
        .orderBy(workflowTimers.createdAt)
        .all()
        .map((row) => this.mapTimer(row)),
  };

  queue = {
    enqueue: (record: QueuedRunRecord): void => {
      this.handle.db
        .insert(workflowRunQueue)
        .values({ runId: record.runId, projectSlug: record.projectSlug, createdAt: record.createdAt })
        .run();
    },
    claimNext: (projectSlug: string): QueuedRunRecord | undefined => {
      const claim = this.handle.sqlite.transaction(() => {
        const row = this.handle.db
          .select()
          .from(workflowRunQueue)
          .where(eq(workflowRunQueue.projectSlug, projectSlug))
          .orderBy(workflowRunQueue.createdAt)
          .get();
        if (!row) return undefined;
        this.handle.db.delete(workflowRunQueue).where(eq(workflowRunQueue.runId, row.runId)).run();
        return { runId: row.runId, projectSlug: row.projectSlug, createdAt: row.createdAt };
      });
      return claim();
    },
    depth: (projectSlug: string): number => {
      const row = this.handle.db
        .select({ value: sql<number>`count(*)` })
        .from(workflowRunQueue)
        .where(eq(workflowRunQueue.projectSlug, projectSlug))
        .get();
      return Number(row?.value ?? 0);
    },
    removeByProject: (projectSlug: string): void => {
      this.handle.db.delete(workflowRunQueue).where(eq(workflowRunQueue.projectSlug, projectSlug)).run();
    },
  };

  chatThreads = {
    findOrCreate: (input: {
      scope: ChatThreadRecord["scope"];
      projectSlug?: string;
      integrationId?: string;
      externalThreadId?: string;
      title?: string;
    }): ChatThreadRecord => {
      const projectSlug = scopeKey(input.projectSlug);
      const integrationId = input.integrationId ?? "";
      const externalThreadId = input.externalThreadId ?? "";
      const existing = this.handle.db
        .select()
        .from(chatThreads)
        .where(
          and(
            eq(chatThreads.scope, input.scope),
            eq(chatThreads.projectSlug, projectSlug),
            eq(chatThreads.integrationId, integrationId),
            eq(chatThreads.externalThreadId, externalThreadId),
          ),
        )
        .get();
      if (existing) return this.mapThread(existing);
      const now = new Date().toISOString();
      const record: ChatThreadRecord = {
        id: crypto.randomUUID(),
        scope: input.scope,
        projectSlug: input.projectSlug,
        integrationId: input.integrationId,
        externalThreadId: input.externalThreadId,
        title: input.title,
        createdAt: now,
        lastActiveAt: now,
      };
      this.handle.db
        .insert(chatThreads)
        .values({
          id: record.id,
          scope: record.scope,
          projectSlug,
          integrationId,
          externalThreadId,
          opencodeSessionId: null,
          title: record.title ?? null,
          createdAt: record.createdAt,
          lastActiveAt: record.lastActiveAt,
        })
        .onConflictDoNothing()
        .run();
      const row = this.handle.db
        .select()
        .from(chatThreads)
        .where(
          and(
            eq(chatThreads.scope, input.scope),
            eq(chatThreads.projectSlug, projectSlug),
            eq(chatThreads.integrationId, integrationId),
            eq(chatThreads.externalThreadId, externalThreadId),
          ),
        )
        .get();
      return row ? this.mapThread(row) : record;
    },
    findById: (id: string): ChatThreadRecord | undefined => {
      const row = this.handle.db.select().from(chatThreads).where(eq(chatThreads.id, id)).get();
      return row ? this.mapThread(row) : undefined;
    },
    setSession: (id: string, sessionId: string): void => {
      this.handle.db.update(chatThreads).set({ opencodeSessionId: sessionId }).where(eq(chatThreads.id, id)).run();
    },
    touch: (id: string): void => {
      this.handle.db
        .update(chatThreads)
        .set({ lastActiveAt: new Date().toISOString() })
        .where(eq(chatThreads.id, id))
        .run();
    },
    listByProject: (projectSlug: string, limit: number): ChatThreadRecord[] =>
      this.handle.db
        .select()
        .from(chatThreads)
        .where(and(eq(chatThreads.scope, "project"), eq(chatThreads.projectSlug, projectSlug)))
        .orderBy(desc(chatThreads.lastActiveAt))
        .limit(limit)
        .all()
        .map((row) => this.mapThread(row)),
  };

  chat = {
    append: (record: ChatMessageRecord): void => {
      this.handle.db
        .insert(chatMessages)
        .values({
          id: record.id,
          threadId: record.threadId,
          turnId: record.turnId ?? null,
          role: record.role,
          content: record.content,
          attachmentsJson: record.attachments ? JSON.stringify(record.attachments) : null,
          errorCode: record.errorCode ?? null,
          createdAt: record.createdAt,
        })
        .run();
    },
    listByThread: (threadId: string, limit: number): ChatMessageRecord[] =>
      this.handle.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.threadId, threadId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)
        .all()
        .reverse()
        .map((row) => this.mapChatMessage(row)),
    listByTurn: (turnId: string): ChatMessageRecord[] =>
      this.handle.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.turnId, turnId))
        .orderBy(chatMessages.createdAt)
        .all()
        .map((row) => this.mapChatMessage(row)),
    clearByThread: (threadId: string): void => {
      this.handle.sqlite.query("DELETE FROM chat_messages WHERE thread_id = ?").run(threadId);
    },
  };

  chatTurns = {
    createWithMessage: (turn: ChatTurnRecord, message: ChatMessageRecord): void => {
      this.handle.sqlite.transaction(() => {
        this.insertChatTurn(turn);
        this.handle.sqlite
          .query(
            "INSERT INTO chat_messages (id, thread_id, turn_id, role, content, attachments_json, error_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            message.id,
            message.threadId,
            message.turnId ?? turn.id,
            message.role,
            message.content,
            message.attachments ? JSON.stringify(message.attachments) : null,
            message.errorCode ?? null,
            message.createdAt,
          );
      })();
    },
    findById: (id: string): ChatTurnRecord | undefined => this.findChatTurn("id = ?", id),
    findActiveByThread: (threadId: string): ChatTurnRecord | undefined =>
      this.findChatTurn("thread_id = ? AND status IN ('queued','running','recovering') ORDER BY started_at DESC LIMIT 1", threadId),
    findByIdempotencyKey: (threadId: string, key: string): ChatTurnRecord | undefined =>
      this.findChatTurn("thread_id = ? AND idempotency_key = ? LIMIT 1", threadId, key),
    update: (id: string, patch: Partial<ChatTurnRecord>): void => {
      this.updateChatTurn(id, patch);
    },
    complete: (id: string, patch: Partial<ChatTurnRecord>, message?: ChatMessageRecord): void => {
      this.handle.sqlite.transaction(() => {
        this.updateChatTurn(id, patch);
        if (message) {
          this.handle.sqlite
            .query(
              "INSERT INTO chat_messages (id, thread_id, turn_id, role, content, attachments_json, error_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              message.id,
              message.threadId,
              message.turnId ?? id,
              message.role,
              message.content,
              message.attachments ? JSON.stringify(message.attachments) : null,
              message.errorCode ?? null,
              message.createdAt,
            );
        }
      })();
    },
    listActive: (): ChatTurnRecord[] =>
      (this.handle.sqlite
        .query("SELECT * FROM chat_turns WHERE status IN ('queued','running','recovering') ORDER BY started_at ASC")
        .all() as ChatTurnRow[]).map((row) => this.mapChatTurn(row)),
    listByThread: (threadId: string, limit: number): ChatTurnRecord[] =>
      (this.handle.sqlite
        .query("SELECT * FROM chat_turns WHERE thread_id = ? ORDER BY started_at DESC LIMIT ?")
        .all(threadId, limit) as ChatTurnRow[]).map((row) => this.mapChatTurn(row)),
    removeByThread: (threadId: string): void => {
      this.handle.sqlite.query("DELETE FROM chat_turns WHERE thread_id = ?").run(threadId);
    },
    removeByProject: (projectSlug: string): void => {
      this.handle.sqlite.query("DELETE FROM chat_turns WHERE project_slug = ?").run(projectSlug);
    },
    stats: () => {
      const now = Date.now();
      const activeRows = this.handle.sqlite
        .query("SELECT started_at FROM chat_turns WHERE status IN ('queued','running','recovering')")
        .all() as Array<{ started_at: string }>;
      const oldest = activeRows.reduce<number | undefined>((min, row) => {
        const age = now - Date.parse(row.started_at);
        return min === undefined || age > min ? age : min;
      }, undefined);
      const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const recovered = this.handle.sqlite
        .query(
          "SELECT count(*) as n FROM chat_turns WHERE status = 'succeeded' AND error_code IS NOT NULL AND updated_at >= ?",
        )
        .get(since) as { n: number };
      const failed = this.handle.sqlite
        .query(
          "SELECT count(*) as n FROM chat_turns WHERE status IN ('failed','timed_out','cancelled','unknown','interrupted') AND updated_at >= ?",
        )
        .get(since) as { n: number };
      const lastError = this.handle.sqlite
        .query(
          "SELECT updated_at FROM chat_turns WHERE status IN ('failed','timed_out','cancelled','unknown','interrupted') ORDER BY updated_at DESC LIMIT 1",
        )
        .get() as { updated_at?: string } | undefined;
      return {
        active: activeRows.length,
        oldestActiveAgeMs: oldest,
        recovered24h: Number(recovered?.n ?? 0),
        failed24h: Number(failed?.n ?? 0),
        lastErrorAt: lastError?.updated_at,
      };
    },
  };

  notebooks = {
    create: (record: NotebookRecord): void => {
      this.handle.db.insert(notebooks).values(record).run();
    },
    list: (projectSlug: string): NotebookRecord[] =>
      this.handle.db
        .select()
        .from(notebooks)
        .where(eq(notebooks.projectSlug, projectSlug))
        .orderBy(desc(notebooks.createdAt))
        .all(),
    listAll: (): NotebookRecord[] =>
      this.handle.db.select().from(notebooks).orderBy(desc(notebooks.createdAt)).all(),
    findBySlug: (projectSlug: string, slug: string): NotebookRecord | undefined =>
      this.handle.db
        .select()
        .from(notebooks)
        .where(and(eq(notebooks.projectSlug, projectSlug), eq(notebooks.slug, slug)))
        .get(),
    findById: (id: string): NotebookRecord | undefined =>
      this.handle.db.select().from(notebooks).where(eq(notebooks.id, id)).get(),
    remove: (projectSlug: string, slug: string): void => {
      const notebook = this.notebooks.findBySlug(projectSlug, slug);
      if (!notebook) return;
      const sources = this.handle.db.select().from(kbSources).where(eq(kbSources.notebookId, notebook.id)).all();
      for (const source of sources) this.knowledge.removeSource(source.id);
      this.handle.db.delete(notebooks).where(eq(notebooks.id, notebook.id)).run();
    },
  };

  knowledge = {
    insertSource: (record: KbSourceRecord): void => {
      this.handle.db.insert(kbSources).values(record).run();
    },
    insertChunks: (records: KbChunkRecord[]): void => {
      if (records.length === 0) return;
      const insert = this.handle.sqlite.transaction(() => {
        for (const record of records) {
          this.handle.db.insert(kbChunks).values(record).run();
          this.handle.sqlite
            .query("INSERT INTO kb_chunks_fts (chunk_id, notebook_id, content) VALUES (?, ?, ?)")
            .run(record.id, record.notebookId, record.content);
        }
      });
      insert();
    },
    listSources: (notebookId: string): KbSourceRecord[] =>
      this.handle.db
        .select()
        .from(kbSources)
        .where(eq(kbSources.notebookId, notebookId))
        .orderBy(desc(kbSources.createdAt))
        .all() as KbSourceRecord[],
    findSource: (id: string): KbSourceRecord | undefined =>
      this.handle.db.select().from(kbSources).where(eq(kbSources.id, id)).get() as KbSourceRecord | undefined,
    removeSource: (id: string): void => {
      this.handle.db.delete(kbChunks).where(eq(kbChunks.sourceId, id)).run();
      this.handle.sqlite.query("DELETE FROM kb_chunks_fts WHERE chunk_id IN (SELECT id FROM kb_chunks WHERE source_id = ?)").run(id);
      this.handle.db.delete(kbSources).where(eq(kbSources.id, id)).run();
    },
    chunksForNotebook: (notebookId: string): KbChunkRecord[] =>
      this.handle.db.select().from(kbChunks).where(eq(kbChunks.notebookId, notebookId)).all() as KbChunkRecord[],
    searchFts: (notebookId: string, query: string, limit: number) => {
      const terms = query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => term.length > 1)
        .slice(0, 12)
        .map((term) => `${term}*`);
      if (terms.length === 0) return [];
      const match = terms.join(" OR ");
      return this.handle.sqlite
        .query(
          `SELECT chunk_id as id, content, bm25(kb_chunks_fts) as rank
           FROM kb_chunks_fts
           WHERE notebook_id = ? AND kb_chunks_fts MATCH ?
           ORDER BY rank LIMIT ?`,
        )
        .all(notebookId, match, limit) as Array<{ id: string; content: string; rank: number }>;
    },
  };

  deleteProjectData = (projectSlug: string): void => {
    const remove = this.handle.sqlite.transaction(() => {
      this.handle.sqlite
        .query("DELETE FROM kb_chunks_fts WHERE chunk_id IN (SELECT id FROM kb_chunks WHERE notebook_id IN (SELECT id FROM notebooks WHERE project_slug = ?))")
        .run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM kb_chunks WHERE notebook_id IN (SELECT id FROM notebooks WHERE project_slug = ?)")
        .run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM kb_sources WHERE notebook_id IN (SELECT id FROM notebooks WHERE project_slug = ?)")
        .run(projectSlug);
      this.handle.sqlite.query("DELETE FROM notebooks WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite.query("DELETE FROM chat_turns WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE scope = 'project' AND project_slug = ?)")
        .run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM chat_threads WHERE scope = 'project' AND project_slug = ?")
        .run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM workflow_deliveries WHERE project_slug = ?")
        .run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM workflow_schedule_state WHERE project_slug = ?")
        .run(projectSlug);
      this.handle.sqlite.query("DELETE FROM session_context WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM workflow_timers WHERE run_id IN (SELECT id FROM workflow_runs WHERE project_slug = ?)")
        .run(projectSlug);
      this.handle.sqlite.query("DELETE FROM workflow_run_queue WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM workflow_approvals WHERE run_id IN (SELECT id FROM workflow_runs WHERE project_slug = ?)")
        .run(projectSlug);
      this.handle.sqlite
        .query("DELETE FROM workflow_step_runs WHERE run_id IN (SELECT id FROM workflow_runs WHERE project_slug = ?)")
        .run(projectSlug);
      this.handle.sqlite.query("DELETE FROM workflow_runs WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite.query("DELETE FROM workflow_versions WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite.query("DELETE FROM project_destinations WHERE project_slug = ?").run(projectSlug);
      this.handle.sqlite.query("DELETE FROM integrations WHERE scope = 'project' AND project_slug = ?").run(projectSlug);
      this.handle.sqlite.query("DELETE FROM vault_secrets WHERE scope = 'project' AND project_slug = ?").run(projectSlug);
      this.handle.sqlite.query("DELETE FROM projects WHERE slug = ?").run(projectSlug);
    });
    remove();
  };

  versions = {
    record: (input: {
      projectSlug: string;
      graphHash: string;
      graph: WorkflowGraph;
      codeBundle: Record<string, string>;
      createdBy?: string;
      forceNewVersion?: boolean;
    }): WorkflowVersionRecord => {
      const latest = this.versions.latest(input.projectSlug);
      const bundleJson = JSON.stringify(input.codeBundle ?? {});
      if (
        !input.forceNewVersion &&
        latest &&
        latest.graphHash === input.graphHash &&
        JSON.stringify(latest.codeBundle) === bundleJson
      ) {
        return latest;
      }
      const nextVersion = (latest?.version ?? 0) + 1;
      const record: WorkflowVersionRecord = {
        id: crypto.randomUUID(),
        projectSlug: input.projectSlug,
        version: nextVersion,
        graphHash: input.graphHash,
        graph: input.graph,
        codeBundle: input.codeBundle ?? {},
        createdBy: input.createdBy,
        createdAt: new Date().toISOString(),
      };
      this.handle.db
        .insert(workflowVersions)
        .values({
          id: record.id,
          projectSlug: record.projectSlug,
          version: record.version,
          graphHash: record.graphHash,
          graphJson: JSON.stringify(record.graph),
          codeBundle: bundleJson,
          createdBy: record.createdBy ?? null,
          createdAt: record.createdAt,
        })
        .run();
      return record;
    },
    list: (projectSlug: string, limit = 50): WorkflowVersionRecord[] =>
      this.handle.db
        .select()
        .from(workflowVersions)
        .where(eq(workflowVersions.projectSlug, projectSlug))
        .orderBy(desc(workflowVersions.version))
        .limit(limit)
        .all()
        .map((row) => this.mapVersion(row)),
    findById: (id: string): WorkflowVersionRecord | undefined => {
      const row = this.handle.db.select().from(workflowVersions).where(eq(workflowVersions.id, id)).get();
      return row ? this.mapVersion(row) : undefined;
    },
    findByVersion: (projectSlug: string, version: number): WorkflowVersionRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(workflowVersions)
        .where(and(eq(workflowVersions.projectSlug, projectSlug), eq(workflowVersions.version, version)))
        .get();
      return row ? this.mapVersion(row) : undefined;
    },
    findByGraphHash: (projectSlug: string, graphHash: string): WorkflowVersionRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(workflowVersions)
        .where(and(eq(workflowVersions.projectSlug, projectSlug), eq(workflowVersions.graphHash, graphHash)))
        .orderBy(desc(workflowVersions.version))
        .get();
      return row ? this.mapVersion(row) : undefined;
    },
    latest: (projectSlug: string): WorkflowVersionRecord | undefined => {
      const row = this.handle.db
        .select()
        .from(workflowVersions)
        .where(eq(workflowVersions.projectSlug, projectSlug))
        .orderBy(desc(workflowVersions.version))
        .get();
      return row ? this.mapVersion(row) : undefined;
    },
  };

  private selectRunById(id: string) {
    return this.handle.db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).get();
  }

  private findRunByKey(projectSlug: string, workflowId: string, key: string) {
    const row = this.handle.db
      .select()
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.projectSlug, projectSlug),
          eq(workflowRuns.workflowId, workflowId),
          eq(workflowRuns.idempotencyKey, key),
        ),
      )
      .get();
    return this.mapRun(row);
  }

  private mapRun(row: typeof workflowRuns.$inferSelect | undefined): WorkflowRunRecord | undefined {
    if (!row) return undefined;
    return {
      id: row.id,
      projectSlug: row.projectSlug,
      workflowId: row.workflowId,
      status: row.status as WorkflowRunRecord["status"],
      idempotencyKey: row.idempotencyKey ?? undefined,
      payloadHash: row.payloadHash,
      input: parse(row.input),
      output: parse(row.output),
      error: row.error ?? undefined,
      entryPoint: row.entryPoint as WorkflowRunRecord["entryPoint"],
      launchedBy: row.launchedBy ?? undefined,
      graphHash: row.graphHash ?? undefined,
      versionId: row.versionId ?? undefined,
      integrationId: row.integrationId ?? undefined,
      sourceDetail: row.sourceDetail ?? undefined,
      parentRunId: row.parentRunId ?? undefined,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
    };
  }

  private mapDelivery(row: typeof workflowDeliveries.$inferSelect): WorkflowDeliveryRecord {
    return {
      id: row.id,
      projectSlug: row.projectSlug,
      runId: row.runId ?? undefined,
      nodeId: row.nodeId ?? undefined,
      integrationId: row.integrationId,
      actionKey: row.actionKey,
      recipient: row.recipient ?? undefined,
      status: row.status as WorkflowDeliveryRecord["status"],
      providerMessageId: row.providerMessageId ?? undefined,
      attempts: row.attempts,
      lastError: row.lastError ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapTimer(row: typeof workflowTimers.$inferSelect): WorkflowTimerRecord {
    return {
      id: row.id,
      runId: row.runId,
      nodeId: row.nodeId,
      dueAt: row.dueAt,
      status: row.status as WorkflowTimerRecord["status"],
      payload: parse(row.payload),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSessionContext(row: typeof sessionContexts.$inferSelect): SessionContextRecord {
    return {
      sessionId: row.sessionId,
      scope: row.scope as SessionContextRecord["scope"],
      projectSlug: row.projectSlug || undefined,
      agentId: row.agentId ?? undefined,
      context: row.context as SessionContextRecord["context"],
      runId: row.runId ?? undefined,
      integrationId: row.integrationId ?? undefined,
      externalThreadId: row.externalThreadId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapScheduleState(row: typeof workflowScheduleState.$inferSelect): WorkflowScheduleStateRecord {
    return {
      id: row.id,
      projectSlug: row.projectSlug,
      workflowId: row.workflowId,
      nodeId: row.nodeId,
      timezone: row.timezone,
      enabled: row.enabled,
      overlapPolicy: row.overlapPolicy as WorkflowScheduleStateRecord["overlapPolicy"],
      catchUp: row.catchUp,
      catchUpWindowMinutes: row.catchUpWindowMinutes,
      lastWindowAt: row.lastWindowAt ?? undefined,
      nextWindowAt: row.nextWindowAt ?? undefined,
      lastRunId: row.lastRunId ?? undefined,
      updatedAt: row.updatedAt,
    };
  }

  private mapVersion(row: typeof workflowVersions.$inferSelect): WorkflowVersionRecord {
    return {
      id: row.id,
      projectSlug: row.projectSlug,
      version: row.version,
      graphHash: row.graphHash,
      graph: JSON.parse(row.graphJson) as WorkflowGraph,
      codeBundle: (parse<Record<string, string>>(row.codeBundle) ?? {}),
      createdBy: row.createdBy ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private mapProject(row: typeof projects.$inferSelect): ProjectRecord {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      defaultModel: row.defaultModel ?? undefined,
      primaryAgent: row.primaryAgent ?? undefined,
      approvalIntegrationId: row.approvalIntegrationId ?? undefined,
      approvalRecipient: row.approvalRecipient ?? undefined,
      transcriptionIntegrationId: row.transcriptionIntegrationId ?? undefined,
      speechIntegrationId: row.speechIntegrationId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
    };
  }

  private mapSecret(row: typeof vaultSecrets.$inferSelect): VaultSecretRecord {
    return {
      id: row.id,
      scope: row.scope as VaultSecretRecord["scope"],
      projectSlug: row.projectSlug || undefined,
      alias: row.alias,
      kind: row.kind,
      ciphertext: row.ciphertext,
      metadata: row.metadata ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private mapDestination(row: typeof projectDestinations.$inferSelect): ProjectDestinationRecord {
    return {
      id: row.id,
      projectSlug: row.projectSlug,
      kind: row.kind as ProjectDestinationRecord["kind"],
      label: row.label,
      value: row.value,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapIntegration(row: typeof integrations.$inferSelect): IntegrationRecord {
    return {
      id: row.id,
      scope: row.scope as IntegrationRecord["scope"],
      projectSlug: row.projectSlug || undefined,
      kind: row.kind as IntegrationRecord["kind"],
      name: row.name,
      slug: row.slug,
      config: parse(row.config) ?? {},
      secretRefs: parse(row.secretRefs) ?? {},
      capabilities: parse(row.capabilities) ?? [],
      status: row.status as IntegrationRecord["status"],
      keyHash: row.keyHash ?? undefined,
      lastError: row.lastError ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapChatMessage(row: typeof chatMessages.$inferSelect): ChatMessageRecord {
    return {
      id: row.id,
      threadId: row.threadId,
      turnId: row.turnId ?? undefined,
      role: row.role as ChatMessageRecord["role"],
      content: row.content,
      attachments: parse<ChatMessageRecord["attachments"]>(row.attachmentsJson),
      errorCode: (row.errorCode as ChatMessageRecord["errorCode"]) ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private findChatTurn(where: string, ...params: unknown[]): ChatTurnRecord | undefined {
    const row = this.handle.sqlite.query(`SELECT * FROM chat_turns WHERE ${where}`).get(...(params as any)) as ChatTurnRow | null;
    return row ? this.mapChatTurn(row) : undefined;
  }

  private insertChatTurn(turn: ChatTurnRecord): void {
    this.handle.sqlite
      .query(
        `INSERT INTO chat_turns (
          id, thread_id, scope, project_slug, integration_id, external_thread_id,
          session_id, user_message_id, assistant_message_id, inbox_id, assistant_opencode_message_id,
          status, delivery_state, attempt, started_at, finished_at, last_activity_at, last_seq,
          error_code, error_message, usage_json, has_side_effects, idempotency_key, entry_point, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        turn.id,
        turn.threadId,
        turn.scope,
        turn.projectSlug ?? "",
        turn.integrationId ?? "",
        turn.externalThreadId ?? "",
        turn.sessionId ?? null,
        turn.userMessageId ?? null,
        turn.assistantMessageId ?? null,
        turn.inboxId ?? null,
        turn.assistantOpencodeMessageId ?? null,
        turn.status,
        turn.deliveryState,
        turn.attempt,
        turn.startedAt,
        turn.finishedAt ?? null,
        turn.lastActivityAt,
        turn.lastSeq ?? null,
        turn.errorCode ?? null,
        turn.errorMessage ?? null,
        turn.usage ? JSON.stringify(turn.usage) : null,
        turn.hasSideEffects ? 1 : 0,
        turn.idempotencyKey ?? null,
        turn.entryPoint,
        turn.createdAt,
        turn.updatedAt,
      );
  }

  private updateChatTurn(id: string, patch: Partial<ChatTurnRecord>): void {
    const columns: Record<string, string> = {
      threadId: "thread_id",
      scope: "scope",
      projectSlug: "project_slug",
      integrationId: "integration_id",
      externalThreadId: "external_thread_id",
      sessionId: "session_id",
      userMessageId: "user_message_id",
      assistantMessageId: "assistant_message_id",
      inboxId: "inbox_id",
      assistantOpencodeMessageId: "assistant_opencode_message_id",
      status: "status",
      deliveryState: "delivery_state",
      attempt: "attempt",
      startedAt: "started_at",
      finishedAt: "finished_at",
      lastActivityAt: "last_activity_at",
      lastSeq: "last_seq",
      errorCode: "error_code",
      errorMessage: "error_message",
      usage: "usage_json",
      hasSideEffects: "has_side_effects",
      idempotencyKey: "idempotency_key",
      entryPoint: "entry_point",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns)) {
      if (!(key in patch)) continue;
      const value = (patch as Record<string, unknown>)[key];
      if (value === undefined) continue;
      assignments.push(`${column} = ?`);
      values.push(
        key === "usage"
          ? value
            ? JSON.stringify(value)
            : null
          : key === "hasSideEffects"
            ? value
              ? 1
              : 0
            : value,
      );
    }
    if (assignments.length === 0) return;
    values.push(id);
    this.handle.sqlite.query(`UPDATE chat_turns SET ${assignments.join(", ")} WHERE id = ?`).run(...(values as any));
  }

  private mapChatTurn(row: ChatTurnRow): ChatTurnRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      scope: row.scope as ChatTurnRecord["scope"],
      projectSlug: row.project_slug || undefined,
      integrationId: row.integration_id || undefined,
      externalThreadId: row.external_thread_id || undefined,
      sessionId: row.session_id ?? undefined,
      userMessageId: row.user_message_id ?? undefined,
      assistantMessageId: row.assistant_message_id ?? undefined,
      inboxId: row.inbox_id ?? undefined,
      assistantOpencodeMessageId: row.assistant_opencode_message_id ?? undefined,
      status: row.status as ChatTurnRecord["status"],
      deliveryState: row.delivery_state as ChatTurnRecord["deliveryState"],
      attempt: Number(row.attempt ?? 0),
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? undefined,
      lastActivityAt: row.last_activity_at,
      lastSeq: row.last_seq ?? undefined,
      errorCode: (row.error_code as ChatTurnRecord["errorCode"]) ?? undefined,
      errorMessage: row.error_message ?? undefined,
      usage: row.usage_json ? (JSON.parse(row.usage_json) as ChatTurnRecord["usage"]) : undefined,
      hasSideEffects: Boolean(row.has_side_effects),
      idempotencyKey: row.idempotency_key ?? undefined,
      entryPoint: row.entry_point,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapThread(row: typeof chatThreads.$inferSelect): ChatThreadRecord {
    return {
      id: row.id,
      scope: row.scope as ChatThreadRecord["scope"],
      projectSlug: row.projectSlug || undefined,
      integrationId: row.integrationId || undefined,
      externalThreadId: row.externalThreadId || undefined,
      opencodeSessionId: row.opencodeSessionId ?? undefined,
      title: row.title ?? undefined,
      createdAt: row.createdAt,
      lastActiveAt: row.lastActiveAt,
    };
  }
}

export function createStore(path: string): Store {
  return new SqliteStore(path);
}
