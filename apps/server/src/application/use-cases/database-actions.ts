import type { Store } from "../ports/store.ts";
import type { SecretVault } from "../ports/security.ts";
import type {
  ExternalDatabaseAdapter,
  ExternalDatabaseStatement,
  ExternalDatabaseStatementResult,
} from "../ports/runtime.ts";
import type { DatabaseStatement } from "@platform/shared";
import { TestDatabaseIntegrationUseCase } from "./connections.ts";

export type SqlStatementKind = "read" | "write" | "ddl";

export interface ExecuteDatabaseActionInput {
  projectSlug: string;
  integrationId: string;
  mode: "read" | "write";
  statements: DatabaseStatement[];
  transaction?: boolean;
  maxRows?: number;
}

export interface ExecuteDatabaseActionResult {
  rows: unknown[];
  rowCount: number;
  affectedRows: number;
  truncated: boolean;
}

const READ_SQL = /^\s*(select|with|pragma|explain)\b/i;
const WRITE_SQL = /^\s*(insert|update|delete|merge)\b/i;
const DDL_SQL = /^\s*(create|alter|drop|truncate)\b/i;

export function classifySql(sql: string): SqlStatementKind | undefined {
  if (READ_SQL.test(sql)) return "read";
  if (WRITE_SQL.test(sql)) return "write";
  if (DDL_SQL.test(sql)) return "ddl";
  return undefined;
}

export class DatabaseActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseActionValidationError";
  }
}

export class ExecuteDatabaseActionUseCase {
  constructor(
    private readonly store: Store,
    private readonly vault: SecretVault,
    private readonly adapter: ExternalDatabaseAdapter,
  ) {}

  async execute(input: ExecuteDatabaseActionInput): Promise<ExecuteDatabaseActionResult> {
    if (input.statements.length === 0) {
      throw new DatabaseActionValidationError("database node requires at least one statement");
    }
    const resolved = new TestDatabaseIntegrationUseCase(this.store, this.vault, this.adapter).resolve(
      input.integrationId,
      { scope: "project", projectSlug: input.projectSlug },
    );

    const statements: ExternalDatabaseStatement[] = input.statements.map((statement) => {
      const kind = classifySql(statement.sql);
      if (!kind) throw new DatabaseActionValidationError("only SQL statements are allowed");
      if (input.mode === "read" && kind !== "read") {
        throw new DatabaseActionValidationError(`read mode does not allow ${kind} statements`);
      }
      if (input.mode === "write" && kind === "ddl") {
        throw new DatabaseActionValidationError("DDL statements are not enabled for this node");
      }
      if (statement.params !== undefined && !Array.isArray(statement.params)) {
        throw new DatabaseActionValidationError("database statement params must be a JSON array");
      }
      return {
        sql: statement.sql,
        params: (statement.params as unknown[] | undefined) ?? [],
      };
    });

    const results = await this.executeStatements(resolved.config, statements, input.transaction);
    const rawRows = [...results].reverse().find((result) => result.rows.length > 0)?.rows ?? [];
    const maxRows = Math.min(input.maxRows ?? 1_000, 10_000);
    const truncated = rawRows.length > maxRows;
    const rows = rawRows.slice(0, maxRows);
    return {
      rows,
      rowCount: rows.length,
      affectedRows: results.reduce((total, result) => total + result.affectedRows, 0),
      truncated,
    };
  }

  private async executeStatements(
    config: ReturnType<TestDatabaseIntegrationUseCase["resolve"]>["config"],
    statements: ExternalDatabaseStatement[],
    transaction?: boolean,
  ): Promise<ExternalDatabaseStatementResult[]> {
    if (transaction ?? statements.length > 1) {
      return this.adapter.transaction(config, statements);
    }
    const results: ExternalDatabaseStatementResult[] = [];
    for (const statement of statements) {
      const kind = classifySql(statement.sql);
      if (kind === "read") {
        results.push({ rows: await this.adapter.query(config, statement.sql, statement.params), affectedRows: 0 });
      } else {
        const [result] = await this.adapter.transaction(config, [statement]);
        results.push(result ?? { rows: [], affectedRows: 0 });
      }
    }
    return results;
  }
}
