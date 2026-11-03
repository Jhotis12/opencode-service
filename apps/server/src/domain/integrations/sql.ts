export type SqlStatementKind = "read" | "write" | "ddl";

const READ_SQL = /^\s*(select|with|pragma|explain)\b/i;
const WRITE_SQL = /^\s*(insert|update|delete|merge)\b/i;
const DDL_SQL = /^\s*(create|alter|drop|truncate)\b/i;

export function classifySql(sql: string): SqlStatementKind | undefined {
  if (READ_SQL.test(sql)) return "read";
  if (WRITE_SQL.test(sql)) return "write";
  if (DDL_SQL.test(sql)) return "ddl";
  return undefined;
}
