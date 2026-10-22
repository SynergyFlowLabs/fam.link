/**
 * Browser API client. Always relative URLs: the web server proxies /api to the API service, so
 * browser code must never address a host directly.
 */

/**
 * Demo identity, kept in localStorage and sent as a header.
 *
 * The session cookie is the real mechanism, but this app is demonstrated inside an embedded preview
 * iframe, where the browser treats the app's origin as third-party and drops `SameSite=Lax` cookies.
 * The result was a persona picker where every button appeared to do nothing: the POST set a cookie
 * the next GET never received.
 *
 * So the chosen demo persona is stored on the client and sent on every request. This is explicitly
 * *not* authentication — the API only honours it while `FAMLINK_DEMO_IDENTITY` is not `off`, and the
 * README says so. Replacing it with real sign-in means deleting this and the header fallback server-side.
 */
const PERSONA_KEY = 'famlink.persona';
export const DEMO_IDENTITY_HEADER = 'x-famlink-persona';

export function storedPersona(): string | undefined {
  try {
    return window.localStorage.getItem(PERSONA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storePersona(userId: string | null): void {
  try {
    if (userId) window.localStorage.setItem(PERSONA_KEY, userId);
    else window.localStorage.removeItem(PERSONA_KEY);
  } catch {
    // Private browsing may refuse storage; the cookie path still works in a top-level window.
  }
}

export interface FamilyDate {
  value: string;
  precision: 'exact' | 'month' | 'year' | 'approximate' | 'unknown';
}

export interface PersonView {
  id: string;
  spaceId: string;
  givenName: string;
  familyName?: string;
  alternativeNames: string[];
  gender: 'female' | 'male' | 'other' | 'unknown';
  livingStatus: 'living' | 'deceased' | 'unknown';
  birthDate?: FamilyDate;
  deathDate?: FamilyDate;
  birthPlace?: string;
  biography?: string;
  photoUrl?: string;
  isMinor: boolean;
  claimed: boolean;
  hiddenFields: string[];
  relationshipToViewer?: string;
  /** Effective scope per configurable field — present only for viewers allowed to change it. */
  visibility?: Record<string, string>;
  canEditVisibility?: boolean;
}

export interface TreeResponse {
  focusId: string;
  nodes: PersonView[];
  edges: Array<{ id: string; fromPersonId: string; toPersonId: string; kind: string }>;
  hiddenCount: number;
  depth: { up: number; down: number };
}

export interface SessionResponse {
  user: { id: string; name: string; email: string } | null;
  memberships: Array<{ spaceId: string; role: string; space?: { id: string; name: string }; personId?: string }>;
  personas: Array<{
    id: string;
    name: string;
    email: string;
    claimed: Array<{ id: string; name: string; spaceId: string }>;
  }>;
}

export interface ProfileResponse {
  person: PersonView;
  relationship?: {
    term: string;
    termId: string;
    sentence: string;
    description: string;
    urduTerm?: string;
    alternatives: Array<{ term: string; description: string }>;
    basis: string;
    path: Array<{ toPersonId: string }>;
  };
  relatives: {
    parents: PersonView[];
    children: PersonView[];
    partners: PersonView[];
    siblings: PersonView[];
  };
  proposals: Array<{
    id: string;
    field: string;
    previousValue?: unknown;
    proposedValue: unknown;
    explanation: string;
    status: string;
    canDecide: boolean;
  }>;
  activity: ActivityEntry[];
  permissions: { canEditDirectly: boolean; canRequestSeparation: boolean; canRestore?: boolean };
}

export interface ActivityEntry {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
  actor?: { name: string };
  personId?: string;
  field?: string;
  before?: unknown;
  after?: unknown;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  createdAt: string;
  personId?: string;
  action?: string;
}

export interface VisibilityScope {
  id: string;
  label: string;
  description: string;
}

export interface DisputeGroup {
  personId: string;
  field: string;
  disputed: boolean;
  canResolve: boolean;
  person: PersonView;
  proposals: Array<{
    id: string;
    field: string;
    proposedValue: unknown;
    previousValue?: unknown;
    explanation: string;
    proposedBy: string;
    status: string;
    createdAt: string;
  }>;
}

export interface Invitation {
  id: string;
  token: string;
  channel: string;
  status: string;
  relationshipLabel?: string;
  email?: string;
  phone?: string;
  expiresAt: string;
  person?: PersonView;
  invitedBy?: { name: string };
}

export interface InvitePreview {
  invitation: { token: string; channel: string; status: string; relationshipLabel?: string; expiresAt: string };
  space: { id: string; name: string } | null;
  inviter: { name: string } | null;
  person: { id: string; givenName: string; familyName?: string; claimed: boolean } | null;
}

export interface DuplicateCandidate {
  key: string;
  score: number;
  suggestion: string;
  signals: Array<{ id: string; detail: string; weight: number }>;
  person: PersonView;
  candidate: PersonView;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const persona = storedPersona();
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(persona ? { [DEMO_IDENTITY_HEADER]: persona } : {}),
      ...(init.headers ?? {}),
    },
    ...init,
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

export const api = {
  session: () => call<SessionResponse>('/api/session'),
  signIn: async (userId: string) => {
    // Store first: the header is what authenticates the very next request in an embedded preview.
    storePersona(userId);
    const result = await call<{ user: SessionResponse['user'] }>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (!result.user) storePersona(null);
    return result;
  },
  signOut: async () => {
    const result = await call<{ ok: true }>('/api/session', { method: 'DELETE' });
    storePersona(null);
    return result;
  },
  createSpace: (name: string) =>
    call<{ space: { id: string; name: string }; personId: string }>('/api/spaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  tree: (spaceId: string, focus?: string, up = 2, down = 2) =>
    call<TreeResponse>(
      `/api/spaces/${spaceId}/tree?${new URLSearchParams({
        ...(focus ? { focus } : {}),
        up: String(up),
        down: String(down),
      })}`,
    ),
  people: (spaceId: string, query = '') =>
    call<{ living: PersonView[]; deceased: PersonView[]; results?: Array<PersonView & { matchedOn: string }> }>(
      `/api/spaces/${spaceId}/people${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    ),
  person: (spaceId: string, personId: string) =>
    call<ProfileResponse>(`/api/spaces/${spaceId}/people/${personId}`),
  createPerson: (spaceId: string, body: Record<string, unknown>) =>
    call<{ person: PersonView }>(`/api/spaces/${spaceId}/people`, { method: 'POST', body: JSON.stringify(body) }),
  updatePerson: (spaceId: string, personId: string, body: Record<string, unknown>) =>
    call<{
      person: PersonView;
      applied: Record<string, unknown>;
      proposed: Array<{ id: string; field: string }>;
      refused: Array<{ field: string; reason: string }>;
    }>(`/api/spaces/${spaceId}/people/${personId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  relationship: (spaceId: string, from: string, to: string) =>
    call<{
      term: string;
      sentence: string;
      description: string;
      urduTerm?: string;
      basis: string;
      alternatives: Array<{ term: string; description: string }>;
      people: { from: PersonView; to: PersonView };
    }>(`/api/spaces/${spaceId}/relationship?from=${from}&to=${to}`),
  invitations: (spaceId: string) => call<{ invitations: Invitation[] }>(`/api/spaces/${spaceId}/invitations`),
  createInvitation: (spaceId: string, body: Record<string, unknown>) =>
    call<{ invitation: Invitation }>(`/api/spaces/${spaceId}/invitations`, { method: 'POST', body: JSON.stringify(body) }),
  revokeInvitation: (spaceId: string, invitationId: string) =>
    call<{ invitation: Invitation }>(`/api/spaces/${spaceId}/invitations/${invitationId}/revoke`, { method: 'POST' }),
  invitePreview: (token: string) => call<InvitePreview>(`/api/invite/${token}`),
  acceptInvite: (token: string, userId?: string) =>
    call<{ ok: true; spaceId: string; personId?: string }>(`/api/invite/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  declineInvite: (token: string) => call<{ ok: true }>(`/api/invite/${token}/decline`, { method: 'POST' }),
  activity: (spaceId: string) => call<{ activity: ActivityEntry[] }>(`/api/spaces/${spaceId}/activity`),
  proposals: (spaceId: string) =>
    call<{ proposals: Array<{ id: string; field: string; person: PersonView; explanation: string; canDecide: boolean; status: string }> }>(
      `/api/spaces/${spaceId}/proposals`,
    ),
  decideProposal: (spaceId: string, proposalId: string, outcome: 'accept' | 'reject') =>
    call<{ proposal: unknown }>(`/api/spaces/${spaceId}/proposals/${proposalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    }),
  health: (spaceId: string) =>
    call<{
      findings: Array<{
        id: string;
        title: string;
        detail: string;
        severity: 'blocking' | 'warning' | 'info';
        people: Array<{ id: string; name: string }>;
      }>;
      peopleCount: number;
      withBirthDate: number;
      linkedToSomeone: number;
    }>(`/api/spaces/${spaceId}/health`),
  duplicates: (spaceId: string) => call<{ candidates: DuplicateCandidate[] }>(`/api/spaces/${spaceId}/duplicates`),
  merge: (spaceId: string, survivorId: string, absorbedId: string) =>
    call<{ survivor: PersonView }>(`/api/spaces/${spaceId}/duplicates/merge`, {
      method: 'POST',
      body: JSON.stringify({ survivorId, absorbedId }),
    }),
  merges: (spaceId: string) =>
    call<{
      merges: Array<{
        id: string;
        survivorId: string;
        absorbedId: string;
        mergedAt: string;
        mergedBy?: string;
        revertedAt?: string;
        survivorName?: string;
        absorbedName?: string;
      }>;
    }>(`/api/spaces/${spaceId}/duplicates/merges`),
  revertMerge: (spaceId: string, mergeId: string) =>
    call<{ ok: true; restored: string[]; skipped: string[]; repointed: number; note?: string }>(
      `/api/spaces/${spaceId}/duplicates/merges/${mergeId}/revert`,
      { method: 'POST' },
    ),
  dismissDuplicate: (spaceId: string, personId: string, candidateId: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/duplicates/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ personId, candidateId }),
    }),
  notifications: (spaceId: string) =>
    call<{ notifications: Notification[]; unread: number }>(`/api/spaces/${spaceId}/notifications`),
  markNotificationsSeen: (spaceId: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/notifications/seen`, { method: 'POST', body: '{}' }),
  sendInvitation: (spaceId: string, invitationId: string, channel: 'email' | 'whatsapp', recipient: string) =>
    call<{
      duplicated: boolean;
      message: { id: string; status: string; recipient: string; attempts: number; sentAt?: string; lastError?: string };
      subject: string;
      body: string;
    }>(`/api/spaces/${spaceId}/invitations/${invitationId}/send`, {
      method: 'POST',
      body: JSON.stringify({ channel, recipient }),
    }),
  outbox: (spaceId: string) =>
    call<{
      messages: Array<{
        id: string;
        channel: string;
        recipient: string;
        subject: string;
        status: 'queued' | 'sent' | 'failed';
        attempts: number;
        createdAt: string;
        sentAt?: string;
        lastError?: string;
      }>;
    }>(`/api/spaces/${spaceId}/outbox`),
  reports: (spaceId: string) =>
    call<{
      reports: Array<{
        id: string;
        personId?: string;
        personName?: string;
        reportedBy: string;
        reason: string;
        status: 'open' | 'resolved' | 'dismissed';
        createdAt: string;
        resolvedAt?: string;
        resolutionNote?: string;
      }>;
    }>(`/api/spaces/${spaceId}/reports`),
  resolveReport: (spaceId: string, reportId: string, outcome: 'resolved' | 'dismissed', note?: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ outcome, note }),
    }),
  restorePerson: (spaceId: string, personId: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/people/${personId}/restore`, { method: 'POST', body: '{}' }),
  notificationPreferences: (spaceId: string) =>
    call<{
      categories: Array<{ id: string; label: string; description: string; mutable: boolean; enabled: boolean }>;
    }>(`/api/spaces/${spaceId}/notifications/preferences`),
  setNotificationPreference: (spaceId: string, category: string, enabled: boolean) =>
    call<{ ok: true; categories: Array<{ id: string; label: string; description: string; mutable: boolean; enabled: boolean }> }>(
      `/api/spaces/${spaceId}/notifications/preferences`,
      { method: 'PATCH', body: JSON.stringify({ category, enabled }) },
    ),
  disputes: (spaceId: string) => call<{ disputes: DisputeGroup[] }>(`/api/spaces/${spaceId}/disputes`),
  revertActivity: (spaceId: string, activityId: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/activity/${activityId}/revert`, { method: 'POST', body: '{}' }),
  setVisibility: (spaceId: string, personId: string, field: string, scope: string) =>
    call<{ ok: true; fieldVisibility: Record<string, string> }>(
      `/api/spaces/${spaceId}/people/${personId}/visibility`,
      { method: 'PATCH', body: JSON.stringify({ field, scope }) },
    ),
  hiddenBranches: (spaceId: string) =>
    call<{ branches: Array<{ rootPersonId: string; name: string; relationship?: string }> }>(
      `/api/spaces/${spaceId}/hidden-branches`,
    ),
  hideBranch: (spaceId: string, rootPersonId: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/hidden-branches`, {
      method: 'POST',
      body: JSON.stringify({ rootPersonId }),
    }),
  unhideBranch: (spaceId: string, rootPersonId: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/hidden-branches/${rootPersonId}`, { method: 'DELETE' }),
  deleteAccount: () =>
    call<{
      ok: true;
      removed: { account: boolean; contactDetails: boolean };
      retained: { peopleProfiles: number; note: string };
    }>('/api/account', { method: 'DELETE' }),
  report: (spaceId: string, personId: string, reason: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/reports`, {
      method: 'POST',
      body: JSON.stringify({ personId, reason }),
    }),
  separate: (spaceId: string, personId: string, reason?: string) =>
    call<{ ok: true }>(`/api/spaces/${spaceId}/people/${personId}/separate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

export function displayName(person: { givenName: string; familyName?: string }): string {
  return [person.givenName, person.familyName].filter(Boolean).join(' ');
}

export function lifeSpan(person: PersonView): string {
  const year = (date?: FamilyDate): string => (date?.value ? date.value.slice(0, 4) : '');
  const birth = year(person.birthDate);
  const death = year(person.deathDate);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return '';
}

export function formatDate(date?: FamilyDate): string {
  if (!date?.value) return '';
  const [year, month, day] = date.value.split('-');
  if (date.precision === 'year') return year ?? '';
  if (date.precision === 'approximate') return `about ${year}`;
  if (date.precision === 'month') return `${month}/${year}`;
  return `${day}/${month}/${year}`;
}
