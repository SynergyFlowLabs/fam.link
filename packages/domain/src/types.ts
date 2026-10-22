/**
 * Core domain types for the family graph.
 *
 * Binding constraints (see docs/adr/0001-family-graph-not-tree.md):
 * - Only parent/guardian, spouse/former-spouse/partner edges are stored.
 * - Siblings, cousins, grandparents and every other relationship are derived.
 * - Nothing in this package may perform I/O.
 */

export type Id = string;

/** Partial dates are first-class. We never fabricate precision we do not have. */
export type DatePrecision = 'exact' | 'month' | 'year' | 'approximate' | 'unknown';

export interface FamilyDate {
  /** ISO-8601 date string. Precision tells you how much of it to trust. */
  readonly value: string;
  readonly precision: DatePrecision;
}

export type Gender = 'female' | 'male' | 'other' | 'unknown';

export type LivingStatus = 'living' | 'deceased' | 'unknown';

/**
 * Who may see a given field. Ordered from most restrictive to least.
 * Used by the privacy projection, never by authority decisions.
 */
export type VisibilityScope =
  | 'private'
  | 'selected'
  | 'immediate-family'
  | 'family-space'
  | 'link'
  | 'public';

export const VISIBILITY_ORDER: readonly VisibilityScope[] = [
  'private',
  'selected',
  'immediate-family',
  'family-space',
  'link',
  'public',
];

export interface Person {
  readonly id: Id;
  readonly spaceId: Id;
  readonly givenName: string;
  readonly familyName?: string;
  /** Nicknames, transliterations, and script variants. Searchable. */
  readonly alternativeNames: readonly string[];
  readonly gender: Gender;
  readonly livingStatus: LivingStatus;
  readonly birthDate?: FamilyDate;
  readonly deathDate?: FamilyDate;
  readonly birthPlace?: string;
  readonly placesLived: readonly string[];
  readonly biography?: string;
  readonly photoUrl?: string;
  /** Only set when the profile has been claimed by a registered account. */
  readonly claimedByUserId?: Id;
  readonly custodianUserId?: Id;
  readonly isMinor: boolean;
  /** Field-level overrides. Any field absent from this map uses the default scope. */
  readonly fieldVisibility: Readonly<Record<string, VisibilityScope>>;
  /** Members (user ids) explicitly blocked from seeing this person at all. */
  readonly blockedUserIds: readonly Id[];
  /** Members (user ids) named under the "selected relatives" visibility scope. */
  readonly selectedViewerIds: readonly Id[];
  /** Set when the person asked to be separated from the tree: record is suppressed, not erased. */
  readonly separatedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserId?: Id;
  readonly mergedIntoId?: Id;
}

export type RelationshipKind =
  | 'biological-parent'
  | 'adoptive-parent'
  | 'foster-parent'
  | 'guardian'
  | 'spouse'
  | 'former-spouse'
  | 'partner';

export const PARENTAL_KINDS: readonly RelationshipKind[] = [
  'biological-parent',
  'adoptive-parent',
  'foster-parent',
  'guardian',
];

export const PARTNER_KINDS: readonly RelationshipKind[] = ['spouse', 'former-spouse', 'partner'];

export type VerificationStatus = 'unverified' | 'verified' | 'disputed';

export interface Relationship {
  readonly id: Id;
  readonly spaceId: Id;
  /**
   * For parental kinds: the parent/guardian.
   * For partner kinds: one partner (the pair is symmetric).
   */
  readonly fromPersonId: Id;
  /**
   * For parental kinds: the child/dependent.
   * For partner kinds: the other partner.
   */
  readonly toPersonId: Id;
  readonly kind: RelationshipKind;
  readonly startDate?: FamilyDate;
  readonly endDate?: FamilyDate;
  readonly source?: string;
  readonly verification: VerificationStatus;
  readonly visibility: VisibilityScope;
  readonly createdByUserId?: Id;
  readonly createdAt: string;
  /** Soft delete: relationships are never hard-deleted while a dispute may reference them. */
  readonly deletedAt?: string | null;
}

export type Role = 'owner' | 'custodian' | 'admin' | 'contributor' | 'viewer';

export const ROLE_RANK: Readonly<Record<Role, number>> = {
  owner: 5,
  custodian: 4,
  admin: 3,
  contributor: 2,
  viewer: 1,
};

export type SpaceMembershipStatus = 'active' | 'invited' | 'removed';

export interface Membership {
  readonly id: Id;
  readonly spaceId: Id;
  readonly userId: Id;
  readonly role: Exclude<Role, 'owner' | 'custodian'> | 'admin';
  readonly status: SpaceMembershipStatus;
  readonly joinedAt: string;
  /** When this member last looked at their notifications. Drives the unread count. */
  readonly notificationSeenAt?: string;
  /**
   * Per-category opt-outs for the in-product notification feed. Safety categories are not listed,
   * because they cannot be muted (see notifications.ts).
   */
  readonly notificationPreferences?: Readonly<Record<string, boolean>>;
}

export interface FamilySpace {
  readonly id: Id;
  readonly name: string;
  readonly locale: 'en' | 'ur';
  readonly createdAt: string;
  readonly createdByUserId: Id;
  /** Off by default. Even when on, living people are never public. */
  readonly allowPublicDiscovery: boolean;
  readonly defaultVisibility: VisibilityScope;
}

export interface User {
  readonly id: Id;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly photoUrl?: string;
  /** Demo affordance: the person this user controls in a given space is resolved via claims. */
  readonly isDemoPersona?: boolean;
}

/** Fields that only the profile owner (or an authorised approver) may change. */
export const PROTECTED_FIELDS = [
  'birthDate',
  'deathDate',
  'phone',
  'address',
  'medicalInfo',
  'photoUrl',
  'documents',
  'relationships',
] as const;

export type ProtectedField = (typeof PROTECTED_FIELDS)[number];

export function isProtectedField(field: string): field is ProtectedField {
  return (PROTECTED_FIELDS as readonly string[]).includes(field);
}

export type ProposalStatus = 'proposed' | 'accepted' | 'rejected' | 'disputed' | 'superseded';

export interface Proposal {
  readonly id: Id;
  readonly spaceId: Id;
  readonly personId: Id;
  readonly field: string;
  readonly previousValue: unknown;
  readonly proposedValue: unknown;
  readonly explanation: string;
  readonly evidence?: string;
  readonly proposedByUserId: Id;
  readonly createdAt: string;
  readonly status: ProposalStatus;
  readonly decidedByUserId?: Id;
  readonly decidedAt?: string;
  readonly decisionNote?: string;
  /** Other live proposals on the same field that contradict this one. */
  readonly conflictingWith?: readonly Id[];
}

export type ActivityKind =
  | 'person.created'
  | 'person.updated'
  | 'person.claimed'
  | 'person.separated'
  | 'relationship.created'
  | 'relationship.removed'
  | 'proposal.created'
  | 'proposal.accepted'
  | 'proposal.rejected'
  | 'visibility.changed'
  | 'member.joined'
  | 'member.role-changed'
  | 'invitation.created'
  | 'invitation.accepted'
  | 'invitation.revoked'
  | 'duplicate.merged'
  | 'duplicate.merge.reverted'
  | 'report.resolved'
  | 'person.restored'
  | 'duplicate.dismissed';

export interface ActivityEntry {
  readonly id: Id;
  readonly spaceId: Id;
  readonly kind: ActivityKind;
  readonly actorUserId: Id;
  readonly personId?: Id;
  readonly targetUserId?: Id;
  readonly summary: string;
  readonly before?: unknown;
  readonly after?: unknown;
  /** The single field this entry changed, when it changed one field. Enables precise revert. */
  readonly field?: string;
  readonly createdAt: string;
}

export type InvitationStatus = 'sent' | 'opened' | 'accepted' | 'declined' | 'expired' | 'revoked';

export interface Invitation {
  readonly id: Id;
  readonly spaceId: Id;
  readonly token: string;
  /** When set, the invitation targets an existing unclaimed person: claiming, not creating. */
  readonly personId?: Id;
  /** The relationship the inviter claims exists, used to build the invite copy. */
  readonly relationshipLabel?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly channel: 'link' | 'email' | 'whatsapp';
  readonly invitedByUserId: Id;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly status: InvitationStatus;
  readonly openedAt?: string;
  readonly acceptedAt?: string;
  readonly acceptedByUserId?: Id;
  /** Admins get to see the exact preview the invitee saw at send time. */
  readonly previewPersonIds: readonly Id[];
}
