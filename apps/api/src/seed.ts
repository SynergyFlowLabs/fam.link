import type {
  ActivityEntry,
  FamilyDate,
  FamilySpace,
  Id,
  Invitation,
  Membership,
  Person,
  Relationship,
  RelationshipKind,
  User,
} from '@famlink/domain';
import type { DismissedDuplicate, HiddenBranch, Store } from './db.js';

/**
 * Demo data: a plausible Khan family across four generations, with the awkward cases the product
 * must handle already present — a second marriage, a half-sibling, an adopted child, a deceased
 * grandparent, a minor, an unclaimed uncle, and a duplicate waiting to be found.
 *
 * SYNTHETIC ONLY. Never put a real family's information in this repository.
 */

interface SeedPerson {
  key: string;
  name: string;
  family?: string;
  gender: Person['gender'];
  living?: 'living' | 'deceased';
  birth?: string;
  death?: string;
  birthPrecision?: FamilyDate['precision'];
  place?: string;
  bio?: string;
  claimed?: boolean;
  custodian?: boolean;
  minor?: boolean;
  alt?: string[];
  visibility?: Record<string, Person['fieldVisibility'][string]>;
}

const SEED_PEOPLE: SeedPerson[] = [
  { key: 'abdul', name: 'Abdul', family: 'Khan', gender: 'male', living: 'deceased', birth: '1928', death: '2011', place: 'Peshawar', bio: 'Moved the family from Peshawar to Lahore in 1947. Kept the shop on Mall Road for forty years.' },
  { key: 'fatima', name: 'Fatima', family: 'Khan', gender: 'female', birth: '1931', place: 'Peshawar', alt: ['Fatima Bibi'] },
  { key: 'ahmed', name: 'Ahmed', family: 'Khan', gender: 'male', birth: '1952', place: 'Lahore', claimed: true, bio: 'Eldest son. Retired civil engineer; keeps the family records.' },
  { key: 'zainab', name: 'Zainab', family: 'Khan', gender: 'female', birth: '1955', place: 'Lahore', claimed: true },
  { key: 'farah', name: 'Farah', family: 'Siddiqui', gender: 'female', birth: '1960', place: 'Karachi' },
  { key: 'nadeem', name: 'Nadeem', gender: 'male', birth: '1952', place: 'Lahore', bio: 'Younger brother of Ahmed. Lives in Dubai.' },
  { key: 'ayesha', name: 'Ayesha', family: 'Khan', gender: 'female', birth: '1958', place: 'Lahore', claimed: true, custodian: true },
  { key: 'sana', name: 'Sana', family: 'Khan', gender: 'female', birth: '1980', place: 'Lahore' },
  { key: 'bilal', name: 'Bilal', family: 'Khan', gender: 'male', birth: '1985', place: 'Lahore', claimed: true, alt: ['Billo'] },
  { key: 'hina', name: 'Hina', family: 'Raza', gender: 'female', birth: '1988', place: 'Islamabad' },
  { key: 'sara', name: 'Sara', family: 'Khan', gender: 'female', birth: '1990', place: 'Dubai', claimed: true },
  { key: 'humza', name: 'Humza', family: 'Khan', gender: 'male', birth: '1995', place: 'Karachi' },
  // Zoya is Bilal and Hina's adopted daughter; her biological parents are not recorded.
  { key: 'zoya', name: 'Zoya', family: 'Khan', gender: 'female', birth: '2012', place: 'Lahore', minor: true },
  { key: 'hamza', name: 'Hamza', family: 'Khan', gender: 'male', birth: '2015', place: 'Lahore', minor: true },
  { key: 'omar', name: 'Omar', family: 'Raza', gender: 'male', birth: '2018', place: 'Islamabad', minor: true },
  { key: 'ruqayya', name: 'Ruqayya', gender: 'female', living: 'deceased', birth: '1935', death: '2005', place: 'Multan' },
  { key: 'imran', name: 'Imran', family: 'Khan', gender: 'male', birth: '1962', place: 'Multan', alt: ['Chacha Imran'] },
  { key: 'sadia', name: 'Sadia', family: 'Khan', gender: 'female', birth: '1992', place: 'Multan', claimed: true },
  { key: 'usman', name: 'Usman', family: 'Khan', gender: 'male', birth: '1988', place: 'Multan' },
  { key: 'noor', name: 'Noor', family: 'Khan', gender: 'female', birth: '2016', place: 'Multan', minor: true },
];

const SEED_RELATIONSHIPS: Array<[string, string, RelationshipKind]> = [
  ['abdul', 'fatima', 'spouse'],
  ['abdul', 'ahmed', 'biological-parent'],
  ['fatima', 'ahmed', 'biological-parent'],
  ['abdul', 'nadeem', 'biological-parent'],
  ['fatima', 'nadeem', 'biological-parent'],
  ['abdul', 'ruqayya', 'spouse'],
  ['abdul', 'imran', 'biological-parent'],
  ['ruqayya', 'imran', 'biological-parent'],
  ['ahmed', 'zainab', 'spouse'],
  ['ahmed', 'sana', 'biological-parent'],
  ['zainab', 'sana', 'biological-parent'],
  ['ahmed', 'bilal', 'biological-parent'],
  ['zainab', 'bilal', 'biological-parent'],
  ['ahmed', 'farah', 'former-spouse'],
  ['ahmed', 'humza', 'biological-parent'],
  ['farah', 'humza', 'biological-parent'],
  ['nadeem', 'ayesha', 'spouse'],
  ['nadeem', 'sara', 'biological-parent'],
  ['ayesha', 'sara', 'biological-parent'],
  ['bilal', 'hina', 'spouse'],
  ['bilal', 'hamza', 'biological-parent'],
  ['hina', 'hamza', 'biological-parent'],
  ['bilal', 'zoya', 'adoptive-parent'],
  ['hina', 'zoya', 'adoptive-parent'],
  ['hina', 'omar', 'biological-parent'],
  ['sara', 'usman', 'spouse'],
  ['sara', 'noor', 'biological-parent'],
  ['usman', 'noor', 'biological-parent'],
  ['sadia', 'usman', 'spouse'],
  ['imran', 'sadia', 'biological-parent'],
  ['ruqayya', 'sadia', 'biological-parent'],
];

const DEMO_USERS: Array<{ id: string; name: string; email: string; phone: string }> = [
  { id: 'user-ayesha', name: 'Ayesha Khan', email: 'ayesha@example.com', phone: '+92 300 0000001' },
  { id: 'user-bilal', name: 'Bilal Khan', email: 'bilal@example.com', phone: '+92 300 0000002' },
  { id: 'user-sadia', name: 'Sadia Khan', email: 'sadia@example.com', phone: '+92 300 0000003' },
  { id: 'user-ahmed', name: 'Ahmed Khan', email: 'ahmed@example.com', phone: '+92 300 0000004' },
  // Two unclaimed accounts, used to exercise claiming and inviting end-to-end.
  { id: 'user-nadeem', name: 'Nadeem Khan', email: 'nadeem@example.com', phone: '+92 300 0000005' },
  { id: 'user-seher', name: 'Seher Khan', email: 'seher@example.com', phone: '+92 300 0000006' },
];

/** One claimed person per demo account, so "who am I in this tree?" always has a single answer. */
const CLAIM_MAP: Record<string, string> = {
  ahmed: 'user-ahmed',
  ayesha: 'user-ayesha',
  bilal: 'user-bilal',
  sara: 'user-sadia',
};

const PERSON_IDS: Record<string, string> = {};
for (const person of SEED_PEOPLE) PERSON_IDS[person.key] = `person-${person.key}`;

function familyDate(value: string | undefined, precision?: FamilyDate['precision']): FamilyDate | undefined {
  if (!value) return undefined;
  const value2 = value.length === 4 ? `${value}-01-01` : value;
  return { value: value2, precision: precision ?? (value.length === 4 ? 'year' : 'exact') };
}

export function seedStore(): Store {
  const timestamp = '2026-01-05T09:00:00.000Z';
  const space: FamilySpace = {
    id: 'space-khan',
    name: 'Khan Family',
    locale: 'en',
    createdAt: timestamp,
    createdByUserId: 'user-ayesha',
    allowPublicDiscovery: false,
    defaultVisibility: 'family-space',
  };

  const users: User[] = DEMO_USERS.map((user) => ({ ...user, isDemoPersona: true }));

  const persons: Person[] = SEED_PEOPLE.map((seed) => ({
    id: PERSON_IDS[seed.key]!,
    spaceId: space.id,
    givenName: seed.name,
    familyName: seed.family,
    alternativeNames: seed.alt ?? [],
    gender: seed.gender,
    livingStatus: seed.living ?? 'living',
    birthDate: familyDate(seed.birth, seed.birthPrecision),
    deathDate: familyDate(seed.death),
    birthPlace: seed.place,
    placesLived: [],
    biography: seed.bio,
    isMinor: seed.minor ?? false,
    fieldVisibility: seed.visibility ?? {},
    blockedUserIds: [],
    selectedViewerIds: [],
    claimedByUserId: CLAIM_MAP[seed.key],
    custodianUserId: seed.custodian ? 'user-ayesha' : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUserId: 'user-ayesha',
  }));

  const relationships: Relationship[] = SEED_RELATIONSHIPS.map(([from, to, kind], position) => ({
    id: `rel-${position + 1}`,
    spaceId: space.id,
    fromPersonId: PERSON_IDS[from]!,
    toPersonId: PERSON_IDS[to]!,
    kind,
    verification: kind === 'biological-parent' ? 'verified' : 'unverified',
    visibility: 'family-space',
    createdAt: timestamp,
    createdByUserId: 'user-ayesha',
    deletedAt: null,
  }));

  const memberships: Membership[] = [
    { id: 'mem-1', spaceId: space.id, userId: 'user-ayesha', role: 'admin', status: 'active', joinedAt: timestamp },
    { id: 'mem-2', spaceId: space.id, userId: 'user-bilal', role: 'contributor', status: 'active', joinedAt: timestamp },
    { id: 'mem-3', spaceId: space.id, userId: 'user-sadia', role: 'contributor', status: 'active', joinedAt: timestamp },
    { id: 'mem-4', spaceId: space.id, userId: 'user-ahmed', role: 'contributor', status: 'active', joinedAt: timestamp },
  ];

  const invitations: Invitation[] = [
    {
      id: 'inv-1',
      spaceId: space.id,
      token: 'khan-uncle-nadeem',
      personId: PERSON_IDS['nadeem'],
      relationshipLabel: 'maternal uncle',
      channel: 'whatsapp',
      invitedByUserId: 'user-bilal',
      createdAt: timestamp,
      expiresAt: '2026-12-31T00:00:00.000Z',
      status: 'sent',
      previewPersonIds: [PERSON_IDS['nadeem']!, PERSON_IDS['sara']!, PERSON_IDS['ahmed']!],
    },
    {
      id: 'inv-2',
      spaceId: space.id,
      token: 'khan-cousin-sadia',
      personId: PERSON_IDS['sadia'],
      relationshipLabel: 'father’s brother’s daughter',
      channel: 'link',
      invitedByUserId: 'user-bilal',
      createdAt: timestamp,
      expiresAt: '2026-12-31T00:00:00.000Z',
      status: 'sent',
      previewPersonIds: [PERSON_IDS['sadia']!, PERSON_IDS['imran']!],
    },
  ];

  const activity: ActivityEntry[] = [
    {
      id: 'act-1',
      spaceId: space.id,
      kind: 'person.created',
      actorUserId: 'user-ayesha',
      personId: PERSON_IDS['abdul'],
      summary: 'Ayesha added Abdul Khan to the family tree',
      createdAt: timestamp,
    },
    {
      id: 'act-2',
      spaceId: space.id,
      kind: 'person.claimed',
      actorUserId: 'user-bilal',
      personId: PERSON_IDS['bilal'],
      summary: 'Bilal claimed his own profile',
      createdAt: '2026-01-06T10:12:00.000Z',
    },
    {
      id: 'act-3',
      spaceId: space.id,
      kind: 'relationship.created',
      actorUserId: 'user-sadia',
      personId: PERSON_IDS['noor'],
      summary: 'Sadia added Noor as a daughter of Sara and Usman',
      createdAt: '2026-01-07T14:30:00.000Z',
    },
    {
      id: 'act-4',
      spaceId: space.id,
      kind: 'person.created',
      actorUserId: 'user-bilal',
      personId: PERSON_IDS['hina'],
      summary: 'Bilal added his wife Hina Raza',
      createdAt: '2026-01-08T08:05:00.000Z',
    },
  ];

  const proposals = [
    {
      id: 'prop-1',
      spaceId: space.id,
      personId: PERSON_IDS['nadeem']!,
      field: 'birthDate',
      previousValue: { value: '1952-01-01', precision: 'year' },
      proposedValue: { value: '1954-01-01', precision: 'year' },
      explanation: 'His passport says 1954. He has always said 1952 though.',
      proposedByUserId: 'user-bilal',
      createdAt: '2026-01-09T11:20:00.000Z',
      status: 'proposed' as const,
    },
  ];

  const hiddenBranches: HiddenBranch[] = [];
  const dismissedDuplicates: DismissedDuplicate[] = [];

  return {
    users,
    spaces: [space],
    memberships,
    persons,
    relationships,
    proposals,
    activity,
    invitations,
    hiddenBranches,
    dismissedDuplicates,
    reports: [],
    nextId: 1,
  };
}

export const seedIds = { personIds: PERSON_IDS, spaceId: 'space-khan', userIds: CLAIM_MAP };

export function idFor(key: string): Id {
  return PERSON_IDS[key]!;
}
