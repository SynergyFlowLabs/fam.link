/**
 * Demo data — seeded only into virgin databases (zero users).
 *
 * On serverless (Vercel) the SQLite file lives in /tmp and resets between
 * cold starts; this seed guarantees the deployed demo always works:
 *   demo@fam.link / demo1234
 *
 * Locally it runs once on a fresh clone, then never again (the users table
 * is no longer empty). To reset local demo data: `rm data/app.db`.
 *
 * All IDs are FIXED strings, not random UUIDs: on serverless each instance
 * re-seeds its own ephemeral DB, and URLs generated on one instance
 * (person pages, canvas links) must resolve identically on every other
 * instance. Random IDs would 404 whenever a different instance served the
 * request.
 *
 * The DATA lives in demo-data.ts (shared with the Postgres seed); this file
 * is just the raw-SQLite insertion mechanics.
 */
import type Database from "better-sqlite3";
import { scryptSync, randomBytes } from "node:crypto";
import {
  DEMO_LINKS,
  DEMO_MEMORIES,
  DEMO_PERSONS,
  DEMO_TREE,
  DEMO_UNIONS,
  DEMO_USER,
} from "./demo-data";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function ensureDemoData(sqlite: Database.Database): void {
  const userCount = (
    sqlite.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  if (userCount > 0) return;

  const now = Date.now();
  const userId = DEMO_USER.id;
  const treeId = DEMO_TREE.id;

  sqlite
    .prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId, DEMO_USER.email, DEMO_USER.name, hashPassword(DEMO_USER.password), now);

  sqlite
    .prepare(
      "INSERT INTO trees (id, owner_id, name, description, focus_person_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      treeId,
      userId,
      DEMO_TREE.name,
      DEMO_TREE.description,
      DEMO_TREE.focusPersonId,
      now,
      now,
    );

  const P = sqlite.prepare(
    `INSERT INTO persons (id, tree_id, first_name, last_name, gender, living,
      birth_date_text, birth_place, death_date_text, death_place, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of DEMO_PERSONS) {
    P.run(
      p.id,
      treeId,
      p.first,
      p.last,
      p.gender,
      p.living ? 1 : 0,
      p.birth,
      p.birthPlace,
      p.living ? null : p.death,
      p.living ? null : p.deathPlace,
      p.notes,
      now,
      now,
    );
  }

  const U = sqlite.prepare(
    `INSERT INTO unions (id, tree_id, partner_a_id, partner_b_id, status, date_text, place_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const u of DEMO_UNIONS) {
    U.run(u.id, treeId, u.a, u.b, u.status, u.date, u.place, now);
  }

  const L = sqlite.prepare(
    "INSERT INTO parent_child (id, union_id, child_id, relation) VALUES (?, ?, ?, 'biological')",
  );
  for (const l of DEMO_LINKS) {
    L.run(l.id, l.u, l.child);
  }

  const M = sqlite.prepare(
    `INSERT INTO memories (id, person_id, kind, body, occurred_text, author_name, created_at)
     VALUES (?, ?, 'text', ?, ?, ?, ?)`,
  );
  for (const m of DEMO_MEMORIES) {
    M.run(m.id, m.person, m.body, m.when, m.author, now);
  }
}
