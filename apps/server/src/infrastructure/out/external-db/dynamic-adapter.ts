import { Database } from "bun:sqlite";
import type {
  ExternalDatabaseAdapter,
  ExternalDatabaseStatement,
  ExternalDatabaseStatementResult,
  ExternalDbConfig,
} from "../../../application/ports/runtime.ts";

const TIMEOUT_MS = 5000;

function isReadStatement(sql: string): boolean {
  return /^\s*(select|with|pragma|explain)\b/i.test(sql);
}

function sqliteStatement(
  db: Database,
  statement: ExternalDatabaseStatement,
): ExternalDatabaseStatementResult {
  const query = db.query(statement.sql);
  const params = (statement.params ?? []) as never[];
  if (isReadStatement(statement.sql)) {
    return { rows: query.all(...params) as unknown[], affectedRows: 0 };
  }
  const result = query.run(...params);
  return { rows: [], affectedRows: Number(result.changes ?? 0) };
}

/** Removes credentials and connection strings from driver errors. */
export function sanitizeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .split("\n")[0]!
    .replace(/[a-z]+:\/\/[^\s]*@/gi, "[REDACTED]@")
    .replace(/(password|pwd)\s*=\s*[^\s;]+/gi, "$1=[REDACTED]")
    .slice(0, 300);
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class DynamicDatabaseClientAdapter implements ExternalDatabaseAdapter {
  async test(config: ExternalDbConfig): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
    const started = Date.now();
    try {
      await this.query(config, config.driver === "sqlite" ? "SELECT 1 AS ok" : "SELECT 1 AS ok");
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, detail: sanitizeDatabaseError(error) };
    }
  }

  async query(config: ExternalDbConfig, sql: string, params: unknown[] = []): Promise<unknown[]> {
    switch (config.driver) {
      case "sqlite":
        return this.querySqlite(config, sql, params);
      case "postgres":
        return this.queryPostgres(config, sql, params);
      case "mysql":
        return this.queryMysql(config, sql, params);
      case "mssql":
        return this.queryMssql(config, sql, params);
      default:
        throw new Error(`unsupported driver: ${(config as ExternalDbConfig).driver}`);
    }
  }

  async transaction(
    config: ExternalDbConfig,
    statements: ExternalDatabaseStatement[],
  ): Promise<ExternalDatabaseStatementResult[]> {
    switch (config.driver) {
      case "sqlite":
        return this.transactionSqlite(config, statements);
      case "postgres":
        return this.transactionPostgres(config, statements);
      case "mysql":
        return this.transactionMysql(config, statements);
      case "mssql":
        return this.transactionMssql(config, statements);
      default:
        throw new Error(`unsupported driver: ${(config as ExternalDbConfig).driver}`);
    }
  }

  private querySqlite(config: ExternalDbConfig, sql: string, params: unknown[]): unknown[] {
    if (!config.filename) throw new Error("sqlite connection requires filename");
    const db = new Database(config.filename, { readonly: isReadStatement(sql) });
    try {
      return sqliteStatement(db, { sql, params }).rows;
    } finally {
      db.close();
    }
  }

  private transactionSqlite(
    config: ExternalDbConfig,
    statements: ExternalDatabaseStatement[],
  ): ExternalDatabaseStatementResult[] {
    if (!config.filename) throw new Error("sqlite connection requires filename");
    const db = new Database(config.filename, { readonly: false });
    try {
      const run = db.transaction(() => statements.map((statement) => sqliteStatement(db, statement)));
      return run();
    } finally {
      db.close();
    }
  }

  private async queryPostgres(config: ExternalDbConfig, sql: string, params: unknown[]): Promise<unknown[]> {
    const { Client } = (await import("pg")) as typeof import("pg");
    const client = new Client({
      connectionString: config.connectionString,
      connectionTimeoutMillis: TIMEOUT_MS,
      statement_timeout: TIMEOUT_MS,
    });
    try {
      await withTimeout(client.connect(), "postgres connect");
      const result = await withTimeout(client.query(sql, params), "postgres query");
      return result.rows;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async transactionPostgres(
    config: ExternalDbConfig,
    statements: ExternalDatabaseStatement[],
  ): Promise<ExternalDatabaseStatementResult[]> {
    const { Client } = (await import("pg")) as typeof import("pg");
    const client = new Client({
      connectionString: config.connectionString,
      connectionTimeoutMillis: TIMEOUT_MS,
      statement_timeout: TIMEOUT_MS,
    });
    try {
      await withTimeout(client.connect(), "postgres connect");
      await withTimeout(client.query("BEGIN"), "postgres transaction");
      const results: ExternalDatabaseStatementResult[] = [];
      for (const statement of statements) {
        const result = await withTimeout(
          client.query(statement.sql, statement.params ?? []),
          "postgres transaction statement",
        );
        results.push({ rows: result.rows, affectedRows: result.rowCount ?? 0 });
      }
      await withTimeout(client.query("COMMIT"), "postgres commit");
      return results;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async queryMysql(config: ExternalDbConfig, sql: string, params: unknown[]): Promise<unknown[]> {
    const mysql = (await import("mysql2/promise")) as typeof import("mysql2/promise");
    const connection = await withTimeout(
      mysql.createConnection({
        ...(config.connectionString ? { uri: config.connectionString } : {}),
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: TIMEOUT_MS,
      }),
      "mysql connect",
    );
    try {
      const [rows] = await withTimeout(connection.query(sql, params), "mysql query");
      return Array.isArray(rows) ? (rows as unknown[]) : [];
    } finally {
      await connection.end().catch(() => undefined);
    }
  }

  private async transactionMysql(
    config: ExternalDbConfig,
    statements: ExternalDatabaseStatement[],
  ): Promise<ExternalDatabaseStatementResult[]> {
    const mysql = (await import("mysql2/promise")) as typeof import("mysql2/promise");
    const connection = await withTimeout(
      mysql.createConnection({
        ...(config.connectionString ? { uri: config.connectionString } : {}),
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: TIMEOUT_MS,
      }),
      "mysql connect",
    );
    try {
      await connection.beginTransaction();
      const results: ExternalDatabaseStatementResult[] = [];
      for (const statement of statements) {
        const [rows] = await withTimeout(
          connection.query(statement.sql, statement.params ?? []),
          "mysql transaction statement",
        );
        if (Array.isArray(rows)) {
          results.push({ rows: rows as unknown[], affectedRows: 0 });
        } else {
          const result = rows as { affectedRows?: number };
          results.push({ rows: [], affectedRows: Number(result.affectedRows ?? 0) });
        }
      }
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      await connection.end().catch(() => undefined);
    }
  }

  private async queryMssql(config: ExternalDbConfig, sql: string, _params: unknown[]): Promise<unknown[]> {
    const mssql = (await import("mssql")) as typeof import("mssql");
    const pool = await withTimeout(
      mssql.connect({
        ...(config.connectionString ? { connectionString: config.connectionString } : {}),
        server: config.host ?? "localhost",
        port: config.port,
        user: config.user ?? "",
        password: config.password ?? "",
        database: config.database ?? "",
        connectionTimeout: TIMEOUT_MS,
        requestTimeout: TIMEOUT_MS,
        options: { trustServerCertificate: true },
      }),
      "mssql connect",
    );
    try {
      const result = await withTimeout(pool.request().query(sql), "mssql query");
      return (result.recordset as unknown[]) ?? [];
    } finally {
      await pool.close().catch(() => undefined);
    }
  }

  private async transactionMssql(
    config: ExternalDbConfig,
    statements: ExternalDatabaseStatement[],
  ): Promise<ExternalDatabaseStatementResult[]> {
    const mssql = (await import("mssql")) as typeof import("mssql");
    const pool = await withTimeout(
      mssql.connect({
        ...(config.connectionString ? { connectionString: config.connectionString } : {}),
        server: config.host ?? "localhost",
        port: config.port,
        user: config.user ?? "",
        password: config.password ?? "",
        database: config.database ?? "",
        connectionTimeout: TIMEOUT_MS,
        requestTimeout: TIMEOUT_MS,
        options: { trustServerCertificate: true },
      }),
      "mssql connect",
    );
    const transaction = new mssql.Transaction(pool);
    try {
      await withTimeout(transaction.begin(), "mssql transaction");
      const results: ExternalDatabaseStatementResult[] = [];
      for (const statement of statements) {
        const request = new mssql.Request(transaction);
        const result = await withTimeout(request.query(statement.sql), "mssql transaction statement");
        results.push({
          rows: (result.recordset as unknown[]) ?? [],
          affectedRows: (result.rowsAffected ?? []).reduce((total, count) => total + count, 0),
        });
      }
      await withTimeout(transaction.commit(), "mssql commit");
      return results;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    } finally {
      await pool.close().catch(() => undefined);
    }
  }
}
