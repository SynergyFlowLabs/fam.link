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
  aka?: string | null;
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

/**
 * The Quraysh of Mecca — the public community tree. All deceased historical
 * figures, so nothing here is ever redacted; fuzzy "c." CE dates keep the
 * product's honesty about uncertain knowledge. Naming is respectful by
 * design (the Prophet is "Prophet Muhammad ﷺ", with his kunya in
 * also-known-as).
 *
 * Seeded PUBLIC so /explore has something in it from the first boot; the
 * demo user curates the suggestion queue like any owner would.
 */
export const QURAISH_TREE = {
  id: "demo-tree-quraish",
  name: "The Quraysh of Mecca",
  description:
    "The clans of the Quraysh — keepers of the Kaaba, and the family that carried Islam into history. A public community tree: explore it, and if you know something we've missed, suggest it.",
  focusPersonId: "demo-q-muhammad",
  visibility: "public" as const,
};

export const QURAISH_PERSONS: DemoPerson[] = [
  { id: "demo-q-qusayy", first: "Qusayy", last: "ibn Kilab", gender: "m", living: false, birth: "c. 400", birthPlace: "Mecca", death: "c. 480", deathPlace: "Mecca", notes: "Assembled the Quraysh clans around the Kaaba and won its custodianship for his descendants." },
  { id: "demo-q-abdmanaf", first: "Abd Manaf", last: "ibn Qusayy", gender: "m", living: false, birth: "c. 430", birthPlace: "Mecca", death: "c. 490", deathPlace: "Mecca", notes: null },
  { id: "demo-q-hashim", first: "Hashim", last: "ibn Abd Manaf", gender: "m", living: false, birth: "c. 464", birthPlace: "Mecca", death: "497", deathPlace: "Gaza", notes: "Founder of Banu Hashim; the Prophet's great-grandfather. Feeding Mecca through a famine earned him his name." },
  { id: "demo-q-abdshams", first: "Abd Shams", last: "ibn Abd Manaf", gender: "m", living: false, birth: "c. 465", birthPlace: "Mecca", death: null, deathPlace: null, notes: "Ancestor of the Umayyad line." },
  { id: "demo-q-muttalib-elder", first: "Muttalib", last: "ibn Abd Manaf", gender: "m", living: false, birth: "c. 470", birthPlace: "Mecca", death: null, deathPlace: null, notes: "The Banu al-Muttalib take their name from him." },
  { id: "demo-q-umayya", first: "Umayya", last: "ibn Abd Shams", gender: "m", living: false, birth: "c. 500", birthPlace: "Mecca", death: null, deathPlace: null, notes: "Gave the Umayyad clan its name." },
  { id: "demo-q-harb", first: "Harb", last: "ibn Umayya", gender: "m", living: false, birth: "c. 530s", birthPlace: "Mecca", death: null, deathPlace: null, notes: "Led Quraysh in the wars of the pre-Islamic era." },
  { id: "demo-q-abusufyan", first: "Abu Sufyan", last: "ibn Harb", gender: "m", living: false, birth: "c. 567", birthPlace: "Mecca", death: "c. 652", deathPlace: "Medina", notes: "Led Quraysh through the Meccan campaign years against the Muslims; embraced Islam at the conquest of Mecca." },
  { id: "demo-q-muawiya", first: "Muawiya", last: "ibn Abi Sufyan", gender: "m", living: false, birth: "c. 602", birthPlace: "Mecca", death: "680", deathPlace: "Damascus", notes: "Founded the Umayyad Caliphate at Damascus in 661." },
  { id: "demo-q-abdulmuttalib", first: "Abdul-Muttalib", last: null, aka: "Shaybat al-Hamd", gender: "m", living: false, birth: "c. 497", birthPlace: "Yathrib (Medina)", death: "578", deathPlace: "Mecca", notes: "Rediscovered the well of Zamzam; raised his grandson the Prophet after Abdullah's death." },
  { id: "demo-q-abdullah", first: "Abdullah", last: "ibn Abdul-Muttalib", gender: "m", living: false, birth: "c. 545", birthPlace: "Mecca", death: "570", deathPlace: "Yathrib (Medina)", notes: "Father of the Prophet; died on a trading journey before his son was born." },
  { id: "demo-q-abutalib", first: "Abu Talib", last: "ibn Abdul-Muttalib", gender: "m", living: false, birth: "c. 539", birthPlace: "Mecca", death: "619", deathPlace: "Mecca", notes: "Shielded the Prophet through the boycott years in Mecca; father of Ali." },
  { id: "demo-q-hamza", first: "Hamza", last: "ibn Abdul-Muttalib", gender: "m", living: false, birth: "c. 566", birthPlace: "Mecca", death: "625", deathPlace: "Uhud", notes: "The Prophet's uncle and one of the earliest Muslims; fell at Uhud." },
  { id: "demo-q-abbas", first: "Abbas", last: "ibn Abdul-Muttalib", gender: "m", living: false, birth: "c. 566", birthPlace: "Mecca", death: "653", deathPlace: "Medina", notes: "Uncle of the Prophet; ancestor of the Abbasid caliphs." },
  { id: "demo-q-aminah", first: "Aminah", last: "bint Wahb", gender: "f", living: false, birth: "c. 557", birthPlace: "Yathrib (Medina)", death: "577", deathPlace: "al-Abwa", notes: "Mother of the Prophet; died when he was six." },
  { id: "demo-q-muhammad", first: "Prophet Muhammad \ufdfa", last: null, aka: "Abu al-Qasim", gender: "m", living: false, birth: "570", birthPlace: "Mecca", death: "632", deathPlace: "Medina", notes: "The Prophet of Islam, from Banu Hashim — descended from Qusayy's line through Hashim and Abdul-Muttalib." },
  { id: "demo-q-khadijah", first: "Khadijah", last: "bint Khuwaylid", gender: "f", living: false, birth: "c. 556", birthPlace: "Mecca", death: "619", deathPlace: "Mecca", notes: "A merchant in her own right; married the Prophet after employing him on her caravans, and was the first believer." },
  { id: "demo-q-qasim", first: "Qasim", last: "ibn Muhammad", gender: "m", living: false, birth: "c. 598", birthPlace: "Mecca", death: "c. 600", deathPlace: "Mecca", notes: "The Prophet's first son; died in infancy and gave him his kunya, Abu al-Qasim." },
  { id: "demo-q-abdullah-son", first: "Abdullah", last: "ibn Muhammad", aka: "al-Tahir", gender: "m", living: false, birth: "c. 615", birthPlace: "Mecca", death: "c. 615", deathPlace: "Mecca", notes: "Born in infancy's span; known as al-Tahir, the pure." },
  { id: "demo-q-zainab", first: "Zainab", last: "bint Muhammad", gender: "f", living: false, birth: "c. 599", birthPlace: "Mecca", death: "629", deathPlace: "Medina", notes: "Eldest daughter of the Prophet; the last of his children to be born before his prophethood." },
  { id: "demo-q-ruqayyah", first: "Ruqayyah", last: "bint Muhammad", gender: "f", living: false, birth: "c. 601", birthPlace: "Mecca", death: "624", deathPlace: "Medina", notes: "Migrated first to Abyssinia and then to Medina; died in the days of Badr." },
  { id: "demo-q-ummkulthum", first: "Umm Kulthum", last: "bint Muhammad", gender: "f", living: false, birth: "c. 603", birthPlace: "Mecca", death: "630", deathPlace: "Medina", notes: null },
  { id: "demo-q-fatimah", first: "Fatimah", last: "bint Muhammad", aka: "al-Zahra", gender: "f", living: false, birth: "c. 605", birthPlace: "Mecca", death: "632", deathPlace: "Medina", notes: "The Prophet's youngest daughter; her descendants — the Sayyids — carried the family's line across the Muslim world." },
  { id: "demo-q-fatimah-asad", first: "Fatimah", last: "bint Asad", gender: "f", living: false, birth: "c. 580", birthPlace: "Mecca", death: "c. 626", deathPlace: "Medina", notes: "Wife of Abu Talib and the Prophet's foster mother; among the first to migrate to Medina." },
  { id: "demo-q-ali", first: "Ali", last: "ibn Abi Talib", gender: "m", living: false, birth: "c. 600", birthPlace: "Mecca", death: "661", deathPlace: "Kufa", notes: "Cousin and son-in-law of the Prophet; the fourth of the Rashidun caliphs." },
  { id: "demo-q-hasan", first: "Hasan", last: "ibn Ali", gender: "m", living: false, birth: "624", birthPlace: "Medina", death: "670", deathPlace: "Medina", notes: "Grandson of the Prophet; renounced the caliphate to spare Muslim blood." },
  { id: "demo-q-husayn", first: "Husayn", last: "ibn Ali", gender: "m", living: false, birth: "626", birthPlace: "Medina", death: "680", deathPlace: "Karbala", notes: "Grandson of the Prophet; fell at Karbala, remembered every Muharram." },
];

export const QURAISH_UNIONS: DemoUnion[] = [
  { id: "demo-qu-qusayy", a: "demo-q-qusayy", b: null, status: null, date: null, place: null },
  { id: "demo-qu-abdmanaf", a: "demo-q-abdmanaf", b: null, status: null, date: null, place: null },
  { id: "demo-qu-abdshams", a: "demo-q-abdshams", b: null, status: null, date: null, place: null },
  { id: "demo-qu-umayya", a: "demo-q-umayya", b: null, status: null, date: null, place: null },
  { id: "demo-qu-harb", a: "demo-q-harb", b: null, status: null, date: null, place: null },
  { id: "demo-qu-abusufyan", a: "demo-q-abusufyan", b: null, status: null, date: null, place: null },
  { id: "demo-qu-hashim", a: "demo-q-hashim", b: null, status: null, date: null, place: null },
  { id: "demo-qu-abdulmuttalib", a: "demo-q-abdulmuttalib", b: null, status: null, date: null, place: null },
  { id: "demo-qu-abdullah-aminah", a: "demo-q-abdullah", b: "demo-q-aminah", status: "married", date: null, place: null },
  { id: "demo-qu-abutalib-fatimah", a: "demo-q-abutalib", b: "demo-q-fatimah-asad", status: "married", date: null, place: null },
  { id: "demo-qu-muhammad-khadijah", a: "demo-q-muhammad", b: "demo-q-khadijah", status: "married", date: "c. 595", place: "Mecca" },
  { id: "demo-qu-ali-fatimah", a: "demo-q-ali", b: "demo-q-fatimah", status: "married", date: "c. 623", place: "Medina" },
];

export const QURAISH_LINKS: DemoLink[] = [
  { id: "demo-ql-qusayy-abdmanaf", u: "demo-qu-qusayy", child: "demo-q-abdmanaf" },
  { id: "demo-ql-abdmanaf-hashim", u: "demo-qu-abdmanaf", child: "demo-q-hashim" },
  { id: "demo-ql-abdmanaf-abdshams", u: "demo-qu-abdmanaf", child: "demo-q-abdshams" },
  { id: "demo-ql-abdmanaf-muttalib", u: "demo-qu-abdmanaf", child: "demo-q-muttalib-elder" },
  { id: "demo-ql-abdshams-umayya", u: "demo-qu-abdshams", child: "demo-q-umayya" },
  { id: "demo-ql-umayya-harb", u: "demo-qu-umayya", child: "demo-q-harb" },
  { id: "demo-ql-harb-abusufyan", u: "demo-qu-harb", child: "demo-q-abusufyan" },
  { id: "demo-ql-abusufyan-muawiya", u: "demo-qu-abusufyan", child: "demo-q-muawiya" },
  { id: "demo-ql-hashim-abdulmuttalib", u: "demo-qu-hashim", child: "demo-q-abdulmuttalib" },
  { id: "demo-ql-abdulmuttalib-abdullah", u: "demo-qu-abdulmuttalib", child: "demo-q-abdullah" },
  { id: "demo-ql-abdulmuttalib-abutalib", u: "demo-qu-abdulmuttalib", child: "demo-q-abutalib" },
  { id: "demo-ql-abdulmuttalib-hamza", u: "demo-qu-abdulmuttalib", child: "demo-q-hamza" },
  { id: "demo-ql-abdulmuttalib-abbas", u: "demo-qu-abdulmuttalib", child: "demo-q-abbas" },
  { id: "demo-ql-abdullah-muhammad", u: "demo-qu-abdullah-aminah", child: "demo-q-muhammad" },
  { id: "demo-ql-abutalib-ali", u: "demo-qu-abutalib-fatimah", child: "demo-q-ali" },
  { id: "demo-ql-muhammad-qasim", u: "demo-qu-muhammad-khadijah", child: "demo-q-qasim" },
  { id: "demo-ql-muhammad-abdullah", u: "demo-qu-muhammad-khadijah", child: "demo-q-abdullah-son" },
  { id: "demo-ql-muhammad-zainab", u: "demo-qu-muhammad-khadijah", child: "demo-q-zainab" },
  { id: "demo-ql-muhammad-ruqayyah", u: "demo-qu-muhammad-khadijah", child: "demo-q-ruqayyah" },
  { id: "demo-ql-muhammad-ummkulthum", u: "demo-qu-muhammad-khadijah", child: "demo-q-ummkulthum" },
  { id: "demo-ql-muhammad-fatimah", u: "demo-qu-muhammad-khadijah", child: "demo-q-fatimah" },
  { id: "demo-ql-ali-hasan", u: "demo-qu-ali-fatimah", child: "demo-q-hasan" },
  { id: "demo-ql-ali-husayn", u: "demo-qu-ali-fatimah", child: "demo-q-husayn" },
];


export interface DemoLabelDef {
  id: string;
  treeId: string;
  name: string;
  color: string | null;
}
export interface DemoPersonLabel {
  id: string;
  personId: string;
  labelId: string;
}
export interface DemoCustomFieldDef {
  id: string;
  treeId: string;
  name: string;
  kind: "text" | "number" | "date" | "select";
  optionsJson: string | null;
}
export interface DemoPersonCustomValue {
  id: string;
  personId: string;
  fieldId: string;
  value: string;
}
export interface DemoMemoryLabel {
  id: string;
  memoryId: string;
  labelId: string;
}

export const DEMO_LABEL_DEFS: DemoLabelDef[] = [
  { id: "demo-lbl-immigrant", treeId: "demo-tree", name: "Immigrant", color: "#2f5d50" },
  { id: "demo-lbl-veteran", treeId: "demo-tree", name: "Veteran", color: "#96574f" },
  { id: "demo-lbl-caregiver", treeId: "demo-tree", name: "Primary caregiver", color: "#5b7a99" },
  { id: "demo-lbl-historian", treeId: "demo-tree", name: "Family historian", color: "#b98a2f" },
  { id: "demo-lbl-migration", treeId: "demo-tree", name: "Migration", color: "#2f5d50" },
  { id: "demo-lbl-family-legend", treeId: "demo-tree", name: "Family legend", color: "#7a6a4a" },
];

export const DEMO_PERSON_LABELS: DemoPersonLabel[] = [
  { id: "demo-pl-yusuf-imm", personId: "demo-p-yusuf", labelId: "demo-lbl-immigrant" },
  { id: "demo-pl-amna-imm", personId: "demo-p-amna", labelId: "demo-lbl-immigrant" },
  { id: "demo-pl-kareem-vet", personId: "demo-p-kareem", labelId: "demo-lbl-veteran" },
  { id: "demo-pl-yusuf-vet", personId: "demo-p-yusuf", labelId: "demo-lbl-veteran" },
  { id: "demo-pl-farida-care", personId: "demo-p-farida", labelId: "demo-lbl-caregiver" },
  { id: "demo-pl-ali-hist", personId: "demo-p-ali", labelId: "demo-lbl-historian" },
  { id: "demo-pl-sara-hist", personId: "demo-p-sara", labelId: "demo-lbl-historian" },
];

export const DEMO_CUSTOM_FIELD_DEFS: DemoCustomFieldDef[] = [
  { id: "demo-cf-occupation", treeId: "demo-tree", name: "Occupation", kind: "text", optionsJson: null },
  { id: "demo-cf-military", treeId: "demo-tree", name: "Military service", kind: "text", optionsJson: null },
  { id: "demo-cf-aliases", treeId: "demo-tree", name: "Known aliases", kind: "text", optionsJson: null },
  { id: "demo-cf-branch", treeId: "demo-tree", name: "Branch", kind: "select", optionsJson: JSON.stringify(["Paternal","Maternal","Married-in"]) },
];

export const DEMO_PERSON_CUSTOM_VALUES: DemoPersonCustomValue[] = [
  { id: "demo-pcv-yusuf-occ", personId: "demo-p-yusuf", fieldId: "demo-cf-occupation", value: "Schoolteacher" },
  { id: "demo-pcv-yusuf-mil", personId: "demo-p-yusuf", fieldId: "demo-cf-military", value: "British Indian Army" },
  { id: "demo-pcv-kareem-occ", personId: "demo-p-kareem", fieldId: "demo-cf-occupation", value: "Fruit merchant" },
  { id: "demo-pcv-ahmed-occ", personId: "demo-p-ahmed", fieldId: "demo-cf-occupation", value: "Civil engineer" },
  { id: "demo-pcv-amna-alias", personId: "demo-p-amna", fieldId: "demo-cf-aliases", value: "Bibi Ji" },
  { id: "demo-pcv-yusuf-branch", personId: "demo-p-yusuf", fieldId: "demo-cf-branch", value: "Paternal" },
  { id: "demo-pcv-ahmed-branch", personId: "demo-p-ahmed", fieldId: "demo-cf-branch", value: "Paternal" },
  { id: "demo-pcv-farida-branch", personId: "demo-p-farida", fieldId: "demo-cf-branch", value: "Maternal" },
];

export const DEMO_MEMORY_LABELS: DemoMemoryLabel[] = [
  { id: "demo-ml-yusuf-watch-mig", memoryId: "demo-m-yusuf-watch", labelId: "demo-lbl-migration" },
  { id: "demo-ml-amna-rotis-legend", memoryId: "demo-m-amna-rotis", labelId: "demo-lbl-family-legend" },
  { id: "demo-ml-kareem-mango-legend", memoryId: "demo-m-kareem-mangoes", labelId: "demo-lbl-family-legend" },
];

export const QURAISH_MEMORIES: DemoMemory[] = [
  { id: "demo-qm-zamzam", person: "demo-q-abdulmuttalib", body: "Dreamed of where to dig, and found Zamzam again after it had been lost — the well that still quenches pilgrims beside the Kaaba.", when: null, author: null },
  { id: "demo-qm-khadijah-caravans", person: "demo-q-khadijah", body: "Ran her own trade caravans and sent the young Muhammad to Syria as her agent; his honesty on that journey is why she proposed.", when: "c. 595", author: null },
  { id: "demo-qm-year-sorrow", person: "demo-q-khadijah", body: "Died in the Year of Sorrow — the same year as Abu Talib — after twenty-five years of marriage in which she was the first to believe.", when: "619", author: null },
  { id: "demo-qm-fatimah-line", person: "demo-q-fatimah", body: "Her sons Hasan and Husayn continued the Prophet's line; through her, the family's story runs to this day.", when: null, author: null },
];
