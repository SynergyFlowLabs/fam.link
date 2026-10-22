import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const SQLITE_PATH = path.join(DATA_DIR, "app.db");

// Singleton across dev-server hot reloads
declare global {
  var __famlinkSqlite: Database.Database | undefined;
}

const sqlite =
  globalThis.__famlinkSqlite ??
  (globalThis.__famlinkSqlite = new Database(SQLITE_PATH));

// WAL mode: concurrent reads while writing, corruption-resistant
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export * as tables from "./schema";
