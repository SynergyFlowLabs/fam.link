/**
 * The demo family — one source of truth for both seeds (SQLite raw-SQL and
 * Postgres drizzle). See src/db/seed.ts for why the IDs are FIXED strings.
 *
 * Content note: this is a Partition-era Lahore/Karachi family with fuzzy
 * dates, an unknown ancestor, and story-first memories — the product brief
 * made flesh.
 */
export interface DemoPerson {
  id: string;
  first: string | null;
  last: string | null;
  gender: "m" | "f" | null;
  living: boolean;
  birth: string | null;
  birthPlace: string | null;
  death: string | null;
  deathPlace: string | null;
  notes: string | null;
}

export interface DemoUnion {
  id: string;
  a: string;
  b: string | null;
  status: "married" | "partners" | "divorced" | "separated" | "widowed" | null;
  date: string | null;
  place: string | null;
}

export interface DemoLink {
  id: string;
  u: string;
  child: string;
}

export interface DemoMemory {
  id: string;
  person: string;
  body: string;
  when: string | null;
  author: string | null;
}

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@fam.link",
  name: "Ali Raza",
  password: "demo1234",
} as const;

export const DEMO_TREE = {
  id: "demo-tree",
  name: "The Raza–Khan family",
  description:
    "A demo tree — edit, add to, or delete it. It's yours to play with.",
  focusPersonId: "demo-p-ali",
} as const;

export const DEMO_PERSONS: DemoPerson[] = [
  { id: "demo-p-gg", first: null, last: null, gender: "m", living: false, birth: "c. 1885", birthPlace: "near Jalandhar, Punjab", death: "?", deathPlace: null, notes: "Dada Yusuf's father. Name lost — the family left everything in 1947." },
  { id: "demo-p-yusuf", first: "Yusuf", last: "Khan", gender: "m", living: false, birth: "1918", birthPlace: "Jalandhar", death: "2004", deathPlace: "Lahore", notes: null },
  { id: "demo-p-amna", first: "Amna", last: "Begum", gender: "f", living: false, birth: "1922", birthPlace: "Amritsar", death: "1998", deathPlace: "Lahore", notes: null },
  { id: "demo-p-kareem", first: "Kareem", last: "Qureshi", gender: "m", living: false, birth: "1925", birthPlace: null, death: "2011", deathPlace: "Karachi", notes: null },
  { id: "demo-p-zainab", first: "Zainab", last: "Qureshi", gender: "f", living: false, birth: "1930", birthPlace: null, death: "2019", deathPlace: null, notes: null },
  { id: "demo-p-ahmed", first: "Ahmed", last: "Khan", gender: "m", living: true, birth: "1952", birthPlace: "Lahore", death: null, deathPlace: null, notes: null },
  { id: "demo-p-farida", first: "Farida", last: "Khan", gender: "f", living: true, birth: "1955", birthPlace: "Karachi", death: null, deathPlace: null, notes: null },
  { id: "demo-p-sara", first: "Sara", last: "Khan", gender: "f", living: true, birth: "1984", birthPlace: null, death: null, deathPlace: null, notes: null },
  { id: "demo-p-ali", first: "Ali", last: "Raza", gender: "m", living: true, birth: "1989", birthPlace: null, death: null, deathPlace: null, notes: "The one building this tree." },
  { id: "demo-p-bilal", first: "Bilal", last: "Khan", gender: "m", living: true, birth: "1992", birthPlace: null, death: null, deathPlace: null, notes: null },
  { id: "demo-p-maryam", first: "Maryam", last: "Raza", gender: "f", living: true, birth: "1991", birthPlace: null, death: null, deathPlace: null, notes: null },
  { id: "demo-p-zoya", first: "Zoya", last: "Raza", gender: "f", living: true, birth: "2019", birthPlace: null, death: null, deathPlace: null, notes: null },
];

export const DEMO_UNIONS: DemoUnion[] = [
  { id: "demo-u-gg", a: "demo-p-gg", b: null, status: null, date: null, place: null },
  { id: "demo-u-grand1", a: "demo-p-yusuf", b: "demo-p-amna", status: "married", date: "c. 1944", place: "Lahore" },
  { id: "demo-u-grand2", a: "demo-p-kareem", b: "demo-p-zainab", status: "married", date: "c. 1950", place: null },
  { id: "demo-u-parents", a: "demo-p-ahmed", b: "demo-p-farida", status: "married", date: "1979", place: null },
  { id: "demo-u-ali", a: "demo-p-ali", b: "demo-p-maryam", status: "married", date: "2016", place: null },
];

export const DEMO_LINKS: DemoLink[] = [
  { id: "demo-l-gg-yusuf", u: "demo-u-gg", child: "demo-p-yusuf" },
  { id: "demo-l-grand1-ahmed", u: "demo-u-grand1", child: "demo-p-ahmed" },
  { id: "demo-l-grand2-farida", u: "demo-u-grand2", child: "demo-p-farida" },
  { id: "demo-l-parents-sara", u: "demo-u-parents", child: "demo-p-sara" },
  { id: "demo-l-parents-ali", u: "demo-u-parents", child: "demo-p-ali" },
  { id: "demo-l-parents-bilal", u: "demo-u-parents", child: "demo-p-bilal" },
  { id: "demo-l-ali-zoya", u: "demo-u-ali", child: "demo-p-zoya" },
];

export const DEMO_MEMORIES: DemoMemory[] = [
  { id: "demo-m-amna-rotis", person: "demo-p-amna", body: "Her rotis were legendary — she'd slap the dough spinning and the whole lane would gather at the tandoor just to watch her hands.", when: "1970s", author: "Ahmed" },
  { id: "demo-m-yusuf-watch", person: "demo-p-yusuf", body: "Kept a pocket watch from Amritsar that stopped in 1947. He never fixed it — he said it kept the time he lost.", when: "partition", author: "Sara" },
  { id: "demo-m-kareem-mangoes", person: "demo-p-kareem", body: "Never raised his voice. When the mangoes ripened he'd call every child on the street by name and hand them out from the roof.", when: "summers in Karachi", author: "Farida" },
  { id: "demo-m-zoya-mango-council", person: "demo-p-zoya", body: "Named the family group chat 'the mango council' when she was four. It stuck.", when: "2023", author: "Ali" },
  { id: "demo-m-ali-food", person: "demo-p-ali", body: "Grandmother Amna's tandoor rotis are the reason I started writing all this down. Food is memory.", when: "2024", author: null },
];
