import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations";
import { PG_MIGRATIONS } from "./migrations-pg";
import { ensureDemoData, ensureStoryPrompts } from "./seed";
import { ensureDemoDataPg, ensureStoryPromptsPg, type PgAppDb } from "./seed-pg";
import * as pgSchema from "./schema-pg";

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

/**
 * Database driver — three modes, one app:
 *
 *  - "postgres": DATABASE_URL (or POSTGRES_URL / POSTGRES_DATABASE_URL, the
 *    names Vercel's Storage marketplace sets) points at a real Postgres —
 *    THE production path (persistent across instances and cold starts).
 *  - "pglite":   FAMLINK_DB=pglite runs an embedded Postgres (WASM) in the
 *    data dir — zero-setup local verification of the Postgres code path.
 *  - "sqlite":   default; the original local driver, better-sqlite3.
 *
 * The drizzle query surface used by the app is dialect-uniform, so `db` is
 * typed as the SQLite client everywhere (schema-parity.test.ts locks the two
 * schemas together: same tables, same columns, assignable row types).
 */
export type DbDriver = "sqlite" | "pglite" | "postgres";

const PG_URL =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_DATABASE_URL ??
  null;

export const DB_DRIVER: DbDriver =
  PG_URL && /^postgres(ql)?:\/\//.test(PG_URL)
    ? "postgres"
    : process.env.FAMLINK_DB === "pglite"
      ? "pglite"
      : "sqlite";

/* ------------------------------------------------------------------ */
/* SQLite (default)                                                    */
/* ------------------------------------------------------------------ */

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

function makeSqliteDb() {
  // Singleton across dev-server hot reloads
  const g = globalThis as typeof globalThis & {
    __famlinkSqlite?: Database.Database;
  };
  const sqlite = g.__famlinkSqlite ?? (g.__famlinkSqlite = new Database(SQLITE_PATH));

  // WAL mode: concurrent reads while writing, corruption-resistant
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  ensureSchema(sqlite);
  ensureDemoData(sqlite);
  ensureStoryPrompts(sqlite);
  sweepStrayUploadFiles(sqlite);

  return drizzle(sqlite, { schema });
}

/* ------------------------------------------------------------------ */
/* Postgres / PGlite                                                   */
/* ------------------------------------------------------------------ */

/** Minimal runner over either pg driver (node-postgres Pool / PGlite). */
interface PgRunner {
  query(statement: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

async function applyPgMigrations(run: PgRunner): Promise<void> {
  await run.query("CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY)");
  for (const migration of PG_MIGRATIONS) {
    const applied = await run.query(
      "SELECT COUNT(*)::int AS c FROM __migrations WHERE name = $1",
      [migration.name],
    );
    if (Number(applied.rows[0]?.c ?? 0) > 0) continue;
    for (const statement of migration.statements) {
      await run.query(statement);
    }
    await run.query(
      "INSERT INTO __migrations (name) VALUES ($1) ON CONFLICT DO NOTHING",
      [migration.name],
    );
  }
}

async function bootSweepUploadsPg(d: PgAppDb): Promise<void> {
  try {
    const rows = await d.select({ path: pgSchema.media.path }).from(pgSchema.media);
    const known = new Set(rows.map((r) => r.path));
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

async function initPglite(): Promise<PgAppDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(path.join(DATA_DIR, "app-pg.db"));
  const runner: PgRunner = {
    query: async (statement, params) =>
      client.query(statement, params) as Promise<{ rows: Record<string, unknown>[] }>,
  };
  await applyPgMigrations(runner);
  const d = drizzle(client, { schema: pgSchema }) as unknown as PgAppDb;
  await ensureDemoDataPg(d);
  await ensureStoryPromptsPg(d);
  await bootSweepUploadsPg(d);
  return d;
}

async function initPostgres(url: string): Promise<PgAppDb> {
  const { Pool } = await import("pg");
  // Small pool: serverless functions multiply, and hosted Postgres tiers
  // (Neon et al.) cap concurrent connections. Use the *pooled* endpoint
  // when your provider offers one.
  const pool = new Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  const runner: PgRunner = {
    query: async (statement, params) =>
      (await pool.query(statement, params)) as unknown as {
        rows: Record<string, unknown>[];
      },
  };
  await applyPgMigrations(runner);
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const d = drizzle(pool, { schema: pgSchema }) as unknown as PgAppDb;
  await ensureDemoDataPg(d);
  await ensureStoryPromptsPg(d);
  await bootSweepUploadsPg(d);
  return d;
}

/* ------------------------------------------------------------------ */
/* The one `db` everyone imports                                       */
/* ------------------------------------------------------------------ */

/** The app's declared client type (SQLite-shaped; see the docblock above). */
export type AppDb = ReturnType<typeof makeSqliteDb>;

let db: AppDb;

if (DB_DRIVER === "sqlite") {
  db = makeSqliteDb();
} else {
  // Top-level await: every importer sees `db` only after migrations + seed.
  // The promise is cached across dev-server hot reloads.
  const g = globalThis as typeof globalThis & {
    __famlinkPgInit?: Promise<PgAppDb>;
  };
  const init =
    DB_DRIVER === "pglite"
      ? (g.__famlinkPgInit ??= initPglite())
      : (g.__famlinkPgInit ??= initPostgres(PG_URL as string));
  db = (await init) as unknown as AppDb;
}

export { db };
export * as tables from "./schema";
