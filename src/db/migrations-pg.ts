/**
 * Embedded Postgres migrations — the pg twin of `migrations.ts`.
 *
 * No Postgres database has ever existed, so a single idempotent baseline
 * (everything through the SQLite 0003 state) is correct and simplest. New
 * migrations from here on must be added to BOTH files (the parity test in
 * schema-parity.test.ts watches the schemas; the E2E watches the SQL).
 *
 * Applied by db/index.ts when a Postgres driver is selected. Statement-per-
 * entry (node-postgres executes one statement per query call).
 */
export const PG_MIGRATIONS: { name: string; statements: string[] }[] = [
  {
    name: "0000_pg_baseline",
    statements: [
      `CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "password_hash" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email")`,
      `CREATE TABLE IF NOT EXISTS "sessions" (
        "token_hash" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id")`,
      `CREATE TABLE IF NOT EXISTS "trees" (
        "id" text PRIMARY KEY NOT NULL,
        "owner_id" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "focus_person_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "trees_owner_idx" ON "trees" ("owner_id")`,
      `CREATE TABLE IF NOT EXISTS "persons" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "first_name" text,
        "last_name" text,
        "also_known_as" text,
        "gender" text,
        "living" boolean DEFAULT true NOT NULL,
        "birth_date_text" text,
        "birth_place" text,
        "death_date_text" text,
        "death_place" text,
        "notes" text,
        "photo_media_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "persons_tree_idx" ON "persons" ("tree_id")`,
      `CREATE TABLE IF NOT EXISTS "unions" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "partner_a_id" text NOT NULL,
        "partner_b_id" text,
        "status" text,
        "date_text" text,
        "place_text" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "unions_tree_idx" ON "unions" ("tree_id")`,
      `CREATE INDEX IF NOT EXISTS "unions_partner_a_idx" ON "unions" ("partner_a_id")`,
      `CREATE INDEX IF NOT EXISTS "unions_partner_b_idx" ON "unions" ("partner_b_id")`,
      `CREATE TABLE IF NOT EXISTS "parent_child" (
        "id" text PRIMARY KEY NOT NULL,
        "union_id" text NOT NULL,
        "child_id" text NOT NULL,
        "relation" text DEFAULT 'biological' NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "parent_child_union_idx" ON "parent_child" ("union_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "parent_child_union_child_idx" ON "parent_child" ("union_id","child_id")`,
      `CREATE TABLE IF NOT EXISTS "media" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "path" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" integer NOT NULL,
        "uploaded_by" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "media_tree_idx" ON "media" ("tree_id")`,
      `CREATE TABLE IF NOT EXISTS "memories" (
        "id" text PRIMARY KEY NOT NULL,
        "person_id" text NOT NULL,
        "kind" text DEFAULT 'text' NOT NULL,
        "body" text NOT NULL,
        "occurred_text" text,
        "author_name" text,
        "author_user_id" text,
        "media_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "memories_person_idx" ON "memories" ("person_id")`,
      `CREATE TABLE IF NOT EXISTS "share_links" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "token" text NOT NULL,
        "label" text,
        "created_by" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "revoked_at" timestamp
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "share_links_token_unique" ON "share_links" ("token")`,
      `CREATE INDEX IF NOT EXISTS "share_links_tree_idx" ON "share_links" ("tree_id")`,
      `CREATE TABLE IF NOT EXISTS "pending_imports" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "uploaded_by" text,
        "file_name" text NOT NULL,
        "plan_json" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "pending_imports_tree_idx" ON "pending_imports" ("tree_id")`,
      `CREATE TABLE IF NOT EXISTS "tree_members" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "user_id" text NOT NULL,
        "role" text NOT NULL,
        "invited_by" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tree_members_tree_user_idx" ON "tree_members" ("tree_id","user_id")`,
      `CREATE INDEX IF NOT EXISTS "tree_members_user_idx" ON "tree_members" ("user_id")`,
      `CREATE TABLE IF NOT EXISTS "tree_invites" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "token" text NOT NULL,
        "role" text NOT NULL,
        "label" text,
        "created_by" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "revoked_at" timestamp
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tree_invites_token_unique" ON "tree_invites" ("token")`,
      `CREATE INDEX IF NOT EXISTS "tree_invites_tree_idx" ON "tree_invites" ("tree_id")`,
      // Foreign keys (added separately so re-running never re-declares them
      // inline; CREATE TABLE IF NOT EXISTS bodies above carry no REFERENCES
      // for the same reason — the ALTERs below are guarded by DO blocks).
      `DO $$ BEGIN
         ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
           FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "trees" ADD CONSTRAINT "trees_owner_id_users_id_fk"
           FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "persons" ADD CONSTRAINT "persons_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "unions" ADD CONSTRAINT "unions_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "unions" ADD CONSTRAINT "unions_partner_a_id_persons_id_fk"
           FOREIGN KEY ("partner_a_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "unions" ADD CONSTRAINT "unions_partner_b_id_persons_id_fk"
           FOREIGN KEY ("partner_b_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_union_id_unions_id_fk"
           FOREIGN KEY ("union_id") REFERENCES "unions"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_child_id_persons_id_fk"
           FOREIGN KEY ("child_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "media" ADD CONSTRAINT "media_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk"
           FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memories" ADD CONSTRAINT "memories_person_id_persons_id_fk"
           FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memories" ADD CONSTRAINT "memories_author_user_id_users_id_fk"
           FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memories" ADD CONSTRAINT "memories_media_id_media_id_fk"
           FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "share_links" ADD CONSTRAINT "share_links_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk"
           FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "pending_imports" ADD CONSTRAINT "pending_imports_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "pending_imports" ADD CONSTRAINT "pending_imports_uploaded_by_users_id_fk"
           FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_user_id_users_id_fk"
           FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_invited_by_users_id_fk"
           FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_invites" ADD CONSTRAINT "tree_invites_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_invites" ADD CONSTRAINT "tree_invites_created_by_users_id_fk"
           FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ],
  },
  {
    name: "0001_public_trees",
    statements: [
      `ALTER TABLE "trees" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'private' NOT NULL`,
      `CREATE TABLE IF NOT EXISTS "tree_suggestions" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "person_id" text NOT NULL,
        "type" text NOT NULL,
        "relation" text,
        "payload_json" text NOT NULL,
        "note" text,
        "created_by" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "reviewed_by" text,
        "reviewed_at" timestamp
      )`,
      `CREATE INDEX IF NOT EXISTS "tree_suggestions_tree_idx" ON "tree_suggestions" ("tree_id")`,
      `CREATE INDEX IF NOT EXISTS "tree_suggestions_person_idx" ON "tree_suggestions" ("person_id")`,
      `DO $$ BEGIN
         ALTER TABLE "tree_suggestions" ADD CONSTRAINT "tree_suggestions_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_suggestions" ADD CONSTRAINT "tree_suggestions_person_id_persons_id_fk"
           FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_suggestions" ADD CONSTRAINT "tree_suggestions_created_by_users_id_fk"
           FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "tree_suggestions" ADD CONSTRAINT "tree_suggestions_reviewed_by_users_id_fk"
           FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE set null;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ],
  },
      {
    name: "0002_labels_custom_fields",
    statements: [
      `CREATE TABLE IF NOT EXISTS "label_defs" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "name" text NOT NULL,
        "color" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "label_defs_tree_name_idx" ON "label_defs" ("tree_id","name")`,
      `CREATE INDEX IF NOT EXISTS "label_defs_tree_idx" ON "label_defs" ("tree_id")`,
      `CREATE TABLE IF NOT EXISTS "person_labels" (
        "id" text PRIMARY KEY NOT NULL,
        "person_id" text NOT NULL,
        "label_id" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "person_labels_person_label_idx" ON "person_labels" ("person_id","label_id")`,
      `CREATE INDEX IF NOT EXISTS "person_labels_label_idx" ON "person_labels" ("label_id")`,
      `CREATE INDEX IF NOT EXISTS "person_labels_person_idx" ON "person_labels" ("person_id")`,
      `CREATE TABLE IF NOT EXISTS "memory_labels" (
        "id" text PRIMARY KEY NOT NULL,
        "memory_id" text NOT NULL,
        "label_id" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "memory_labels_memory_label_idx" ON "memory_labels" ("memory_id","label_id")`,
      `CREATE INDEX IF NOT EXISTS "memory_labels_label_idx" ON "memory_labels" ("label_id")`,
      `CREATE TABLE IF NOT EXISTS "custom_field_defs" (
        "id" text PRIMARY KEY NOT NULL,
        "tree_id" text NOT NULL,
        "name" text NOT NULL,
        "kind" text NOT NULL,
        "options_json" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "custom_field_defs_tree_name_idx" ON "custom_field_defs" ("tree_id","name")`,
      `CREATE INDEX IF NOT EXISTS "custom_field_defs_tree_idx" ON "custom_field_defs" ("tree_id")`,
      `CREATE TABLE IF NOT EXISTS "person_custom_values" (
        "id" text PRIMARY KEY NOT NULL,
        "person_id" text NOT NULL,
        "field_id" text NOT NULL,
        "value" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "person_custom_values_person_field_idx" ON "person_custom_values" ("person_id","field_id")`,
      `CREATE INDEX IF NOT EXISTS "person_custom_values_field_idx" ON "person_custom_values" ("field_id")`,
      `CREATE INDEX IF NOT EXISTS "person_custom_values_person_idx" ON "person_custom_values" ("person_id")`,
      `CREATE TABLE IF NOT EXISTS "memory_custom_values" (
        "id" text PRIMARY KEY NOT NULL,
        "memory_id" text NOT NULL,
        "field_id" text NOT NULL,
        "value" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "memory_custom_values_memory_field_idx" ON "memory_custom_values" ("memory_id","field_id")`,
      `CREATE INDEX IF NOT EXISTS "memory_custom_values_field_idx" ON "memory_custom_values" ("field_id")`,
      `DO $$ BEGIN
         ALTER TABLE "label_defs" ADD CONSTRAINT "label_defs_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "person_labels" ADD CONSTRAINT "person_labels_person_id_persons_id_fk"
           FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "person_labels" ADD CONSTRAINT "person_labels_label_id_label_defs_id_fk"
           FOREIGN KEY ("label_id") REFERENCES "label_defs"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memory_labels" ADD CONSTRAINT "memory_labels_memory_id_memories_id_fk"
           FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memory_labels" ADD CONSTRAINT "memory_labels_label_id_label_defs_id_fk"
           FOREIGN KEY ("label_id") REFERENCES "label_defs"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "custom_field_defs" ADD CONSTRAINT "custom_field_defs_tree_id_trees_id_fk"
           FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "person_custom_values" ADD CONSTRAINT "person_custom_values_person_id_persons_id_fk"
           FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "person_custom_values" ADD CONSTRAINT "person_custom_values_field_id_custom_field_defs_id_fk"
           FOREIGN KEY ("field_id") REFERENCES "custom_field_defs"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memory_custom_values" ADD CONSTRAINT "memory_custom_values_memory_id_memories_id_fk"
           FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
         ALTER TABLE "memory_custom_values" ADD CONSTRAINT "memory_custom_values_field_id_custom_field_defs_id_fk"
           FOREIGN KEY ("field_id") REFERENCES "custom_field_defs"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ],
  },
  {
    name: "0003_person_events",
    statements: [
      `CREATE TABLE IF NOT EXISTS "person_events" (
        "id" text PRIMARY KEY NOT NULL,
        "person_id" text NOT NULL,
        "kind" text NOT NULL,
        "date_text" text,
        "place_text" text,
        "note" text,
        "source" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "person_events_person_idx" ON "person_events" ("person_id")`,
      `CREATE INDEX IF NOT EXISTS "person_events_person_kind_idx" ON "person_events" ("person_id","kind")`,
      `DO $$ BEGIN
         ALTER TABLE "person_events" ADD CONSTRAINT "person_events_person_id_persons_id_fk"
           FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE cascade;
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ],
  },
];
