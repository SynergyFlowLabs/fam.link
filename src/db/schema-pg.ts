import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Postgres mirror of the SQLite schema (src/db/schema.ts).
 *
 * The app's types (`Tree`, `Person`, …) come from the SQLite schema, and
 * `src/db/schema-parity.test.ts` locks the two together: same tables, same
 * columns, and $inferSelect types must be assignable BOTH ways. Runtime
 * equivalence holds because:
 *   - SQLite `integer({ mode: "timestamp_ms" })` ↔ Postgres `timestamp`
 *     both surface JS `Date` objects
 *   - SQLite `integer({ mode: "boolean" })` ↔ Postgres `boolean`
 *   - enum-constrained `text` behaves the same in both (TS-level union)
 *
 * Postgres-native types are used where free (timestamptz, boolean); the
 * column NAMES and nullability match the SQLite schema exactly so the
 * embedded migration SQL stays a faithful mirror.
 */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const trees = pgTable(
  "trees",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    focusPersonId: text("focus_person_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("trees_owner_idx").on(t.ownerId)],
);

export const persons = pgTable(
  "persons",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    alsoKnownAs: text("also_known_as"),
    gender: text("gender", { enum: ["m", "f", "x"] }),
    living: boolean("living").notNull().default(true),
    birthDateText: text("birth_date_text"),
    birthPlace: text("birth_place"),
    deathDateText: text("death_date_text"),
    deathPlace: text("death_place"),
    notes: text("notes"),
    photoMediaId: text("photo_media_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("persons_tree_idx").on(t.treeId)],
);

export const unions = pgTable(
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("unions_tree_idx").on(t.treeId),
    index("unions_partner_a_idx").on(t.partnerAId),
    index("unions_partner_b_idx").on(t.partnerBId),
  ],
);

export const parentChild = pgTable(
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

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("media_tree_idx").on(t.treeId)],
);

export const memories = pgTable(
  "memories",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["text", "photo", "voice"] })
      .notNull()
      .default("text"),
    body: text("body").notNull(),
    occurredText: text("occurred_text"),
    authorName: text("author_name"),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    mediaId: text("media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("memories_person_idx").on(t.personId)],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    label: text("label"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("share_links_tree_idx").on(t.treeId)],
);

export const pendingImports = pgTable(
  "pending_imports",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    fileName: text("file_name").notNull(),
    planJson: text("plan_json").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("pending_imports_tree_idx").on(t.treeId)],
);

export const treeMembers = pgTable(
  "tree_members",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["viewer", "commenter", "editor"],
    }).notNull(),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tree_members_tree_user_idx").on(t.treeId, t.userId),
    index("tree_members_user_idx").on(t.userId),
  ],
);

export const treeInvites = pgTable(
  "tree_invites",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    role: text("role", {
      enum: ["viewer", "commenter", "editor"],
    }).notNull(),
    label: text("label"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("tree_invites_tree_idx").on(t.treeId)],
);

export type PgUser = typeof users.$inferSelect;
export type PgTree = typeof trees.$inferSelect;
export type PgPerson = typeof persons.$inferSelect;
export type PgUnion = typeof unions.$inferSelect;
export type PgParentChild = typeof parentChild.$inferSelect;
export type PgMemory = typeof memories.$inferSelect;
export type PgMedia = typeof media.$inferSelect;
export type PgShareLink = typeof shareLinks.$inferSelect;
export type PgTreeMember = typeof treeMembers.$inferSelect;
export type PgTreeInvite = typeof treeInvites.$inferSelect;
