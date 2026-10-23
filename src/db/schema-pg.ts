import {
  boolean,
  doublePrecision,
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
    visibility: text("visibility", {
      enum: ["private", "public"],
    })
      .notNull()
      .default("private"),
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
    scopePersonId: text("scope_person_id").references(() => persons.id, { onDelete: "set null" }),
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
    scopePersonId: text("scope_person_id").references(() => persons.id, { onDelete: "set null" }),
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
    scopePersonId: text("scope_person_id").references(() => persons.id, { onDelete: "set null" }),
  },
  (t) => [index("tree_invites_tree_idx").on(t.treeId)],
);

export const treeSuggestions = pgTable(
  "tree_suggestions",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["edit_person", "add_relative"],
    }).notNull(),
    relation: text("relation", {
      enum: ["father", "mother", "spouse", "child"],
    }),
    payloadJson: text("payload_json").notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    status: text("status", {
      enum: ["pending", "accepted", "rejected"],
    })
      .notNull()
      .default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
  },
  (t) => [
    index("tree_suggestions_tree_idx").on(t.treeId),
    index("tree_suggestions_person_idx").on(t.personId),
  ],
);


export const labelDefs = pgTable(
  "label_defs",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("label_defs_tree_name_idx").on(t.treeId, t.name),
    index("label_defs_tree_idx").on(t.treeId),
  ],
);

export const personLabels = pgTable(
  "person_labels",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labelDefs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("person_labels_person_label_idx").on(t.personId, t.labelId),
    index("person_labels_label_idx").on(t.labelId),
    index("person_labels_person_idx").on(t.personId),
  ],
);

export const memoryLabels = pgTable(
  "memory_labels",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labelDefs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memory_labels_memory_label_idx").on(t.memoryId, t.labelId),
    index("memory_labels_label_idx").on(t.labelId),
  ],
);

export const customFieldDefs = pgTable(
  "custom_field_defs",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: ["text", "number", "date", "select"],
    }).notNull(),
    optionsJson: text("options_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("custom_field_defs_tree_name_idx").on(t.treeId, t.name),
    index("custom_field_defs_tree_idx").on(t.treeId),
  ],
);

export const personCustomValues = pgTable(
  "person_custom_values",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => customFieldDefs.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("person_custom_values_person_field_idx").on(t.personId, t.fieldId),
    index("person_custom_values_field_idx").on(t.fieldId),
    index("person_custom_values_person_idx").on(t.personId),
  ],
);

export const memoryCustomValues = pgTable(
  "memory_custom_values",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => customFieldDefs.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memory_custom_values_memory_field_idx").on(t.memoryId, t.fieldId),
    index("memory_custom_values_field_idx").on(t.fieldId),
  ],
);

export const personEvents = pgTable(
  "person_events",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["birth", "death", "marriage", "divorce", "relocation", "custom"],
    }).notNull(),
    dateText: text("date_text"),
    placeText: text("place_text"),
    note: text("note"),
    source: text("source"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("person_events_person_idx").on(t.personId),
    index("person_events_person_kind_idx").on(t.personId, t.kind),
  ],
);

/**
 * Geocode cache — optional lat/lng keyed by normalized place text.
 * Mirrors schema.ts placeGeocodes exactly (schema-parity.test.ts).
 */
export const placeGeocodes = pgTable(
  "place_geocodes",
  {
    id: text("id").primaryKey(),
    placeKey: text("place_key").notNull().unique(),
    placeText: text("place_text").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    displayName: text("display_name"),
    source: text("source"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("place_geocodes_key_idx").on(t.placeKey)],
);

/**
 * Activity feed — who changed what, when. Mirrors schema.ts activityFeed
 * exactly (schema-parity.test.ts).
 */
export const activityFeed = pgTable(
  "activity_feed",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    action: text("action", {
      enum: [
        "add_person",
        "add_relationship",
        "update_person",
        "delete_person",
        "add_memory",
        "delete_memory",
        "add_event",
        "update_event",
        "delete_event",
        "invite",
        "share",
        "undo",
      ],
    }).notNull(),
    targetType: text("target_type", {
      enum: ["person", "memory", "event", "invite", "share_link", "tree"],
    }).notNull(),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    detailJson: text("detail_json").notNull().default("{}"),
    undoable: boolean("undoable").notNull().default(false),
    undoneAt: timestamp("undone_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_feed_tree_idx").on(t.treeId),
    index("activity_feed_tree_created_idx").on(t.treeId, t.createdAt),
  ],
);

export type PgLabelDef = typeof labelDefs.$inferSelect;
export type PgPersonLabel = typeof personLabels.$inferSelect;
export type PgMemoryLabel = typeof memoryLabels.$inferSelect;
export type PgCustomFieldDef = typeof customFieldDefs.$inferSelect;
export type PgPersonCustomValue = typeof personCustomValues.$inferSelect;
export type PgMemoryCustomValue = typeof memoryCustomValues.$inferSelect;
export type PgPersonEvent = typeof personEvents.$inferSelect;
export type PgPlaceGeocode = typeof placeGeocodes.$inferSelect;
export type PgActivityFeed = typeof activityFeed.$inferSelect;


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
export type PgTreeSuggestion = typeof treeSuggestions.$inferSelect;
