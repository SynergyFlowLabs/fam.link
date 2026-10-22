/**
 * Seeds a demo account with a rich family tree (the landing-page hero family).
 * Idempotent: wipes and re-creates the demo user.
 *
 *   node scripts/seed-demo.mjs
 *
 * Demo login: demo@fam.link / demo1234
 */
import Database from "better-sqlite3";
import { randomUUID, scryptSync, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
const db = new Database(path.join(process.cwd(), "data", "app.db"));
db.pragma("foreign_keys = ON");

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// --- wipe demo user (cascades trees, persons, unions, memories) --------------
db.prepare("DELETE FROM users WHERE email = ?").run("demo@fam.link");

const now = Date.now();
const userId = randomUUID();
db.prepare(
  "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
).run(userId, "demo@fam.link", "Ali Raza", hashPassword("demo1234"), now);

const treeId = randomUUID();
const insertTree = db.prepare(
  "INSERT INTO trees (id, owner_id, name, description, focus_person_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
);
const insertPerson = db.prepare(
  `INSERT INTO persons (id, tree_id, first_name, last_name, also_known_as, gender, living,
    birth_date_text, birth_place, death_date_text, death_place, notes, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertUnion = db.prepare(
  `INSERT INTO unions (id, tree_id, partner_a_id, partner_b_id, status, date_text, place_text, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertLink = db.prepare(
  "INSERT INTO parent_child (id, union_id, child_id, relation) VALUES (?, ?, ?, ?)",
);
const insertMemory = db.prepare(
  `INSERT INTO memories (id, person_id, kind, body, occurred_text, author_name, created_at)
   VALUES (?, ?, 'text', ?, ?, ?, ?)`,
);

const P = (fields) => {
  const id = randomUUID();
  insertPerson.run(
    id, treeId,
    fields.firstName ?? null, fields.lastName ?? null, fields.aka ?? null,
    fields.gender ?? null, fields.living === false ? 0 : 1,
    fields.birth ?? null, fields.birthPlace ?? null,
    fields.living === false ? (fields.death ?? null) : null,
    fields.living === false ? (fields.deathPlace ?? null) : null,
    fields.notes ?? null, now, now,
  );
  return id;
};

const U = (a, b, status, date, place) => {
  const id = randomUUID();
  insertUnion.run(id, treeId, a, b, status ?? null, date ?? null, place ?? null, now);
  return id;
};

const L = (u, child) => insertLink.run(randomUUID(), u, child, "biological");
const M = (person, body, when, author) =>
  insertMemory.run(randomUUID(), person, body, when ?? null, author ?? null, now);

// --- the family ---
insertTree.run(treeId, userId, "The Raza–Khan family", "A demo tree — edit, add to, or delete it. It's yours to play with.", null, now, now);
const gg = P({ firstName: null, lastName: null, gender: "m", living: false, birth: "c. 1885", birthPlace: "near Jalandhar, Punjab", death: "?", notes: "Dada Yusuf's father. Name lost — the family left everything in 1947." });
const yusuf = P({ firstName: "Yusuf", lastName: "Khan", gender: "m", living: false, birth: "1918", birthPlace: "Jalandhar", death: "2004", deathPlace: "Lahore" });
const amna = P({ firstName: "Amna", lastName: "Begum", aka: "Dadi", gender: "f", living: false, birth: "1922", birthPlace: "Amritsar", death: "1998", deathPlace: "Lahore" });
const kareem = P({ firstName: "Kareem", lastName: "Qureshi", aka: "Nana", gender: "m", living: false, birth: "1925", death: "2011", deathPlace: "Karachi" });
const zainab = P({ firstName: "Zainab", lastName: "Qureshi", aka: "Nani", gender: "f", living: false, birth: "1930", death: "2019" });
const ahmed = P({ firstName: "Ahmed", lastName: "Khan", aka: "Abbu", gender: "m", birth: "1952", birthPlace: "Lahore" });
const farida = P({ firstName: "Farida", lastName: "Khan", aka: "Ami", gender: "f", birth: "1955", birthPlace: "Karachi" });
const sara = P({ firstName: "Sara", lastName: "Khan", gender: "f", birth: "1984" });
const ali = P({ firstName: "Ali", lastName: "Raza", gender: "m", birth: "1989", notes: "The one building this tree." });
const bilal = P({ firstName: "Bilal", lastName: "Khan", gender: "m", birth: "1992" });
const maryam = P({ firstName: "Maryam", lastName: "Raza", gender: "f", birth: "1991" });
const zoya = P({ firstName: "Zoya", lastName: "Raza", gender: "f", birth: "2019" });

const uGG = U(gg, null);
const uGrand1 = U(yusuf, amna, "married", "c. 1944", "Lahore");
const uGrand2 = U(kareem, zainab, "married", "c. 1950");
const uParents = U(ahmed, farida, "married", "1979");
const uAli = U(ali, maryam, "married", "2016");

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
M(ali, "Grandmother Amna's tandoor rotis are the reason I started writing all this down. Food is memory.", "2024");

db.prepare("UPDATE trees SET focus_person_id = ? WHERE id = ?").run(ali, treeId);

db.prepare("UPDATE trees SET focus_person_id = ? WHERE id = ?").run(ali, treeId);

console.log("Seeded demo account:");
console.log("  email:    demo@fam.link");
console.log("  password: demo1234");
console.log("  tree id: ", treeId);
console.log(`  ${db.prepare("SELECT COUNT(*) c FROM persons").get().c} people in DB`);
