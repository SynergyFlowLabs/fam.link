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
  DEMO_CUSTOM_FIELD_DEFS,
  DEMO_LABEL_DEFS,
  DEMO_LINKS,
  DEMO_MEMORIES,
  DEMO_MEMORY_LABELS,
  DEMO_PERSONS,
  DEMO_PERSON_CUSTOM_VALUES,
  DEMO_PERSON_LABELS,
  DEMO_TREE,
  DEMO_UNIONS,
  DEMO_USER,
  QURAISH_LINKS,
  QURAISH_MEMORIES,
  QURAISH_PERSONS,
  QURAISH_TREE,
  QURAISH_UNIONS,
  type DemoLink,
  type DemoMemory,
  type DemoPerson,
  type DemoUnion,
} from "./demo-data";

const TREE_BUNDLES: {
  tree: { id: string; name: string; description: string; focusPersonId: string; visibility: "private" | "public" };
  persons: DemoPerson[];
  unions: DemoUnion[];
  links: DemoLink[];
  memories: DemoMemory[];
}[] = [
  {
    tree: { ...DEMO_TREE, visibility: "private" as const },
    persons: DEMO_PERSONS,
    unions: DEMO_UNIONS,
    links: DEMO_LINKS,
    memories: DEMO_MEMORIES,
  },
  {
    tree: QURAISH_TREE,
    persons: QURAISH_PERSONS,
    unions: QURAISH_UNIONS,
    links: QURAISH_LINKS,
    memories: QURAISH_MEMORIES,
  },
];

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

  sqlite
    .prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId, DEMO_USER.email, DEMO_USER.name, hashPassword(DEMO_USER.password), now);

  const T = sqlite.prepare(
    `INSERT INTO trees (id, owner_id, name, description, focus_person_id, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const P = sqlite.prepare(
    `INSERT INTO persons (id, tree_id, first_name, last_name, also_known_as, gender, living,
      birth_date_text, birth_place, death_date_text, death_place, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const U = sqlite.prepare(
    `INSERT INTO unions (id, tree_id, partner_a_id, partner_b_id, status, date_text, place_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const L = sqlite.prepare(
    "INSERT INTO parent_child (id, union_id, child_id, relation) VALUES (?, ?, ?, 'biological')",
  );
  const M = sqlite.prepare(
    `INSERT INTO memories (id, person_id, kind, body, occurred_text, author_name, created_at)
     VALUES (?, ?, 'text', ?, ?, ?, ?)`,
  );
  const LD = sqlite.prepare(
    "INSERT INTO label_defs (id, tree_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const PL = sqlite.prepare(
    "INSERT INTO person_labels (id, person_id, label_id, created_at) VALUES (?, ?, ?, ?)",
  );
  const CFD = sqlite.prepare(
    "INSERT INTO custom_field_defs (id, tree_id, name, kind, options_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const PCV = sqlite.prepare(
    "INSERT INTO person_custom_values (id, person_id, field_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const ML = sqlite.prepare(
    "INSERT INTO memory_labels (id, memory_id, label_id, created_at) VALUES (?, ?, ?, ?)",
  );

  for (const bundle of TREE_BUNDLES) {
    T.run(
      bundle.tree.id,
      userId,
      bundle.tree.name,
      bundle.tree.description,
      bundle.tree.focusPersonId,
      bundle.tree.visibility,
      now,
      now,
    );
    for (const p of bundle.persons) {
      P.run(
        p.id,
        bundle.tree.id,
        p.first,
        p.last,
        p.aka ?? null,
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
    for (const u of bundle.unions) {
      U.run(u.id, bundle.tree.id, u.a, u.b, u.status, u.date, u.place, now);
    }
    for (const l of bundle.links) {
      L.run(l.id, l.u, l.child);
    }
    for (const m of bundle.memories) {
      M.run(m.id, m.person, m.body, m.when, m.author, now);
    }
  }

  for (const ld of DEMO_LABEL_DEFS) {
    LD.run(ld.id, ld.treeId, ld.name, ld.color, now);
  }
  for (const pl of DEMO_PERSON_LABELS) {
    PL.run(pl.id, pl.personId, pl.labelId, now);
  }
  for (const cfd of DEMO_CUSTOM_FIELD_DEFS) {
    CFD.run(cfd.id, cfd.treeId, cfd.name, cfd.kind, cfd.optionsJson, now);
  }
  for (const pcv of DEMO_PERSON_CUSTOM_VALUES) {
    PCV.run(pcv.id, pcv.personId, pcv.fieldId, pcv.value, now, now);
  }
  for (const ml of DEMO_MEMORY_LABELS) {
    ML.run(ml.id, ml.memoryId, ml.labelId, now);
  }
}
