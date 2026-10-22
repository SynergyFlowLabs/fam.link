import { useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiError,
  displayName,
  type DuplicateCandidate,
  type PersonView,
  type SessionResponse,
} from './api.js';
import { Dialog, Field, Notice } from './components/ui.js';
import { useAsync, useRoute } from './hooks.js';
import { ActivityView } from './views/ActivityView.js';
import { CalculatorView } from './views/CalculatorView.js';
import { InvitationsView } from './views/InvitationsView.js';
import { InviteView } from './views/InviteView.js';
import { PeopleView } from './views/PeopleView.js';
import { ProfilePanel, TreeView } from './views/TreeView.js';

/**
 * App shell: session, family space, and a hash router.
 *
 * The client is deliberately thin. Every permission and privacy decision it renders was already
 * made by the API; when the client hides something, it is a courtesy, not the control.
 */

export default function App() {
  const route = useRoute();
  const session = useAsync(() => api.session(), []);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(undefined);
  const [addRelativeTo, setAddRelativeTo] = useState<string | null | undefined>(undefined);

  const memberships = session.data?.memberships ?? [];
  const membership = useMemo(
    () => memberships.find((entry) => entry.spaceId === spaceId) ?? memberships[0],
    [memberships, spaceId],
  );

  useEffect(() => {
    if (membership && membership.spaceId !== spaceId) setSpaceId(membership.spaceId);
  }, [membership, spaceId]);

  useEffect(() => {
    if (membership?.personId && !focusId) setFocusId(membership.personId);
  }, [membership, focusId]);

  const signIn = async (userId: string) => {
    await api.signIn(userId);
    session.reload();
  };

  if (session.loading && !session.data) {
    return <div className="invite muted">Opening Fam Link…</div>;
  }

  if (route.path[0] === 'invite' && route.path[1]) {
    return (
      <InviteView
        token={route.path[1]}
        onDone={(nextSpaceId) => {
          setSpaceId(nextSpaceId);
          route.navigate('tree');
          session.reload();
        }}
      />
    );
  }

  if (!session.data?.user) {
    return <PersonaPicker session={session.data} onPick={signIn} />;
  }

  const activeSpaceId = membership?.spaceId ?? spaceId ?? '';
  const canManage = membership?.role === 'admin';
  const page = route.path[0] ?? 'tree';

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <div className="brand">
          <span className="brand__name">Fam Link</span>
          <span className="brand__mark">private</span>
        </div>
        {[
          ['tree', 'Tree'],
          ['people', 'People'],
          ['calculator', 'Relationship'],
          ['invitations', 'Invitations'],
          ['activity', 'Activity'],
        ].map(([key, label]) => (
          <a
            key={key}
            className="nav-link"
            href={`#/${key}`}
            aria-current={page === key ? 'page' : undefined}
          >
            {label}
          </a>
        ))}
        <div className="rail__foot">
          <p style={{ margin: '0 0 8px' }}>{membership?.space?.name ?? 'Family space'}</p>
          <p style={{ margin: 0 }}>
            Everything here is private to this family. Nothing is discoverable from outside.
          </p>
        </div>
      </nav>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <h1>{membership?.space?.name ?? 'Family space'}</h1>
            <span className="topbar__meta">
              {membership?.role === 'admin' ? 'Family administrator' : 'Contributor'} ·{' '}
              {session.data.user.name}
            </span>
          </div>
          <div className="topbar__actions">
            <label className="visually-hidden" htmlFor="persona-switch">
              Demo account
            </label>
            <select
              id="persona-switch"
              value={session.data.user.id}
              onChange={(event) => signIn(event.target.value)}
              title="Demo: sign in as another family member to see their view"
            >
              {session.data.personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn--quiet" onClick={() => void api.signOut().then(session.reload)}>
              Sign out
            </button>
          </div>
        </header>

        <main className="main">
          {page === 'tree' ? (
            <TreeView
              spaceId={activeSpaceId}
              focusId={focusId}
              selectedPersonId={selectedPersonId}
              onFocus={(personId) => setFocusId(personId)}
              onSelect={(personId) => setSelectedPersonId(personId)}
              onAddRelative={(personId) => setAddRelativeTo(personId ?? null)}
            />
          ) : null}

          {page === 'people' ? (
            <PeopleView
              spaceId={activeSpaceId}
              canManage={canManage}
              onSelect={(personId) => setSelectedPersonId(personId)}
              onFocus={(personId) => {
                setFocusId(personId);
                route.navigate('tree');
              }}
            />
          ) : null}

          {page === 'calculator' ? (
            <CalculatorView spaceId={activeSpaceId} viewerPersonId={membership?.personId} />
          ) : null}

          {page === 'invitations' ? <InvitationsView spaceId={activeSpaceId} /> : null}

          {page === 'activity' ? <ActivityView spaceId={activeSpaceId} /> : null}

          {selectedPersonId && page === 'people' ? (
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <ProfilePanel
                spaceId={activeSpaceId}
                personId={selectedPersonId}
                onFocus={(personId) => {
                  setFocusId(personId);
                  route.navigate('tree');
                }}
                onSelect={(personId) => setSelectedPersonId(personId)}
                onAddRelative={(personId) => setAddRelativeTo(personId ?? null)}
              />
            </div>
          ) : null}
        </main>
      </div>

      {addRelativeTo !== undefined ? (
        <AddRelativeDialog
          spaceId={activeSpaceId}
          anchorId={addRelativeTo ?? undefined}
          onClose={() => setAddRelativeTo(undefined)}
          onCreated={(personId) => {
            setAddRelativeTo(undefined);
            setSelectedPersonId(personId);
          }}
        />
      ) : null}
    </div>
  );
}

function PersonaPicker({
  session,
  onPick,
}: {
  session: SessionResponse | null;
  onPick: (userId: string) => Promise<void>;
}) {
  return (
    <div className="invite">
      <div className="invite__card">
        <div className="invite__eyebrow">Fam Link · private family network</div>
        <p className="invite__quote">Build your family tree together, and keep the stories behind every connection.</p>
        <p className="invite__who">
          This is a working demo with a synthetic family. Sign in as a family member to see the tree from their side —
          each person sees a different amount, because privacy is set per field.
        </p>
        <div className="list" style={{ marginTop: 'var(--sp-5)' }}>
          {(session?.personas ?? []).map((persona) => (
            <div key={persona.id} className="row">
              <div className="row__main">
                <div className="row__title" style={{ fontSize: 'var(--step-0)' }}>
                  {persona.name}
                </div>
                <div className="row__sub">
                  {persona.claimed.length > 0
                    ? `claims ${persona.claimed.map((person) => person.name).join(', ')}`
                    : 'no profile claimed'}
                </div>
              </div>
              <button type="button" className="btn btn--primary small" onClick={() => void onPick(persona.id)}>
                Continue as {persona.name.split(' ')[0]}
              </button>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 'var(--sp-4)' }}>
          Demo identity switching stands in for email or phone sign-in. No real accounts, no real family data.
        </p>
      </div>
    </div>
  );
}

type RelationChoice = 'parent' | 'child' | 'spouse' | 'sibling' | 'none';

function AddRelativeDialog({
  spaceId,
  anchorId,
  onClose,
  onCreated,
}: {
  spaceId: string;
  anchorId?: string;
  onClose: () => void;
  onCreated: (personId: string) => void;
}) {
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [gender, setGender] = useState<PersonView['gender']>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [relation, setRelation] = useState<RelationChoice>('child');
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (confirmDuplicate = false) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createPerson(spaceId, {
        givenName: name,
        familyName: familyName || undefined,
        gender,
        ...(birthYear.trim() ? { birthDate: { value: birthYear.trim(), precision: 'year' } } : {}),
        ...(relation === 'child' && anchorId ? { parentId: anchorId } : {}),
        ...(relation === 'parent' && anchorId ? { childId: anchorId } : {}),
        ...(relation === 'spouse' && anchorId ? { partnerId: anchorId } : {}),
        ...(relation === 'sibling' && anchorId ? { siblingOfId: anchorId } : {}),
        confirmDuplicate,
      } as Record<string, unknown>);
      onCreated(created.person.id);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        const payload = cause.payload as { duplicates?: DuplicateCandidate[] };
        setDuplicates(payload.duplicates ?? []);
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not add this person.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Add a relative"
      onClose={onClose}
      actions={
        <button type="button" className="btn btn--primary" disabled={busy || !name.trim()} onClick={() => submit(false)}>
          {busy ? 'Adding…' : 'Add person'}
        </button>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Adding name and relationship is enough. Everything else can be filled in later — by them, if they claim the
        profile.
      </p>

      <Field label="Given name">
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <Field label="Family name" hint="Optional">
        <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Gender" hint="Only used to phrase relationships correctly">
          <select value={gender} onChange={(event) => setGender(event.target.value as PersonView['gender'])}>
            <option value="unknown">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Birth year" hint="A year is enough — partial dates are supported">
          <input
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            inputMode="numeric"
            placeholder="1985"
          />
        </Field>
      </div>
      <Field label="Relationship">
        <select value={relation} onChange={(event) => setRelation(event.target.value as RelationChoice)}>
          <option value="child">Child of the selected person</option>
          <option value="parent">Parent of the selected person</option>
          <option value="spouse">Spouse or partner of the selected person</option>
          <option value="sibling">Sibling of the selected person</option>
          <option value="none">Not connected yet</option>
        </select>
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {duplicates && duplicates.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <Notice tone="info">
            This may already be in the family. A duplicate here becomes a fork in the tree later, so check first.
          </Notice>
          <div className="list" style={{ marginTop: 'var(--sp-3)' }}>
            {duplicates.map((candidate) => {
              const person = candidate.person;
              return (
                <div key={candidate.candidate.id} className="row">
                  <div className="row__main">
                    <div className="row__title" style={{ fontSize: 'var(--step-0)' }}>
                      {displayName(person)}
                    </div>
                    <div className="row__sub">
                      {[candidate.person.relationshipToViewer, ...candidate.signals.map((signal) => signal.detail)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => onCreated(person.id)}
                  >
                    This is them
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn--quiet small" style={{ marginTop: 8 }} onClick={() => submit(true)}>
            None of these — add a new person
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}
