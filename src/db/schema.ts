import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * fam.link data model
 *
 * Invariants (see AGENTS.md):
 * - One human = one row in `persons`. The genealogy graph is a DAG: a person
 *   can be reachable via multiple paths (pedigree collapse from cousin
 *   marriages) and is NEVER duplicated.
 * - All dates are fuzzy: user-typed text (`birth_date_text`, "c. 1947",
 *   "before Partition"). Parsed years are additive columns, never required.
 * - A person with no name is a legal "unknown ancestor" placeholder.
 *
 * The model is kept GEDCOM-richer: unions carry status/place, parent-child
 * links carry relation kind, memories are first-class.
 *
 * IDs are app-generated UUID strings so the schema ports to Postgres later.
 * Timestamps are epoch milliseconds (integer) for the same reason.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // sha256 of the cookie token — the raw token never touches the DB
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const trees = sqliteTable(
  "trees",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // The person the canvas roots on. No FK constraint (would be circular
    // with persons.tree_id); enforced at the application layer.
    focusPersonId: text("focus_person_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("trees_owner_idx").on(t.ownerId)],
);

export const persons = sqliteTable(
  "persons",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    // All name parts nullable: "unknown ancestor" placeholders are legal.
    firstName: text("first_name"),
    lastName: text("last_name"),
    alsoKnownAs: text("also_known_as"),
    gender: text("gender", { enum: ["m", "f", "x"] }),
    living: integer("living", { mode: "boolean" }).notNull().default(true),
    // Fuzzy, user-typed, stored as-is:
    birthDateText: text("birth_date_text"),
    birthPlace: text("birth_place"),
    deathDateText: text("death_date_text"),
    deathPlace: text("death_place"),
    notes: text("notes"),
    photoMediaId: text("photo_media_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("persons_tree_idx").on(t.treeId)],
);

/**
 * A union is a marriage or partnership (or implicit co-parenting).
 * partnerB is nullable: single-parent branches are first-class.
 * Multiple spouses of one person = multiple union rows.
 */
export const unions = sqliteTable(
  "unions",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    partnerAId: text("partner_a_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    partnerBId: text("partner_b_id").references(() => persons.id, {
      onDelete: "cascade",
    }),
    status: text("status", {
      enum: ["married", "partners", "divorced", "separated", "widowed"],
    }),
    dateText: text("date_text"),
    placeText: text("place_text"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("unions_tree_idx").on(t.treeId),
    index("unions_partner_a_idx").on(t.partnerAId),
    index("unions_partner_b_idx").on(t.partnerBId),
  ],
);

/** Children attach to unions, so two parents share one link. */
export const parentChild = sqliteTable(
  "parent_child",
  {
    id: text("id").primaryKey(),
    unionId: text("union_id")
      .notNull()
      .references(() => unions.id, { onDelete: "cascade" }),
    childId: text("child_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    relation: text("relation", {
      enum: ["biological", "adoptive", "step", "foster"],
    })
      .notNull()
      .default("biological"),
  },
  (t) => [
    index("parent_child_union_idx").on(t.unionId),
    uniqueIndex("parent_child_union_child_idx").on(t.unionId, t.childId),
  ],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    path: text("path").notNull(), // relative under data/uploads/
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("media_tree_idx").on(t.treeId)],
);

/** The story layer: date-stamped memories attached to any person. */
export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["text", "photo", "voice"] })
      .notNull()
      .default("text"),
    body: text("body").notNull(), // the story text (or caption for photo/voice)
    occurredText: text("occurred_text"), // fuzzy "when was this?" e.g. "Eid 1994"
    authorName: text("author_name"), // who remembers (may not have an account)
    mediaId: text("media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("memories_person_idx").on(t.personId)],
);

export type User = typeof users.$inferSelect;
export type Tree = typeof trees.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type Union = typeof unions.$inferSelect;
export type ParentChild = typeof parentChild.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Media = typeof media.$inferSelect;
