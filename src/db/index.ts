import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations";
import { ensureDemoData } from "./seed";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
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
 * Apply embedded migrations. All statements are idempotent by construction
 * (CREATE … IF NOT EXISTS); the one exception — `ALTER TABLE … ADD COLUMN`,
 * which SQLite has no IF NOT EXISTS form for — is tolerated by catching the
 * "duplicate column name" error, so a migration may also run against a
 * database that already has the column (e.g. created via `drizzle-kit push`).
 */
function execIdempotent(sqlite: Database.Database, statement: string): void {
  try {
    sqlite.exec(statement);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("duplicate column name")) {
      return; // column already there — the migration's job is done
    }
    throw err;
  }
}

function ensureSchema(sqlite: Database.Database): void {
  sqlite
    .prepare(
      "CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY)",
    )
    .run();

  // A database with tables but no __migrations rows was created outside the
  // runner (e.g. `drizzle-kit push` in dev, or an older build). Since every
  // statement is idempotent, it is safe — and correct — to simply run the
  // normal loop against it: present tables no-op, missing ones are created.
  // The recorded names then behave exactly like a runner-created database,
  // so later migrations apply once, on boot, going forward.

  for (const migration of MIGRATIONS) {
    const applied = (
      sqlite
        .prepare("SELECT COUNT(*) AS c FROM __migrations WHERE name = ?")
        .get(migration.name) as { c: number }
    ).c;
    if (applied > 0) continue;
    for (const statement of migration.statements) {
      execIdempotent(sqlite, statement);
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
sweepStrayUploadFiles(sqlite);

/**
 * Safety net: remove files under uploads/ that no media row points at
 * (left behind by crashes mid-action, or deletions that were interrupted).
 * Targeted sweeps run after each deletion action — this catches the rest.
 */
function sweepStrayUploadFiles(sqlite: Database.Database): void {
  try {
    const known = new Set(
      (
        sqlite.prepare("SELECT path FROM media").all() as { path: string }[]
      ).map((r) => r.path),
    );
    const dir = path.join(DATA_DIR, "uploads");
    for (const file of readdirSync(dir)) {
      if (!known.has(`uploads/${file}`)) {
        try {
          unlinkSync(path.join(dir, file));
        } catch {
          // already gone / locked — next boot will retry
        }
      }
    }
  } catch {
    // uploads dir missing or unreadable — nothing to sweep
  }
}

export const db = drizzle(sqlite, { schema });
export * as tables from "./schema";
