/**
 * Demo seed for Postgres drivers — same data (demo-data.ts), drizzle
 * insertion mechanics. Virgin-database detection is the same: zero users.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { hashPasswordSync } from "@/lib/auth-hash";
import { CURATED_PROMPTS } from "@/lib/story-prompts";
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

  for (const bundle of TREE_BUNDLES) {
    await db.insert(pg.trees).values({
      id: bundle.tree.id,
      ownerId: DEMO_USER.id,
      name: bundle.tree.name,
      description: bundle.tree.description,
      focusPersonId: bundle.tree.focusPersonId,
      visibility: bundle.tree.visibility,
    });

    await db.insert(pg.persons).values(
      bundle.persons.map((p) => ({
        id: p.id,
        treeId: bundle.tree.id,
        firstName: p.first,
        lastName: p.last,
        alsoKnownAs: p.aka ?? null,
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
      bundle.unions.map((u) => ({
        id: u.id,
        treeId: bundle.tree.id,
        partnerAId: u.a,
        partnerBId: u.b,
        status: u.status,
        dateText: u.date,
        placeText: u.place,
      })),
    );

    await db.insert(pg.parentChild).values(
      bundle.links.map((l) => ({
        id: l.id,
        unionId: l.u,
        childId: l.child,
        relation: "biological" as const,
      })),
    );

    await db.insert(pg.memories).values(
      bundle.memories.map((m) => ({
        id: m.id,
        personId: m.person,
        kind: "text" as const,
        body: m.body,
        occurredText: m.when,
        authorName: m.author,
      })),
    );
  }

  await db.insert(pg.labelDefs).values(
    DEMO_LABEL_DEFS.map((l) => ({
      id: l.id,
      treeId: l.treeId,
      name: l.name,
      color: l.color,
    })),
  );
  await db.insert(pg.personLabels).values(
    DEMO_PERSON_LABELS.map((pl) => ({
      id: pl.id,
      personId: pl.personId,
      labelId: pl.labelId,
    })),
  );
  await db.insert(pg.customFieldDefs).values(
    DEMO_CUSTOM_FIELD_DEFS.map((f) => ({
      id: f.id,
      treeId: f.treeId,
      name: f.name,
      kind: f.kind,
      optionsJson: f.optionsJson,
    })),
  );
  await db.insert(pg.personCustomValues).values(
    DEMO_PERSON_CUSTOM_VALUES.map((v) => ({
      id: v.id,
      personId: v.personId,
      fieldId: v.fieldId,
      value: v.value,
    })),
  );
  await db.insert(pg.memoryLabels).values(
    DEMO_MEMORY_LABELS.map((ml) => ({
      id: ml.id,
      memoryId: ml.memoryId,
      labelId: ml.labelId,
    })),
  );
}

/**
 * Global curated story prompts (issue #38) — idempotent, stable ids.
 */
export async function ensureStoryPromptsPg(db: PgAppDb): Promise<void> {
  await db
    .insert(pg.storyPrompts)
    .values(
      CURATED_PROMPTS.map((p, i) => ({
        id: `sp-${String(i + 1).padStart(2, "0")}`,
        treeId: null,
        prompt: p.prompt,
        category: p.category,
      })),
    )
    .onConflictDoNothing();
}
