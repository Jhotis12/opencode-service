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
} from "../../domain/entities.ts";

export interface UserRepository {
  count(): number;
  create(user: UserRecord): void;
  findByUsername(username: string): UserRecord | undefined;
  findById(id: string): UserRecord | undefined;
  updatePassword(id: string, passwordHash: string, mustChangePassword: boolean): void;
}

export interface VaultRepository {
  upsert(record: VaultSecretRecord): void;
  findByAlias(alias: string): VaultSecretRecord | undefined;
  list(): VaultSecretRecord[];
  remove(alias: string): boolean;
}

export interface ExternalDatabaseRepository {
  upsert(record: ExternalDatabaseRecord): void;
  findByAlias(alias: string): ExternalDatabaseRecord | undefined;
  list(): ExternalDatabaseRecord[];
  remove(alias: string): boolean;
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
  setChatSession(slug: string, sessionId: string): void;
}

export interface WorkflowRunRepository {
  claim(record: WorkflowRunRecord): { run: WorkflowRunRecord; created: boolean };
  findById(id: string): WorkflowRunRecord | undefined;
  update(id: string, patch: Partial<Pick<WorkflowRunRecord, "status" | "output" | "error" | "finishedAt">>): void;
  listByProject(projectSlug: string, limit: number): WorkflowRunRecord[];
  listRecent(limit: number): WorkflowRunRecord[];
  insertStep(record: StepRunRecord): void;
  listSteps(runId: string): StepRunRecord[];
  createApproval(record: ApprovalRecord): void;
  findApproval(runId: string, nodeId: string): ApprovalRecord | undefined;
  pendingApproval(runId: string): ApprovalRecord | undefined;
  decideApproval(runId: string, nodeId: string, status: "approved" | "rejected", decidedBy: string): void;
}

export interface ConversationThreadRepository {
  findOrCreate(input: {
    channelSlug: string;
    externalThreadId: string;
    projectSlug?: string;
    workflowId?: string;
  }): ConversationThreadRecord;
  setSession(id: string, sessionId: string): void;
  touch(id: string): void;
  find(id: string): ConversationThreadRecord | undefined;
}

export interface ChannelRepository {
  create(record: ChannelRecord): void;
  findBySlug(slug: string): ChannelRecord | undefined;
  list(): ChannelRecord[];
  updateStatus(slug: string, status: string): void;
  setWebhook(slug: string, webhookUrl: string | undefined): void;
}

export interface ChatRepository {
  append(record: ChatMessageRecord): void;
  list(projectSlug: string, limit: number): ChatMessageRecord[];
  clear(projectSlug: string): void;
}

export interface NotebookRepository {
  create(record: NotebookRecord): void;
  list(): NotebookRecord[];
  findBySlug(slug: string): NotebookRecord | undefined;
  remove(slug: string): void;
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
  externalDatabases: ExternalDatabaseRepository;
  settings: SettingsRepository;
  errors: ErrorEventRepository;
  projects: ProjectRepository;
  runs: WorkflowRunRepository;
  threads: ConversationThreadRepository;
  channels: ChannelRepository;
  chat: ChatRepository;
  notebooks: NotebookRepository;
  knowledge: KnowledgeRepository;
  close(): void;
}
