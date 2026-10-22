import { PGlite } from "@electric-sql/pglite";
const db = new PGlite("data/app-pg.db");
const q = async (s) => (await db.query(s)).rows;
console.log("tables:", (await q("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r => r.tablename).join(","));
console.log("migrations:", (await q("SELECT name FROM __migrations")).map(r => r.name).join(","));
console.log("users:", await q("SELECT id, email FROM users"));
console.log("persons:", (await q("SELECT COUNT(*)::int c FROM persons"))[0].c,
  "| unions:", (await q("SELECT COUNT(*)::int c FROM unions"))[0].c,
  "| links:", (await q("SELECT COUNT(*)::int c FROM parent_child"))[0].c,
  "| memories:", (await q("SELECT COUNT(*)::int c FROM memories"))[0].c);
console.log("living booleans ok:", (await q("SELECT first_name FROM persons WHERE living = true ORDER BY id LIMIT 3")).map(r=>r.first_name).join(","));
console.log("timestamps:", JSON.stringify(await q("SELECT created_at FROM trees LIMIT 1")));
