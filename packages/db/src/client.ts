import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let instance: { db: Db; sql: postgres.Sql } | undefined;

/** One pooled connection per process. DATABASE_URL points at the VPS through the SSH tunnel in dev. */
export function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example and CLAUDE.md 'Server')");
    // Statement logging is off on purpose: parameters can contain a child's name or an email.
    const sql = postgres(url, { max: 5, idle_timeout: 30, connect_timeout: 10, onnotice: () => {} });
    instance = { db: drizzle(sql, { schema }), sql };
  }
  return instance.db;
}

export async function closeDb(): Promise<void> {
  await instance?.sql.end({ timeout: 5 });
  instance = undefined;
}
