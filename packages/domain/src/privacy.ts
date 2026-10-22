import { type FamilyGraph, type GraphIndex } from './graph.js';
import { ageInYears } from './dates.js';
import type { Id, Person, Role, VisibilityScope } from './types.js';

/**
 * Field-level privacy projection.
 *
 * ADR 0003: privacy is applied at the API boundary as a projection. A field the viewer may not
 * see must be **absent** from the response, never merely hidden in the UI. This module is the
 * single source of truth for that decision.
 */

export interface ViewerContext {
  readonly userId: Id;
  readonly spaceId: Id;
  /** Role in this space, or 'none' when the viewer is not a member. */
  readonly role: Role | 'none';
  /** The person record this user has claimed in this space, if any. */
  readonly viewerPersonId?: Id;
  /** Members whose invites are link-scoped rather than space members. */
  readonly viaLink?: boolean;
  /** People hidden from this viewer by hidden branches or blocks, computed by the API. */
  readonly hiddenPersonIds?: ReadonlySet<Id>;
  readonly now?: Date;
}

/** Fields that are never visible to anyone but the owner, regardless of scope. */
export const OWNER_ONLY_FIELDS = ['phone', 'address', 'medicalInfo', 'documents'] as const;

/** Fields hidden by default for every living person (PRD §9.3). */
export const LIVING_HIDDEN_BY_DEFAULT = [
  'birthDate',
  'phone',
  'address',
  'documents',
  'medicalInfo',
  'photoUrl',
] as const;

const PUBLIC_SAFE_FIELDS = new Set(['id', 'givenName', 'familyName', 'alternativeNames', 'gender', 'livingStatus']);
const CONTACT_FIELDS = new Set(['phone', 'address', 'medicalInfo', 'documents']);

export interface PersonView {
  readonly id: Id;
  readonly spaceId: Id;
  readonly givenName: string;
  readonly familyName?: string;
  readonly alternativeNames: readonly string[];
  readonly gender: Person['gender'];
  readonly livingStatus: Person['livingStatus'];
  readonly birthDate?: Person['birthDate'];
  readonly deathDate?: Person['deathDate'];
  readonly birthPlace?: string;
  readonly biography?: string;
  readonly photoUrl?: string;
  readonly placesLived?: readonly string[];
  readonly isMinor: boolean;
  readonly claimed: boolean;
  readonly livingInSpace: boolean;
  /** Which fields were withheld, so the UI can say "3 fields hidden" without revealing values. */
  readonly hiddenFields: readonly string[];
  /** Relationship label of this person to the viewer, when the viewer has a person record. */
  readonly relationshipToViewer?: string;
  /**
   * The effective scope of each configurable field, returned only to the people allowed to change
   * it (owner, or custodian of an unclaimed profile). Every other viewer sees `hiddenFields` only.
   */
  readonly visibility?: Readonly<Record<string, VisibilityScope>>;
  /** True when this viewer may change the scopes above. Prevents a UI that offers a control which 403s. */
  readonly canEditVisibility?: boolean;
}

export function defaultFieldScope(person: Person, field: string): VisibilityScope {
  if (CONTACT_FIELDS.has(field)) return 'private';
  if (person.livingStatus === 'living') {
    if (field === 'birthDate' || field === 'photoUrl') return 'immediate-family';
    return 'family-space';
  }
  // Deceased people are the historical record: visible within the family, never public.
  if (field === 'birthDate' || field === 'deathDate' || field === 'biography') return 'family-space';
  return 'family-space';
}

export function fieldScope(person: Person, field: string): VisibilityScope {
  return person.fieldVisibility[field] ?? defaultFieldScope(person, field);
}

export const VISIBILITY_SCOPES: ReadonlyArray<{ id: VisibilityScope; label: string; description: string }> = [
  { id: 'private', label: 'Only me', description: 'Just you and anyone managing your profile.' },
  { id: 'selected', label: 'Selected relatives', description: 'Only relatives you name individually.' },
  { id: 'immediate-family', label: 'Immediate family', description: 'Parents, children, siblings and partners.' },
  { id: 'family-space', label: 'Entire family space', description: 'Everyone invited to this family.' },
  { id: 'link', label: 'Anyone with the private link', description: 'People you send a private link to.' },
  { id: 'public', label: 'Public', description: 'Never allowed for a living person.' },
];

export function isVisibilityScope(value: unknown): value is VisibilityScope {
  return VISIBILITY_SCOPES.some((scope) => scope.id === value);
}

/** Fields whose visibility a person can configure in the UI, with a readable label. */
export const CONFIGURABLE_FIELDS: ReadonlyArray<{ field: string; label: string }> = [
  { field: 'birthDate', label: 'Exact birth date' },
  { field: 'birthPlace', label: 'Birth place' },
  { field: 'placesLived', label: 'Places lived' },
  { field: 'biography', label: 'Biography' },
  { field: 'photoUrl', label: 'Photograph' },
  { field: 'deathDate', label: 'Date of death' },
  { field: 'familyName', label: 'Family name' },
];

const SCOPE_RANK: Readonly<Record<VisibilityScope, number>> = {
  private: 0,
  selected: 1,
  'immediate-family': 2,
  'family-space': 3,
  link: 4,
  public: 5,
};

function isMember(viewer: ViewerContext): boolean {
  return viewer.role !== 'none';
}

function isImmediateFamily(index: GraphIndex, viewer: ViewerContext, person: Person): boolean {
  if (!viewer.viewerPersonId) return false;
  const viewerId = viewer.viewerPersonId;
  const related = new Set<Id>([...siblingOrSelfIds(index, viewerId), ...parentOrChildIds(index, viewerId)]);
  return related.has(person.id);
}

function siblingOrSelfIds(index: GraphIndex, personId: Id): Id[] {
  const ids = new Set<Id>([personId]);
  for (const relationship of index.parentsByChild.get(personId) ?? []) {
    for (const child of index.childrenByParent.get(relationship.fromPersonId) ?? []) {
      ids.add(child.toPersonId);
    }
  }
  return [...ids];
}

function parentOrChildIds(index: GraphIndex, personId: Id): Id[] {
  const ids: Id[] = [];
  for (const relationship of index.parentsByChild.get(personId) ?? []) ids.push(relationship.fromPersonId);
  for (const relationship of index.childrenByParent.get(personId) ?? []) ids.push(relationship.toPersonId);
  for (const relationship of index.partnersByPerson.get(personId) ?? []) {
    ids.push(relationship.fromPersonId === personId ? relationship.toPersonId : relationship.fromPersonId);
  }
  return ids;
}

/** Does the viewer's access reach this scope level for this person? */
export function scopeGrants(
  index: GraphIndex,
  viewer: ViewerContext,
  person: Person,
  field: string,
): boolean {
  const scope = fieldScope(person, field);
  const isOwner = Boolean(viewer.viewerPersonId && viewer.viewerPersonId === person.id);
  const isCustodian = person.custodianUserId === viewer.userId;
  const isAdmin = viewer.role === 'admin';

  switch (scope) {
    case 'private':
      return isOwner || isCustodian;
    case 'selected':
      return isOwner || isCustodian || person.selectedViewerIds.includes(viewer.userId) || isAdmin;
    case 'immediate-family':
      return isOwner || isCustodian || isAdmin || (isMember(viewer) && isImmediateFamily(index, viewer, person));
    case 'family-space':
      return isOwner || isCustodian || isAdmin || isMember(viewer);
    case 'link':
      return isOwner || isCustodian || isAdmin || isMember(viewer) || Boolean(viewer.viaLink);
    case 'public':
      // Living people are never public, whatever the setting says.
      if (person.livingStatus === 'living') return isOwner || isMember(viewer);
      return true;
  }
}

/** Can this viewer see this person exists at all? */
export function canSeePerson(index: GraphIndex, viewer: ViewerContext, person: Person): boolean {
  if (person.mergedIntoId) return false;
  if (viewer.hiddenPersonIds?.has(person.id)) return false;
  if (person.blockedUserIds.includes(viewer.userId)) return false;
  if (person.separatedAt) {
    // A separated person is invisible except to the space's admins, who need to resolve the request.
    return viewer.role === 'admin';
  }
  if (viewer.viewerPersonId === person.id) return true;
  if (!isMember(viewer) && !viewer.viaLink) {
    return person.livingStatus !== 'living' && fieldScope(person, 'givenName') === 'public';
  }
  return (
    scopeGrants(index, viewer, person, 'givenName') ||
    scopeGrants(index, viewer, person, 'birthDate') ||
    scopeGrants(index, viewer, person, 'photoUrl')
  );
}

export function canViewField(
  index: GraphIndex,
  viewer: ViewerContext,
  person: Person,
  field: string,
): boolean {
  if (!canSeePerson(index, viewer, person)) return false;
  if (viewer.viewerPersonId === person.id) return true;
  if (CONTACT_FIELDS.has(field as string) && person.livingStatus === 'living') {
    // Contact details are owner/custodian only for living people, even when a scope is widened.
    const scope = fieldScope(person, field);
    if (SCOPE_RANK[scope] > SCOPE_RANK.selected) {
      return person.custodianUserId === viewer.userId;
    }
  }
  return scopeGrants(index, viewer, person, field);
}

/**
 * Project a person for a viewer. Fields the viewer may not see are removed entirely, and the list
 * of withheld field names is returned so the UI can be honest without leaking values.
 */
export function projectPerson(
  index: GraphIndex,
  viewer: ViewerContext,
  person: Person,
): PersonView | null {
  if (!canSeePerson(index, viewer, person)) return null;

  const optionalFields: Array<keyof Person> = [
    'familyName',
    'birthDate',
    'deathDate',
    'birthPlace',
    'biography',
    'photoUrl',
  ];
  const hiddenFields: string[] = [];
  const allowed = (field: string): boolean => {
    const permitted = canViewField(index, viewer, person, field);
    if (!permitted && optionalFields.includes(field as keyof Person)) hiddenFields.push(field);
    return permitted;
  };

  const view: PersonView = {
    id: person.id,
    spaceId: person.spaceId,
    givenName: person.givenName,
    alternativeNames: person.alternativeNames,
    gender: person.gender,
    livingStatus: person.livingStatus,
    isMinor: person.isMinor,
    claimed: Boolean(person.claimedByUserId),
    livingInSpace: person.livingStatus === 'living' && !person.deathDate,
    hiddenFields,
  };

  const assign = <K extends keyof PersonView>(key: K, value: PersonView[K] | undefined): void => {
    if (value !== undefined) (view as unknown as Record<string, unknown>)[key as string] = value;
  };

  if (allowed('familyName')) assign('familyName', person.familyName);
  if (allowed('birthDate')) assign('birthDate', person.birthDate);
  if (allowed('deathDate')) assign('deathDate', person.deathDate);
  if (allowed('birthPlace')) assign('birthPlace', person.birthPlace);
  if (allowed('biography')) assign('biography', person.biography);
  if (allowed('photoUrl')) assign('photoUrl', person.photoUrl);
  if (allowed('placesLived')) assign('placesLived', person.placesLived);

  // Visibility readback: the owner (or the custodian of an unclaimed profile) needs to see the
  // stored override, not a value the client infers from `hiddenFields`.
  const isSubject = viewer.viewerPersonId === person.id;
  const isCustodianOfUnclaimed = person.custodianUserId === viewer.userId && !person.claimedByUserId;
  if (isSubject || isCustodianOfUnclaimed) {
    const visibility: Record<string, VisibilityScope> = {};
    for (const entry of CONFIGURABLE_FIELDS) {
      visibility[entry.field] = fieldScope(person, entry.field);
    }
    assign('visibility', visibility);
    assign('canEditVisibility', true);
  }

  return view;
}

export function visiblePersonIds(index: GraphIndex, viewer: ViewerContext): Set<Id> {
  const visible = new Set<Id>();
  for (const person of index.persons.values()) {
    if (canSeePerson(index, viewer, person)) visible.add(person.id);
  }
  return visible;
}

/** A privacy filter usable by traversals: "may this viewer learn that this person is on the path?" */
export function visibilityGate(index: GraphIndex, viewer: ViewerContext): (personId: Id) => boolean {
  const cache = new Map<Id, boolean>();
  return (personId: Id): boolean => {
    const cached = cache.get(personId);
    if (cached !== undefined) return cached;
    const person = index.persons.get(personId);
    const visible = person ? canSeePerson(index, viewer, person) : false;
    cache.set(personId, visible);
    return visible;
  };
}

/** Hidden-branch and block computation for a viewer, in one place. */
export function hiddenPersonIdsFor(
  graph: FamilyGraph,
  viewer: { userId: Id; blockedBy?: readonly Id[] },
): Set<Id> {
  const hidden = new Set<Id>();
  for (const person of graph.persons) {
    if (person.blockedUserIds.includes(viewer.userId)) hidden.add(person.id);
  }
  for (const blockedId of viewer.blockedBy ?? []) hidden.add(blockedId);
  return hidden;
}

export function isMinorNow(person: Person, now: Date = new Date()): boolean {
  const age = ageInYears(person.birthDate, now, person.deathDate);
  return person.livingStatus === 'living' && age !== undefined && age < 18;
}

export function sameMembershipScope(left: VisibilityScope, right: VisibilityScope): boolean {
  return SCOPE_RANK[left] === SCOPE_RANK[right];
}
