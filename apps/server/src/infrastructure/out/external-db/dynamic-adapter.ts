import { Database } from "bun:sqlite";
import type { ExternalDatabaseAdapter, ExternalDbConfig } from "../../../application/ports/runtime.ts";

const TIMEOUT_MS = 5000;

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

  private querySqlite(config: ExternalDbConfig, sql: string, params: unknown[]): unknown[] {
    if (!config.filename) throw new Error("sqlite connection requires filename");
    const db = new Database(config.filename, { readonly: !/^\s*(insert|update|delete|create|alter|drop)/i.test(sql) });
    try {
      const statement = db.query(sql);
      if (/^\s*select|^\s*with|pragma/i.test(sql)) return statement.all(...(params as never[])) as unknown[];
      statement.run(...(params as never[]));
      return [];
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
}
