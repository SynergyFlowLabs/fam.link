import { sqliteTable, text, integer, index, uniqueIndex, real } from "drizzle-orm/sqlite-core";
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
    /**
     * "private" (default): only the owner, invited members and share-link
     * holders. "public": listed on /explore and readable by anyone —
     * the mode for trees of people in history, which the community can
     * help improve through suggestions the owner curates.
     */
    visibility: text("visibility", {
      enum: ["private", "public"],
    })
      .notNull()
      .default("private"),
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
    // Audio clips only (voice memories, issue #36) — seconds, rounded.
    durationSeconds: integer("duration_seconds"),
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
    authorName: text("author_name"), // display name (may not have an account)
    // The account that wrote it, if any. Commenters may delete their own
    // memories even though they can't touch the rest of the tree.
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    mediaId: text("media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("memories_person_idx").on(t.personId)],
);

/**
 * Share links — read-only public URLs for a tree.
 *
 * A token-holder can view the tree at /share/[token] with living persons
 * redacted. Revoking sets revokedAt (rows are kept for audit).
 */
export const shareLinks = sqliteTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(), // unguessable, in the URL
    label: text("label"), // e.g. "WhatsApp cousins group"
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    scopePersonId: text("scope_person_id").references(() => persons.id, { onDelete: "set null" }),
  },
  (t) => [index("share_links_tree_idx").on(t.treeId)],
);

/**
 * Ask-a-relative links (issue #35): one question, one shareable URL, one
 * answer — the Knowledge Holder contributes a memory with no account.
 * Tokens are CSPRNG base64url; links expire (default 30 days) and can be
 * revoked (row kept for audit, like share_links).
 */
export const askLinks = sqliteTable(
  "ask_links",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    token: text("token").notNull().unique(), // unguessable, in the URL
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("ask_links_tree_idx").on(t.treeId)],
);

export type AskLink = typeof askLinks.$inferSelect;

/**
 * A staged-but-unconfirmed GEDCOM import. The parsed plan is stored as JSON;
 * nothing touches persons/unions until the owner confirms on the review
 * screen. One pending import per tree (a new upload replaces it).
 */
export const pendingImports = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("pending_imports_tree_idx").on(t.treeId)],
);


/**
 * Collaborators on a tree — the people the owner invited in.
 *
 * A member's `role` is one of viewer / commenter / editor (see src/lib/roles.ts
 * for the one definition of what each role may do). The owner is NOT a row
 * here: ownership lives on `trees.ownerId` and outranks every member role.
 */
export const treeMembers = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    scopePersonId: text("scope_person_id").references(() => persons.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("tree_members_tree_user_idx").on(t.treeId, t.userId),
    index("tree_members_user_idx").on(t.userId),
  ],
);

/**
 * Invite links — how family members join a tree with a role.
 *
 * Like share links: an unguessable token in the URL, revocable at any time.
 * A link is multi-use until revoked (families forward one link to the whole
 * group); whoever opens it while signed in joins as `role`. The owner curates
 * afterwards (change role / remove) on the members page.
 */
export const treeInvites = sqliteTable(
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
    label: text("label"), // e.g. "Cousins WhatsApp group"
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    scopePersonId: text("scope_person_id").references(() => persons.id, { onDelete: "set null" }),
  },
  (t) => [
    index("tree_invites_tree_idx").on(t.treeId),
  ],
);


/**
 * A proposed improvement to a public tree — "edit/updates requests".
 *
 * Anyone signed in (except those who can already edit directly) can
 * suggest; the owner and invited editors curate the queue. Types:
 *  - edit_person: corrected facts for `personId` (payload = person fields)
 *  - add_relative: a missing relative of `personId` (relation + fields)
 */
export const treeSuggestions = sqliteTable(
  "tree_suggestions",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    // the person an edit targets / a new relative hangs off
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
    note: text("note"), // why the change, per contribution etiquette
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    status: text("status", {
      enum: ["pending", "accepted", "rejected"],
    })
      .notNull()
      .default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("tree_suggestions_tree_idx").on(t.treeId),
    index("tree_suggestions_person_idx").on(t.personId),
  ],
);


/**
 * Labels — lightweight classification for people and memories.
 * A label definition lives per tree (e.g. "Immigrant", "Veteran"); instances
 * are attached via junction tables so filtering is a simple join.
 */
export const labelDefs = sqliteTable(
  "label_defs",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("label_defs_tree_name_idx").on(t.treeId, t.name),
    index("label_defs_tree_idx").on(t.treeId),
  ],
);

export const personLabels = sqliteTable(
  "person_labels",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labelDefs.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("person_labels_person_label_idx").on(t.personId, t.labelId),
    index("person_labels_label_idx").on(t.labelId),
    index("person_labels_person_idx").on(t.personId),
  ],
);

export const memoryLabels = sqliteTable(
  "memory_labels",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labelDefs.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("memory_labels_memory_label_idx").on(t.memoryId, t.labelId),
    index("memory_labels_label_idx").on(t.labelId),
  ],
);

/**
 * Custom field definitions — tree-scoped metadata slots (text, number, date,
 * select). Values live in person_custom_values / memory_custom_values.
 */
export const customFieldDefs = sqliteTable(
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
    // "shared" = every member sees it; "private" = owner only (issue #33).
    visibility: text("visibility", { enum: ["shared", "private"] })
      .notNull()
      .default("shared"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("custom_field_defs_tree_name_idx").on(t.treeId, t.name),
    index("custom_field_defs_tree_idx").on(t.treeId),
  ],
);

export const personCustomValues = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("person_custom_values_person_field_idx").on(t.personId, t.fieldId),
    index("person_custom_values_field_idx").on(t.fieldId),
    index("person_custom_values_person_idx").on(t.personId),
  ],
);

export const memoryCustomValues = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("memory_custom_values_memory_field_idx").on(t.memoryId, t.fieldId),
    index("memory_custom_values_field_idx").on(t.fieldId),
  ],
);

/**
 * Life events per person — structured timeline entries (birth, death,
 * marriage, divorce, relocation, custom). Fuzzy dates preserved verbatim;
 * ordering is best-effort via helper in src/lib/person-events.ts.
 * Source citation (“how do you know?”) is a free-text provenance field.
 */
export const personEvents = sqliteTable(
  "person_events",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["birth", "death", "marriage", "divorce", "relocation", "custom"],
    }).notNull(),
    // Fuzzy, user-typed (e.g. "c. 1947", "Eid 1994", "before Partition")
    dateText: text("date_text"),
    placeText: text("place_text"),
    note: text("note"),
    // Lightweight provenance — FamilySearch-style source citation
    source: text("source"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("person_events_person_idx").on(t.personId),
    index("person_events_person_kind_idx").on(t.personId, t.kind),
  ],
);

/**
 * Geocode cache — optional lat/lng for place texts, keyed by the normalized
 * place string (see src/lib/places.ts normalizePlaceKey). Places themselves
 * stay free-form fuzzy text; this table is additive and never required:
 * a place without a row simply has no pin on the map. Rows are written only
 * by the best-effort geocode server action (src/actions/geocode.ts) — never
 * user-entered.
 */
export const placeGeocodes = sqliteTable(
  "place_geocodes",
  {
    id: text("id").primaryKey(),
    placeKey: text("place_key").notNull().unique(),
    // Last-seen original text (display fallback; not canonical)
    placeText: text("place_text").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    // Geocoder's full display name, e.g. "Lahore, Punjab, Pakistan"
    displayName: text("display_name"),
    // e.g. "nominatim" — provenance of the coordinates
    source: text("source"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("place_geocodes_key_idx").on(t.placeKey)],
);


/**
 * Activity feed — who changed what, when (issue #31, P3.1).
 *
 * Every tree mutation writes one row after success (best-effort: a feed
 * failure must never fail the mutation). `detail_json` carries the human
 * summary and, for undoable actions, the snapshot needed to reverse them.
 * Undo writes its own `undo` row and stamps `undone_at` on the original.
 */
export const activityFeed = sqliteTable(
  "activity_feed",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Display-name snapshot — survives account deletion.
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
        "add_comment",
        "delete_comment",
        "resolve_comment",
        "suggest",
        "review_suggestion",
        "ask",
        "undo",
      ],
    }).notNull(),
    targetType: text("target_type", {
      enum: ["person", "memory", "event", "invite", "share_link", "tree"],
    }).notNull(),
    targetId: text("target_id"),
    // Snapshot of the target's display name for links (rows may vanish).
    targetLabel: text("target_label"),
    detailJson: text("detail_json").notNull().default("{}"),
    undoable: integer("undoable", { mode: "boolean" }).notNull().default(false),
    undoneAt: integer("undone_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("activity_feed_tree_idx").on(t.treeId),
    index("activity_feed_tree_created_idx").on(t.treeId, t.createdAt),
  ],
);

/**
 * Comment threads on a person or a memory — the discussion layer
 * (issue #32). One level of threading: `parent_id` always points at the
 * ROOT comment, and resolution lives on the root. Polymorphic target, so
 * `target_id` has no FK — person/memory deletion sweeps matching rows.
 */
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["person", "memory"] }).notNull(),
    targetId: text("target_id").notNull(),
    // The account that wrote it (null for deleted accounts — the name
    // snapshot below keeps the thread readable).
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    // Root comment id for replies (null on top-level comments).
    parentId: text("parent_id"),
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedByName: text("resolved_by_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId),
    index("comments_tree_created_idx").on(t.treeId, t.createdAt),
  ],
);

export type Comment = typeof comments.$inferSelect;
export type LabelDef = typeof labelDefs.$inferSelect;
export type PersonLabel = typeof personLabels.$inferSelect;
export type MemoryLabel = typeof memoryLabels.$inferSelect;
export type CustomFieldDef = typeof customFieldDefs.$inferSelect;
export type PersonCustomValue = typeof personCustomValues.$inferSelect;
export type MemoryCustomValue = typeof memoryCustomValues.$inferSelect;
export type PersonEvent = typeof personEvents.$inferSelect;

export type User = typeof users.$inferSelect;
export type Tree = typeof trees.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type Union = typeof unions.$inferSelect;
export type ParentChild = typeof parentChild.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Media = typeof media.$inferSelect;
export type PersonEventRow = typeof personEvents.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type TreeMember = typeof treeMembers.$inferSelect;
export type TreeInvite = typeof treeInvites.$inferSelect;
export type TreeSuggestion = typeof treeSuggestions.$inferSelect;
export type PlaceGeocode = typeof placeGeocodes.$inferSelect;
export type ActivityFeed = typeof activityFeed.$inferSelect;
