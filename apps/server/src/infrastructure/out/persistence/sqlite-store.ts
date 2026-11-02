import { and, desc, eq, sql } from "drizzle-orm";
import type {
  ApprovalRecord,
  ChannelRecord,
  ChatMessageRecord,
  ConversationThreadRecord,
  ErrorEventRecord,
  ExternalDatabaseRecord,
  KbChunkRecord,
  KbSourceRecord,
  NotebookRecord,
  ProjectRecord,
  StepRunRecord,
  UserRecord,
  VaultSecretRecord,
  WorkflowRunRecord,
} from "../../../domain/entities.ts";
import type { Store } from "../../../application/ports/store.ts";
import { openDatabase, type DatabaseHandle } from "./db.ts";
import { migrate } from "./migrate.ts";
import {
  channels,
  chatMessages,
  conversationThreads,
  externalDatabases,
  kbChunks,
  kbSources,
  notebooks,
  projects,
  systemErrorEvents,
  systemSettings,
  users,
  vaultSecrets,
  workflowApprovals,
  workflowRuns,
  workflowStepRuns,
} from "./schema.ts";

const json = (value: unknown): string => JSON.stringify(value ?? null);
const parse = <T>(value: string | null): T | undefined => (value ? (JSON.parse(value) as T) : undefined);

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
      this.handle.db
        .insert(vaultSecrets)
        .values(record)
        .onConflictDoUpdate({
          target: vaultSecrets.alias,
          set: { kind: record.kind, ciphertext: record.ciphertext, metadata: record.metadata ?? null },
        })
        .run();
    },
    findByAlias: (alias: string): VaultSecretRecord | undefined => {
      const row = this.handle.db.select().from(vaultSecrets).where(eq(vaultSecrets.alias, alias)).get();
      return row ? { ...row, metadata: row.metadata ?? undefined } : undefined;
    },
    list: (): VaultSecretRecord[] =>
      this.handle.db
        .select()
        .from(vaultSecrets)
        .all()
        .map((row) => ({ ...row, metadata: row.metadata ?? undefined })),
    remove: (alias: string): boolean =>
      this.handle.sqlite.query("DELETE FROM vault_secrets WHERE alias = ?").run(alias).changes > 0,
  };

  externalDatabases = {
    upsert: (record: ExternalDatabaseRecord): void => {
      this.handle.db
        .insert(externalDatabases)
        .values(record)
        .onConflictDoUpdate({
          target: externalDatabases.alias,
          set: { driver: record.driver, ciphertext: record.ciphertext },
        })
        .run();
    },
    findByAlias: (alias: string): ExternalDatabaseRecord | undefined =>
      this.handle.db.select().from(externalDatabases).where(eq(externalDatabases.alias, alias)).get(),
    list: (): ExternalDatabaseRecord[] => this.handle.db.select().from(externalDatabases).all(),
    remove: (alias: string): boolean =>
      this.handle.sqlite.query("DELETE FROM external_databases WHERE alias = ?").run(alias).changes > 0,
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
      this.handle.db.insert(projects).values({ ...record, chatSessionId: record.chatSessionId ?? null }).run();
    },
    list: (): ProjectRecord[] =>
      this.handle.db
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .all()
        .map((row) => ({ ...row, chatSessionId: row.chatSessionId ?? undefined })),
    findBySlug: (slug: string): ProjectRecord | undefined => {
      const row = this.handle.db.select().from(projects).where(eq(projects.slug, slug)).get();
      return row ? { ...row, chatSessionId: row.chatSessionId ?? undefined } : undefined;
    },
    setChatSession: (slug: string, sessionId: string): void => {
      this.handle.db.update(projects).set({ chatSessionId: sessionId }).where(eq(projects.slug, slug)).run();
    },
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
      patch: Partial<Pick<WorkflowRunRecord, "status" | "output" | "error" | "finishedAt">>,
    ): void => {
      this.handle.db
        .update(workflowRuns)
        .set({
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.output !== undefined ? { output: json(patch.output) } : {}),
          ...(patch.error !== undefined ? { error: patch.error } : {}),
          ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
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

  threads = {
    findOrCreate: (input: {
      channelSlug: string;
      externalThreadId: string;
      projectSlug?: string;
      workflowId?: string;
    }): ConversationThreadRecord => {
      const existing = this.handle.db
        .select()
        .from(conversationThreads)
        .where(
          and(
            eq(conversationThreads.channelSlug, input.channelSlug),
            eq(conversationThreads.externalThreadId, input.externalThreadId),
          ),
        )
        .get();
      if (existing) {
        return {
          ...existing,
          opencodeSessionId: existing.opencodeSessionId ?? undefined,
          projectSlug: existing.projectSlug ?? undefined,
          workflowId: existing.workflowId ?? undefined,
        };
      }
      const now = new Date().toISOString();
      const record: ConversationThreadRecord = {
        id: crypto.randomUUID(),
        channelSlug: input.channelSlug,
        externalThreadId: input.externalThreadId,
        projectSlug: input.projectSlug,
        workflowId: input.workflowId,
        createdAt: now,
        lastActiveAt: now,
      };
      this.handle.db.insert(conversationThreads).values(record).onConflictDoNothing().run();
      const row = this.handle.db
        .select()
        .from(conversationThreads)
        .where(
          and(
            eq(conversationThreads.channelSlug, input.channelSlug),
            eq(conversationThreads.externalThreadId, input.externalThreadId),
          ),
        )
        .get();
      return row
        ? {
            ...row,
            opencodeSessionId: row.opencodeSessionId ?? undefined,
            projectSlug: row.projectSlug ?? undefined,
            workflowId: row.workflowId ?? undefined,
          }
        : record;
    },
    setSession: (id: string, sessionId: string): void => {
      this.handle.db
        .update(conversationThreads)
        .set({ opencodeSessionId: sessionId })
        .where(eq(conversationThreads.id, id))
        .run();
    },
    touch: (id: string): void => {
      this.handle.db
        .update(conversationThreads)
        .set({ lastActiveAt: new Date().toISOString() })
        .where(eq(conversationThreads.id, id))
        .run();
    },
    find: (id: string): ConversationThreadRecord | undefined => {
      const row = this.handle.db.select().from(conversationThreads).where(eq(conversationThreads.id, id)).get();
      return row
        ? {
            ...row,
            opencodeSessionId: row.opencodeSessionId ?? undefined,
            projectSlug: row.projectSlug ?? undefined,
            workflowId: row.workflowId ?? undefined,
          }
        : undefined;
    },
  };

  channels = {
    create: (record: ChannelRecord): void => {
      this.handle.db
        .insert(channels)
        .values({
          ...record,
          configCiphertext: record.configCiphertext ?? null,
          keyHash: record.keyHash ?? null,
          adminAllowlist: json(record.adminAllowlist),
          webhookUrl: record.webhookUrl ?? null,
        })
        .run();
    },
    findBySlug: (slug: string): ChannelRecord | undefined => this.mapChannel(
      this.handle.db.select().from(channels).where(eq(channels.slug, slug)).get(),
    ),
    list: (): ChannelRecord[] => this.handle.db.select().from(channels).all().map((row) => this.mapChannel(row)!),
    updateStatus: (slug: string, status: string): void => {
      this.handle.db.update(channels).set({ status }).where(eq(channels.slug, slug)).run();
    },
    setWebhook: (slug: string, webhookUrl: string | undefined): void => {
      this.handle.db.update(channels).set({ webhookUrl: webhookUrl ?? null }).where(eq(channels.slug, slug)).run();
    },
  };

  chat = {
    append: (record: ChatMessageRecord): void => {
      this.handle.db
        .insert(chatMessages)
        .values({
          id: record.id,
          projectSlug: record.projectSlug,
          sessionId: record.sessionId ?? null,
          role: record.role,
          content: record.content,
          createdAt: record.createdAt,
        })
        .run();
    },
    list: (projectSlug: string, limit: number): ChatMessageRecord[] =>
      this.handle.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.projectSlug, projectSlug))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)
        .all()
        .reverse()
        .map((row) => ({
          id: row.id,
          projectSlug: row.projectSlug,
          sessionId: row.sessionId ?? undefined,
          role: row.role as ChatMessageRecord["role"],
          content: row.content,
          createdAt: row.createdAt,
        })),
    clear: (projectSlug: string): void => {
      this.handle.sqlite.query("DELETE FROM chat_messages WHERE project_slug = ?").run(projectSlug);
    },
  };

  notebooks = {
    create: (record: NotebookRecord): void => {
      this.handle.db.insert(notebooks).values(record).run();
    },
    list: (): NotebookRecord[] => this.handle.db.select().from(notebooks).orderBy(desc(notebooks.createdAt)).all(),
    findBySlug: (slug: string): NotebookRecord | undefined =>
      this.handle.db.select().from(notebooks).where(eq(notebooks.slug, slug)).get(),
    remove: (slug: string): void => {
      this.handle.db.delete(notebooks).where(eq(notebooks.slug, slug)).run();
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
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
    };
  }

  private mapChannel(row: typeof channels.$inferSelect | undefined): ChannelRecord | undefined {
    if (!row) return undefined;
    return {
      id: row.id,
      slug: row.slug,
      type: row.type as ChannelRecord["type"],
      name: row.name,
      configCiphertext: row.configCiphertext ?? undefined,
      keyHash: row.keyHash ?? undefined,
      adminAllowlist: JSON.parse(row.adminAllowlist) as string[],
      isPublic: row.isPublic,
      status: row.status,
      webhookUrl: row.webhookUrl ?? undefined,
      createdAt: row.createdAt,
    };
  }
}

export function createStore(path: string): Store {
  return new SqliteStore(path);
}
