import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations";
import { ensureDemoData } from "./seed";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Data directory:
 * - locally: ./data (gitignored)
 * - on Vercel (serverless): /tmp/famlink — the only writable location, and
 *   ephemeral (resets between cold starts; auto-migrations + demo seed make
 *   that survivable for the demo deployment — persistent Postgres is the
 *   documented production path)
 * - override anywhere with FAMLINK_DATA_DIR
 */
export const DATA_DIR =
  process.env.FAMLINK_DATA_DIR ??
  (process.env.VERCEL ? "/tmp/famlink" : path.join(process.cwd(), "data"));

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

const SQLITE_PATH = path.join(DATA_DIR, "app.db");

/**
 * Apply embedded migrations. Safe on fresh databases (creates everything)
 * and on existing ones (idempotent SQL + baseline detection).
 */
function ensureSchema(sqlite: Database.Database): void {
  sqlite
    .prepare(
      "CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY)",
    )
    .run();

  const hasUsers = (
    sqlite
      .prepare(
        "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = 'users'",
      )
      .get() as { c: number }
  ).c;

  if (hasUsers > 0) {
    // Existing database (e.g. created via drizzle-kit push): baseline it.
    const baseline = sqlite.prepare(
      "INSERT OR IGNORE INTO __migrations (name) VALUES (?)",
    );
    for (const m of MIGRATIONS) baseline.run(m.name);
    return;
  }

  for (const migration of MIGRATIONS) {
    const applied = (
      sqlite
        .prepare("SELECT COUNT(*) AS c FROM __migrations WHERE name = ?")
        .get(migration.name) as { c: number }
    ).c;
    if (applied > 0) continue;
    for (const statement of migration.statements) {
      sqlite.exec(statement);
    }
    sqlite
      .prepare("INSERT INTO __migrations (name) VALUES (?)")
      .run(migration.name);
  }
}

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

ensureSchema(sqlite);
ensureDemoData(sqlite);

export const db = drizzle(sqlite, { schema });
export * as tables from "./schema";
