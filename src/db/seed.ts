/**
 * Demo data — seeded only into virgin databases (zero users).
 *
 * On serverless (Vercel) the SQLite file lives in /tmp and resets between
 * cold starts; this seed guarantees the deployed demo always works:
 *   demo@fam.link / demo1234
 *
 * Locally it runs once on a fresh clone, then never again (the users table
 * is no longer empty). scripts/seed-demo.mjs remains the destructive
 * re-seed for development.
 */
import type Database from "better-sqlite3";
import { randomUUID, scryptSync, randomBytes } from "node:crypto";

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
  const userId = randomUUID();
  const treeId = randomUUID();

  sqlite
    .prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId, "demo@fam.link", "Ali Raza", hashPassword("demo1234"), now);

  sqlite
    .prepare(
      "INSERT INTO trees (id, owner_id, name, description, focus_person_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
    )
    .run(
      treeId,
      userId,
      "The Raza–Khan family",
      "A demo tree — edit, add to, or delete it. It's yours to play with.",
      now,
      now,
    );

  const P = (
    first: string | null,
    last: string | null,
    gender: "m" | "f" | null,
    living: boolean,
    birth: string | null,
    birthPlace: string | null,
    death: string | null,
    deathPlace: string | null,
    notes: string | null,
  ): string => {
    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO persons (id, tree_id, first_name, last_name, gender, living,
          birth_date_text, birth_place, death_date_text, death_place, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        treeId,
        first,
        last,
        gender,
        living ? 1 : 0,
        birth,
        birthPlace,
        living ? null : death,
        living ? null : deathPlace,
        notes,
        now,
        now,
      );
    return id;
  };

  const U = (a: string, b: string | null, status: string | null, date: string | null, place: string | null): string => {
    const id = randomUUID();
    sqlite
      .prepare(
        `INSERT INTO unions (id, tree_id, partner_a_id, partner_b_id, status, date_text, place_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, treeId, a, b, status, date, place, now);
    return id;
  };

  const L = (u: string, child: string) =>
    sqlite
      .prepare(
        "INSERT INTO parent_child (id, union_id, child_id, relation) VALUES (?, ?, ?, 'biological')",
      )
      .run(randomUUID(), u, child);

  const M = (person: string, body: string, when: string | null, author: string | null) =>
    sqlite
      .prepare(
        `INSERT INTO memories (id, person_id, kind, body, occurred_text, author_name, created_at)
         VALUES (?, ?, 'text', ?, ?, ?, ?)`,
      )
      .run(randomUUID(), person, body, when, author, now);

  const gg = P(null, null, "m", false, "c. 1885", "near Jalandhar, Punjab", "?", null, "Dada Yusuf's father. Name lost — the family left everything in 1947.");
  const yusuf = P("Yusuf", "Khan", "m", false, "1918", "Jalandhar", "2004", "Lahore", null);
  const amna = P("Amna", "Begum", "f", false, "1922", "Amritsar", "1998", "Lahore", null);
  const kareem = P("Kareem", "Qureshi", "m", false, "1925", null, "2011", "Karachi", null);
  const zainab = P("Zainab", "Qureshi", "f", false, "1930", null, "2019", null, null);
  const ahmed = P("Ahmed", "Khan", "m", true, "1952", "Lahore", null, null, null);
  const farida = P("Farida", "Khan", "f", true, "1955", "Karachi", null, null, null);
  const sara = P("Sara", "Khan", "f", true, "1984", null, null, null, null);
  const ali = P("Ali", "Raza", "m", true, "1989", null, null, null, "The one building this tree.");
  const bilal = P("Bilal", "Khan", "m", true, "1992", null, null, null, null);
  const maryam = P("Maryam", "Raza", "f", true, "1991", null, null, null, null);
  const zoya = P("Zoya", "Raza", "f", true, "2019", null, null, null, null);

  const uGG = U(gg, null, null, null, null);
  const uGrand1 = U(yusuf, amna, "married", "c. 1944", "Lahore");
  const uGrand2 = U(kareem, zainab, "married", "c. 1950", null);
  const uParents = U(ahmed, farida, "married", "1979", null);
  const uAli = U(ali, maryam, "married", "2016", null);

  L(uGG, yusuf);
  L(uGrand1, ahmed);
  L(uGrand2, farida);
  L(uParents, sara);
  L(uParents, ali);
  L(uParents, bilal);
  L(uAli, zoya);

  M(amna, "Her rotis were legendary — she'd slap the dough spinning and the whole lane would gather at the tandoor just to watch her hands.", "1970s", "Ahmed");
  M(yusuf, "Kept a pocket watch from Amritsar that stopped in 1947. He never fixed it — he said it kept the time he lost.", "partition", "Sara");
  M(kareem, "Never raised his voice. When the mangoes ripened he'd call every child on the street by name and hand them out from the roof.", "summers in Karachi", "Farida");
  M(zoya, "Named the family group chat 'the mango council' when she was four. It stuck.", "2023", "Ali");
  M(ali, "Grandmother Amna's tandoor rotis are the reason I started writing all this down. Food is memory.", "2024", null);

  sqlite
    .prepare("UPDATE trees SET focus_person_id = ? WHERE id = ?")
    .run(ali, treeId);
}
