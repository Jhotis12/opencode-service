import type {
  ApprovalRecord,
  ChatMessageRecord,
  ChatThreadRecord,
  ErrorEventRecord,
  IntegrationRecord,
  KbChunkRecord,
  KbSourceRecord,
  NotebookRecord,
  ProjectRecord,
  StepRunRecord,
  UserRecord,
  VaultSecretRecord,
  WorkflowRunRecord,
  WorkflowVersionRecord,
  WorkflowDeliveryRecord,
  WorkflowScheduleStateRecord,
} from "../../domain/entities.ts";
import type { EntityScope } from "../../domain/entities.ts";
import type { WorkflowGraph } from "@platform/shared";

export interface UserRepository {
  count(): number;
  create(user: UserRecord): void;
  findByUsername(username: string): UserRecord | undefined;
  findById(id: string): UserRecord | undefined;
  updatePassword(id: string, passwordHash: string, mustChangePassword: boolean): void;
}

export interface VaultRepository {
  upsert(record: VaultSecretRecord): void;
  findByAlias(input: { scope: EntityScope; projectSlug?: string; alias: string }): VaultSecretRecord | undefined;
  list(input: { scope: EntityScope; projectSlug?: string }): VaultSecretRecord[];
  remove(input: { scope: EntityScope; projectSlug?: string; alias: string }): boolean;
}

export interface SettingsRepository {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  all(): Record<string, string>;
}

export interface ErrorEventRepository {
  insert(record: ErrorEventRecord): void;
  recent(limit: number): ErrorEventRecord[];
}

export interface ProjectRepository {
  create(record: ProjectRecord): void;
  list(): ProjectRecord[];
  findBySlug(slug: string): ProjectRecord | undefined;
  update(
    slug: string,
    patch: Partial<Pick<ProjectRecord, "name" | "description">> & {
      defaultModel?: string | null;
      primaryAgent?: string | null;
    },
  ): void;
}

export interface IntegrationRepository {
  create(record: IntegrationRecord): void;
  update(id: string, patch: Partial<Omit<IntegrationRecord, "id" | "scope" | "projectSlug" | "kind" | "createdAt">>): void;
  findById(id: string): IntegrationRecord | undefined;
  findBySlug(input: { scope: EntityScope; projectSlug?: string; slug: string }): IntegrationRecord | undefined;
  list(input: { scope: EntityScope; projectSlug?: string }): IntegrationRecord[];
  listAll(): IntegrationRecord[];
  remove(id: string): boolean;
  updateStatus(id: string, status: IntegrationRecord["status"], lastError?: string): void;
}

export interface WorkflowRunRepository {
  claim(record: WorkflowRunRecord): { run: WorkflowRunRecord; created: boolean };
  findById(id: string): WorkflowRunRecord | undefined;
  update(
    id: string,
    patch: Partial<
      Pick<
        WorkflowRunRecord,
        "status" | "output" | "error" | "finishedAt" | "entryPoint" | "launchedBy" | "sourceDetail" | "versionId" | "graphHash"
      >
    >,
  ): void;
  listByProject(projectSlug: string, limit: number): WorkflowRunRecord[];
  listByStatus(status: WorkflowRunRecord["status"]): WorkflowRunRecord[];
  listRecent(limit: number): WorkflowRunRecord[];
  insertStep(record: StepRunRecord): void;
  listSteps(runId: string): StepRunRecord[];
  createApproval(record: ApprovalRecord): void;
  findApproval(runId: string, nodeId: string): ApprovalRecord | undefined;
  pendingApproval(runId: string): ApprovalRecord | undefined;
  decideApproval(runId: string, nodeId: string, status: "approved" | "rejected", decidedBy: string): void;
}

export interface WorkflowDeliveryRepository {
  create(record: WorkflowDeliveryRecord): void;
  findByActionKey(input: { actionKey: string; integrationId: string }): WorkflowDeliveryRecord | undefined;
  update(
    id: string,
    patch: Partial<Pick<WorkflowDeliveryRecord, "status" | "providerMessageId" | "attempts" | "lastError" | "recipient">>,
  ): void;
  listByRun(runId: string): WorkflowDeliveryRecord[];
}

export interface WorkflowScheduleStateRepository {
  upsert(record: WorkflowScheduleStateRecord): void;
  find(input: { projectSlug: string; workflowId: string; nodeId: string }): WorkflowScheduleStateRecord | undefined;
  listAll(): WorkflowScheduleStateRecord[];
  update(
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
  ): void;
  removeByProject(projectSlug: string): void;
}

export interface WorkflowVersionRepository {
  record(input: {
    projectSlug: string;
    graphHash: string;
    graph: WorkflowGraph;
    codeBundle: Record<string, string>;
    createdBy?: string;
    forceNewVersion?: boolean;
  }): WorkflowVersionRecord;
  list(projectSlug: string, limit?: number): WorkflowVersionRecord[];
  findById(id: string): WorkflowVersionRecord | undefined;
  findByVersion(projectSlug: string, version: number): WorkflowVersionRecord | undefined;
  findByGraphHash(projectSlug: string, graphHash: string): WorkflowVersionRecord | undefined;
  latest(projectSlug: string): WorkflowVersionRecord | undefined;
}

export interface ChatThreadRepository {
  findOrCreate(input: {
    scope: EntityScope;
    projectSlug?: string;
    integrationId?: string;
    externalThreadId?: string;
    title?: string;
  }): ChatThreadRecord;
  findById(id: string): ChatThreadRecord | undefined;
  setSession(id: string, sessionId: string): void;
  touch(id: string): void;
  listByProject(projectSlug: string, limit: number): ChatThreadRecord[];
}

export interface ChatRepository {
  append(record: ChatMessageRecord): void;
  listByThread(threadId: string, limit: number): ChatMessageRecord[];
  clearByThread(threadId: string): void;
}

export interface NotebookRepository {
  create(record: NotebookRecord): void;
  list(projectSlug: string): NotebookRecord[];
  listAll(): NotebookRecord[];
  findBySlug(projectSlug: string, slug: string): NotebookRecord | undefined;
  findById(id: string): NotebookRecord | undefined;
  remove(projectSlug: string, slug: string): void;
}

export interface KnowledgeRepository {
  insertSource(record: KbSourceRecord): void;
  insertChunks(records: KbChunkRecord[]): void;
  listSources(notebookId: string): KbSourceRecord[];
  findSource(id: string): KbSourceRecord | undefined;
  removeSource(id: string): void;
  chunksForNotebook(notebookId: string): KbChunkRecord[];
  searchFts(notebookId: string, query: string, limit: number): Array<{ id: string; content: string; rank: number }>;
}

export interface Store {
  users: UserRepository;
  vault: VaultRepository;
  settings: SettingsRepository;
  errors: ErrorEventRepository;
  projects: ProjectRepository;
  integrations: IntegrationRepository;
  runs: WorkflowRunRepository;
  deliveries: WorkflowDeliveryRepository;
  scheduleStates: WorkflowScheduleStateRepository;
  versions: WorkflowVersionRepository;
  chatThreads: ChatThreadRepository;
  chat: ChatRepository;
  notebooks: NotebookRepository;
  knowledge: KnowledgeRepository;
  deleteProjectData(projectSlug: string): void;
  close(): void;
}
