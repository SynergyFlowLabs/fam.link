/**
 * Demo seed for Postgres drivers — same data (demo-data.ts), drizzle
 * insertion mechanics. Virgin-database detection is the same: zero users.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { hashPasswordSync } from "@/lib/auth-hash";
import {
  DEMO_LINKS,
  DEMO_MEMORIES,
  DEMO_PERSONS,
  DEMO_TREE,
  DEMO_UNIONS,
  DEMO_USER,
} from "./demo-data";
import * as pg from "./schema-pg";

export type PgAppDb = NodePgDatabase<typeof pg>;

export async function ensureDemoDataPg(db: PgAppDb): Promise<void> {
  const users = await db.$count(pg.users);
  if (users > 0) return;

  await db.insert(pg.users).values({
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    passwordHash: hashPasswordSync(DEMO_USER.password),
  });

  await db.insert(pg.trees).values({
    id: DEMO_TREE.id,
    ownerId: DEMO_USER.id,
    name: DEMO_TREE.name,
    description: DEMO_TREE.description,
    focusPersonId: DEMO_TREE.focusPersonId,
  });

  await db.insert(pg.persons).values(
    DEMO_PERSONS.map((p) => ({
      id: p.id,
      treeId: DEMO_TREE.id,
      firstName: p.first,
      lastName: p.last,
      gender: p.gender,
      living: p.living,
      birthDateText: p.birth,
      birthPlace: p.birthPlace,
      deathDateText: p.living ? null : p.death,
      deathPlace: p.living ? null : p.deathPlace,
      notes: p.notes,
    })),
  );

  await db.insert(pg.unions).values(
    DEMO_UNIONS.map((u) => ({
      id: u.id,
      treeId: DEMO_TREE.id,
      partnerAId: u.a,
      partnerBId: u.b,
      status: u.status,
      dateText: u.date,
      placeText: u.place,
    })),
  );

  await db.insert(pg.parentChild).values(
    DEMO_LINKS.map((l) => ({
      id: l.id,
      unionId: l.u,
      childId: l.child,
      relation: "biological" as const,
    })),
  );

  await db.insert(pg.memories).values(
    DEMO_MEMORIES.map((m) => ({
      id: m.id,
      personId: m.person,
      kind: "text" as const,
      body: m.body,
      occurredText: m.when,
      authorName: m.author,
    })),
  );
}
