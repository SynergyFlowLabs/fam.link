import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ActivityEntry,
  FamilySpace,
  Id,
  Invitation,
  Membership,
  Person,
  Proposal,
  Relationship,
  User,
} from '@famlink/domain';
import { seedStore } from './seed.js';

/**
 * JSON-document persistence behind a repository interface (ADR 0002).
 *
 * The shape mirrors a relational schema on purpose: persons, relationships, memberships,
 * invitations, proposals, activity. Replacing this file with Postgres means implementing
 * `Repository`, not rewriting the domain.
 */

export interface HiddenBranch {
  readonly spaceId: Id;
  /** The member who cannot see this branch. */
  readonly viewerUserId: Id;
  /** Root of the hidden subtree, inclusive. */
  readonly rootPersonId: Id;
}

export interface DismissedDuplicate {
  readonly spaceId: Id;
  readonly pairKey: string;
  readonly dismissedByUserId: Id;
  readonly dismissedAt: string;
}

export interface Store {
  users: User[];
  spaces: FamilySpace[];
  memberships: Membership[];
  persons: Person[];
  relationships: Relationship[];
  proposals: Proposal[];
  activity: ActivityEntry[];
  invitations: Invitation[];
  hiddenBranches: HiddenBranch[];
  dismissedDuplicates: DismissedDuplicate[];
  nextId: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(here, '..', 'data');
const storeFile = process.env['FAMLINK_STORE'] ?? join(dataDirectory, 'store.json');

let cache: Store | null = null;

export function repositoryPath(): string {
  return storeFile;
}

export function loadStore(): Store {
  if (cache) return cache;
  if (existsSync(storeFile)) {
    cache = JSON.parse(readFileSync(storeFile, 'utf8')) as Store;
    return cache;
  }
  cache = seedStore();
  persist();
  return cache;
}

export function persist(): void {
  if (!cache) return;
  mkdirSync(dirname(storeFile), { recursive: true });
  const temporary = `${storeFile}.tmp`;
  writeFileSync(temporary, JSON.stringify(cache, null, 2));
  renameSync(temporary, storeFile);
}

/** In-memory store for tests; never touches the filesystem. */
export function useStoreForTesting(store: Store): void {
  cache = store;
}

export function resetStoreCache(): void {
  cache = null;
}

export function nextId(store: Store, prefix: string): Id {
  store.nextId += 1;
  return `${prefix}-${store.nextId.toString(36).padStart(4, '0')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function recordActivity(
  store: Store,
  entry: Omit<ActivityEntry, 'id' | 'createdAt'>,
): ActivityEntry {
  const activity: ActivityEntry = {
    ...entry,
    id: nextId(store, 'act'),
    createdAt: nowIso(),
  };
  store.activity.unshift(activity);
  return activity;
}

export function userById(store: Store, userId: Id): User | undefined {
  return store.users.find((user) => user.id === userId);
}

export function spaceById(store: Store, spaceId: Id): FamilySpace | undefined {
  return store.spaces.find((space) => space.id === spaceId);
}

export function membershipFor(store: Store, spaceId: Id, userId: Id): Membership | undefined {
  return store.memberships.find(
    (membership) =>
      membership.spaceId === spaceId && membership.userId === userId && membership.status === 'active',
  );
}

/** The person a user has claimed in a space, if any. */
export function claimedPersonFor(store: Store, spaceId: Id, userId: Id): Person | undefined {
  return store.persons.find(
    (person) => person.spaceId === spaceId && person.claimedByUserId === userId && !person.mergedIntoId,
  );
}

export function saveStore(): void {
  persist();
}
