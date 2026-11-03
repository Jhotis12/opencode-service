import type { Store } from "../ports/store.ts";
import type { SecretVault } from "../ports/security.ts";
import type {
  ExternalDatabaseAdapter,
  ExternalDatabaseStatement,
  ExternalDatabaseStatementResult,
} from "../ports/runtime.ts";
import type { DatabaseStatement } from "@platform/shared";
import { databaseAccessPolicy } from "@platform/shared";
import { TestDatabaseIntegrationUseCase } from "./connections.ts";
import { classifySql, type SqlStatementKind } from "../../domain/integrations/sql.ts";
import type { Logger } from "../../domain/telemetry/index.ts";

export { classifySql };
export type { SqlStatementKind };

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
    private readonly logger?: Logger,
  ) {}

  async execute(input: ExecuteDatabaseActionInput): Promise<ExecuteDatabaseActionResult> {
    if (input.statements.length === 0) {
      throw new DatabaseActionValidationError("database node requires at least one statement");
    }
    const resolved = new TestDatabaseIntegrationUseCase(this.store, this.vault, this.adapter).resolve(
      input.integrationId,
      { scope: "project", projectSlug: input.projectSlug },
    );
    const policy = databaseAccessPolicy(resolved.integration.config);
    if (input.mode === "write" && policy.access !== "write") {
      throw new DatabaseActionValidationError("database integration is configured as read-only");
    }

    const statements: ExternalDatabaseStatement[] = input.statements.map((statement) => {
      const kind = classifySql(statement.sql);
      if (!kind) throw new DatabaseActionValidationError("only SQL statements are allowed");
      if (input.mode === "read" && kind !== "read") {
        throw new DatabaseActionValidationError(`read mode does not allow ${kind} statements`);
      }
      if (kind === "ddl" && !policy.allowDdl) {
        throw new DatabaseActionValidationError("DDL statements are not enabled for this integration");
      }
      if (statement.params !== undefined && !Array.isArray(statement.params)) {
        throw new DatabaseActionValidationError("database statement params must be a JSON array");
      }
      return {
        sql: statement.sql,
        params: (statement.params as unknown[] | undefined) ?? [],
      };
    });
    if (statements.some((statement) => classifySql(statement.sql) === "ddl")) {
      this.logger?.info({
        event: "database_ddl",
        projectSlug: input.projectSlug,
        integrationId: input.integrationId,
        statements: statements.length,
      });
    }

    const results = await this.executeStatements(resolved.config, statements, input.transaction);
    const rawRows = [...results].reverse().find((result) => result.rows.length > 0)?.rows ?? [];
    const maxRows = Math.min(input.maxRows ?? policy.maxRows, policy.maxRows, 10_000);
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
