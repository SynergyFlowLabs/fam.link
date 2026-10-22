import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableConfig as sqliteTableConfig } from "drizzle-orm/sqlite-core";
import { getTableConfig as pgTableConfig } from "drizzle-orm/pg-core";
import * as sqlite from "./schema.ts";
import * as pg from "./schema-pg.ts";
import type {
  Memory,
  Person,
  ShareLink,
  Tree,
  TreeInvite,
  TreeMember,
  Union,
  User,
  Media,
  ParentChild,
} from "./schema.ts";
import type {
  PgMemory,
  PgPerson,
  PgShareLink,
  PgTree,
  PgTreeInvite,
  PgTreeMember,
  PgUnion,
  PgUser,
  PgMedia,
  PgParentChild,
} from "./schema-pg.ts";

/**
 * The Postgres port runs through the same `db` handle, typed as the SQLite
 * client. That only works while the two schemas stay in lockstep: same
 * tables, same column names (and order), and row types assignable BOTH
 * ways (SQLite timestamp_ms ↔ Postgres timestamp both surface Date;
 * SQLite boolean-mode integer ↔ Postgres boolean both surface boolean).
 * This test is the lock.
 */

const SQLITE_TABLES = {
  users: sqlite.users,
  sessions: sqlite.sessions,
  trees: sqlite.trees,
  persons: sqlite.persons,
  unions: sqlite.unions,
  parentChild: sqlite.parentChild,
  media: sqlite.media,
  memories: sqlite.memories,
  shareLinks: sqlite.shareLinks,
  pendingImports: sqlite.pendingImports,
  treeMembers: sqlite.treeMembers,
  treeInvites: sqlite.treeInvites,
} as const;

const PG_TABLES = {
  users: pg.users,
  sessions: pg.sessions,
  trees: pg.trees,
  persons: pg.persons,
  unions: pg.unions,
  parentChild: pg.parentChild,
  media: pg.media,
  memories: pg.memories,
  shareLinks: pg.shareLinks,
  pendingImports: pg.pendingImports,
  treeMembers: pg.treeMembers,
  treeInvites: pg.treeInvites,
} as const;

describe("schema parity (sqlite ↔ postgres)", () => {
  for (const name of Object.keys(SQLITE_TABLES) as (keyof typeof SQLITE_TABLES)[]) {
    it(`${name}: same table name and column names in order`, () => {
      const sl = sqliteTableConfig(SQLITE_TABLES[name] as never);
      const p = pgTableConfig(PG_TABLES[name] as never);
      assert.equal(p.name, sl.name, "table name");
      assert.deepEqual(
        p.columns.map((c) => c.name),
        sl.columns.map((c) => c.name),
        "column names (order included)",
      );
    });
  }

  it("every sqlite table has a pg twin (and vice versa)", () => {
    const slNames = Object.values(SQLITE_TABLES).map(
      (t) => sqliteTableConfig(t as never).name,
    );
    const pgNames = Object.values(PG_TABLES).map(
      (t) => pgTableConfig(t as never).name,
    );
    assert.deepEqual([...pgNames].sort(), [...slNames].sort());
  });
});

/**
 * Compile-time row-type equivalence. These "checks" never run — tsc is the
 * test. If either direction stops assigning, `npm run build` fails.
 */
export type SchemaParityCheck = [
  // sqlite row -> pg row
  PgUser extends User ? true : never,
  User extends PgUser ? true : never,
  PgTree extends Tree ? true : never,
  Tree extends PgTree ? true : never,
  PgPerson extends Person ? true : never,
  Person extends PgPerson ? true : never,
  PgUnion extends Union ? true : never,
  Union extends PgUnion ? true : never,
  PgParentChild extends ParentChild ? true : never,
  ParentChild extends PgParentChild ? true : never,
  PgMedia extends Media ? true : never,
  Media extends PgMedia ? true : never,
  PgMemory extends Memory ? true : never,
  Memory extends PgMemory ? true : never,
  PgShareLink extends ShareLink ? true : never,
  ShareLink extends PgShareLink ? true : never,
  PgTreeMember extends TreeMember ? true : never,
  TreeMember extends PgTreeMember ? true : never,
  PgTreeInvite extends TreeInvite ? true : never,
  TreeInvite extends PgTreeInvite ? true : never,
];
