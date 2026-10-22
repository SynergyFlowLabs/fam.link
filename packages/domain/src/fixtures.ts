import { familyDate } from './dates.js';
import type { FamilyGraph } from './graph.js';
import type { Person, Relationship, RelationshipKind } from './types.js';

/**
 * Synthetic families for tests. No real family data ever goes into this repository.
 *
 * `khanFamily()` is the worked example from the PRD appendix, extended with a second marriage,
 * a half-sibling, an adoption, and a cousin marriage so that edge cases are exercised by default.
 */

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export interface PersonInput {
  id?: string;
  givenName: string;
  familyName?: string;
  gender?: Person['gender'];
  livingStatus?: Person['livingStatus'];
  birth?: string;
  death?: string;
  spaceId?: string;
  claimedByUserId?: string;
  isMinor?: boolean;
}

export function makePerson(input: PersonInput): Person {
  return {
    id: input.id ?? nextId('p'),
    spaceId: input.spaceId ?? 'space-1',
    givenName: input.givenName,
    familyName: input.familyName,
    alternativeNames: [],
    gender: input.gender ?? 'unknown',
    livingStatus: input.livingStatus ?? 'living',
    birthDate: input.birth ? familyDate(input.birth, input.birth.length === 4 ? 'year' : 'exact') : undefined,
    deathDate: input.death ? familyDate(input.death, input.death.length === 4 ? 'year' : 'exact') : undefined,
    placesLived: [],
    isMinor: input.isMinor ?? false,
    fieldVisibility: {},
    blockedUserIds: [],
    selectedViewerIds: [],
    claimedByUserId: input.claimedByUserId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function makeRelationship(
  from: Person,
  to: Person,
  kind: RelationshipKind,
  overrides: Partial<Relationship> = {},
): Relationship {
  return {
    id: nextId('r'),
    spaceId: from.spaceId,
    fromPersonId: from.id,
    toPersonId: to.id,
    kind,
    verification: 'unverified',
    visibility: 'family-space',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export interface BuiltFamily {
  readonly graph: FamilyGraph;
  readonly people: Record<string, Person>;
}

/**
 * The Khan family:
 *
 *   Abdul ── Fatima
 *     ├── Ahmed ── Zainab        ├── Nadeem ── Ayesha
 *     │     ├── Sana             │     └── Sara
 *     │     └── Bilal            │
 *     └── Nadeem ── Ayesha       └── (Ahmed also married Farah; Humza is their son)
 *
 *   Sara is Bilal's first cousin: Bilal → Ahmed → Abdul → Nadeem → Sara.
 */
export function khanFamily(): BuiltFamily {
  const abdul = makePerson({ id: 'abdul', givenName: 'Abdul', gender: 'male', birth: '1928', livingStatus: 'deceased' });
  const fatima = makePerson({ id: 'fatima', givenName: 'Fatima', gender: 'female', birth: '1931' });
  const ahmed = makePerson({ id: 'ahmed', givenName: 'Ahmed', gender: 'male', birth: '1952' });
  const zainab = makePerson({ id: 'zainab', givenName: 'Zainab', gender: 'female', birth: '1955' });
  const farah = makePerson({ id: 'farah', givenName: 'Farah', gender: 'female', birth: '1960' });
  const nadeem = makePerson({ id: 'nadeem', givenName: 'Nadeem', gender: 'male', birth: '1952' });
  const ayesha = makePerson({ id: 'ayesha', givenName: 'Ayesha', gender: 'female', birth: '1958' });
  const sana = makePerson({ id: 'sana', givenName: 'Sana', gender: 'female', birth: '1980' });
  const bilal = makePerson({ id: 'bilal', givenName: 'Bilal', gender: 'male', birth: '1985' });
  const sara = makePerson({ id: 'sara', givenName: 'Sara', gender: 'female', birth: '1990' });
  const humza = makePerson({ id: 'humza', givenName: 'Humza', gender: 'male', birth: '1995' });

  const people = { abdul, fatima, ahmed, zainab, farah, nadeem, ayesha, sana, bilal, sara, humza };

  const relationships: Relationship[] = [
    makeRelationship(abdul, fatima, 'spouse'),
    makeRelationship(abdul, ahmed, 'biological-parent'),
    makeRelationship(fatima, ahmed, 'biological-parent'),
    makeRelationship(abdul, nadeem, 'biological-parent'),
    makeRelationship(ahmed, zainab, 'spouse'),
    makeRelationship(fatima, nadeem, 'biological-parent'),
    makeRelationship(ahmed, sana, 'biological-parent'),
    makeRelationship(zainab, sana, 'biological-parent'),
    makeRelationship(ahmed, bilal, 'biological-parent'),
    makeRelationship(zainab, bilal, 'biological-parent'),
    makeRelationship(ahmed, farah, 'spouse'),
    makeRelationship(ahmed, humza, 'biological-parent'),
    makeRelationship(farah, humza, 'biological-parent'),
    makeRelationship(nadeem, ayesha, 'spouse'),
    makeRelationship(nadeem, sara, 'biological-parent'),
    makeRelationship(ayesha, sara, 'biological-parent'),
  ];

  return { graph: { persons: Object.values(people), relationships }, people };
}

/**
 * A family that breaks naive assumptions:
 * - Umar has children with two wives; Tariq and Rida are half-siblings.
 * - Rida is adopted by Hamid.
 * - Two cousins marry, creating a cycle: their child is related by two paths.
 */
export function tangledFamily(): BuiltFamily {
  const umar = makePerson({ id: 'umar', givenName: 'Umar', gender: 'male', birth: '1950' });
  const nasreen = makePerson({ id: 'nasreen', givenName: 'Nasreen', gender: 'female', birth: '1952' });
  const shabana = makePerson({ id: 'shabana', givenName: 'Shabana', gender: 'female', birth: '1960' });
  const hamid = makePerson({ id: 'hamid', givenName: 'Hamid', gender: 'male', birth: '1948' });
  const ruqayya = makePerson({ id: 'ruqayya', givenName: 'Ruqayya', gender: 'female', birth: '1950' });
  const tariq = makePerson({ id: 'tariq', givenName: 'Tariq', gender: 'male', birth: '1975' });
  const rida = makePerson({ id: 'rida', givenName: 'Rida', gender: 'female', birth: '1980' });
  const adil = makePerson({ id: 'adil', givenName: 'Adil', gender: 'male', birth: '1978' });
  const kiran = makePerson({ id: 'kiran', givenName: 'Kiran', gender: 'female', birth: '1982' });
  const zoya = makePerson({ id: 'zoya', givenName: 'Zoya', gender: 'female', birth: '2008' });

  const people = { umar, nasreen, shabana, hamid, ruqayya, tariq, rida, adil, kiran, zoya };

  const relationships: Relationship[] = [
    makeRelationship(umar, nasreen, 'spouse'),
    makeRelationship(umar, shabana, 'spouse'),
    makeRelationship(umar, tariq, 'biological-parent'),
    makeRelationship(nasreen, tariq, 'biological-parent'),
    makeRelationship(umar, rida, 'biological-parent'),
    makeRelationship(shabana, rida, 'biological-parent'),
    // Rida is also adopted by Hamid: an adoptive parent alongside biological parents.
    makeRelationship(hamid, rida, 'adoptive-parent'),
    makeRelationship(hamid, ruqayya, 'spouse'),
    makeRelationship(hamid, adil, 'biological-parent'),
    makeRelationship(ruqayya, adil, 'biological-parent'),
    // Cousins marry: Tariq's father Umar is also Adil's... no — Kiran is Adil's sister and
    // marries Tariq, making their child Zoya related through two paths.
    makeRelationship(hamid, kiran, 'biological-parent'),
    makeRelationship(ruqayya, kiran, 'biological-parent'),
    makeRelationship(tariq, kiran, 'spouse'),
    makeRelationship(tariq, zoya, 'biological-parent'),
    makeRelationship(kiran, zoya, 'biological-parent'),
  ];

  return { graph: { persons: Object.values(people), relationships }, people };
}

/**
 * A genuine cycle: two people who are their own ancestors-in-law via a remarriage loop.
 * Used to prove traversals terminate.
 */
export function cyclicFamily(): BuiltFamily {
  const ali = makePerson({ id: 'ali', givenName: 'Ali', gender: 'male' });
  const bushra = makePerson({ id: 'bushra', givenName: 'Bushra', gender: 'female' });
  const child = makePerson({ id: 'child', givenName: 'Child', gender: 'other' });
  const grandchild = makePerson({ id: 'grandchild', givenName: 'Grandchild', gender: 'other' });

  const people = { ali, bushra, child, grandchild };
  const relationships: Relationship[] = [
    makeRelationship(ali, bushra, 'spouse'),
    makeRelationship(ali, child, 'biological-parent'),
    makeRelationship(bushra, child, 'biological-parent'),
    makeRelationship(child, grandchild, 'biological-parent'),
    // The loop: Bushra is also Ali's mother.
    makeRelationship(bushra, ali, 'biological-parent'),
  ];

  return { graph: { persons: Object.values(people), relationships }, people };
}
